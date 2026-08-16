import { json, type RequestHandler } from '@sveltejs/kit';
import crypto from 'node:crypto';
import { readSession } from '$lib/server/auth';
import { isSameOriginRequest } from '$lib/server/csrf';
import { NOTES_FILE_PATH, invalidateNotes, readNotes } from '$lib/server/dataCache';
import { mutateJsonSafe } from '$lib/server/fileStorage';
import {
	deleteImagesForNote,
	cleanupUnusedImagesOnNoteUpdate,
	extractMediaFilenames
} from '$lib/server/mediaCleanup';
import type { Note } from '$lib/types/notes';

export const GET: RequestHandler = async ({ request, cookies }) => {
	const user = readSession(cookies);
	if (!user) {
		return json({ error: 'Non autorizzato: autenticazione richiesta.' }, { status: 401 });
	}

	const allNotes = await readNotes<Note[]>();
	// Restituisce le note associate all'utente corrente o create localmente
	const userNotes = allNotes.filter((n) => !n.userId || n.userId === user.userId);

	const body = JSON.stringify(userNotes);
	const etag = `"${crypto.createHash('sha1').update(body).digest('base64url')}"`;

	if (request.headers.get('if-none-match') === etag) {
		return new Response(null, {
			status: 304,
			headers: { ETag: etag, 'Cache-Control': 'no-cache' }
		});
	}

	return json(userNotes, {
		headers: { ETag: etag, 'Cache-Control': 'no-cache' }
	});
};

export const POST: RequestHandler = async (event) => {
	const { request, cookies } = event;

	if (!isSameOriginRequest(event)) {
		return json({ error: 'Origine non consentita' }, { status: 403 });
	}

	const user = readSession(cookies);
	if (!user) {
		return json({ error: 'Non autorizzato: autenticazione richiesta.' }, { status: 401 });
	}

	const payload: Partial<Note> = await request.json();
	if (!payload.title || typeof payload.title !== 'string' || !payload.title.trim()) {
		return json({ error: 'Il titolo della nota è obbligatorio.' }, { status: 400 });
	}

	const now = new Date().toISOString();
	const noteContent = payload.content || '';
	const contentImages = Array.from(extractMediaFilenames([noteContent])).map((fn) => `/uploads/${fn}`);
	const explicitImages = Array.isArray(payload.images) ? payload.images : [];
	const combinedImages = Array.from(new Set([...explicitImages, ...contentImages]));

	let createdNote: Note | null = null;

	const result = await mutateJsonSafe<Note[]>(NOTES_FILE_PATH, [], (allNotes) => {
		const userNotes = allNotes.filter((n) => !n.userId || n.userId === user.userId);
		const maxOrder = userNotes.reduce((max, n) => Math.max(max, n.order ?? 0), 0);

		const newNote: Note = {
			id: payload.id || crypto.randomUUID(),
			userId: user.userId,
			title: payload.title!.trim(),
			content: noteContent,
			category: payload.category?.trim() || 'Generale & Varie',
			tags: Array.isArray(payload.tags) ? payload.tags.map((t) => String(t).trim()).filter(Boolean) : [],
			images: combinedImages,
			isPinned: Boolean(payload.isPinned),
			order: typeof payload.order === 'number' ? payload.order : maxOrder + 1,
			createdAt: payload.createdAt || now,
			updatedAt: now
		};

		createdNote = newNote;
		const existingIdx = allNotes.findIndex((n) => n.id === newNote.id);
		if (existingIdx >= 0) {
			allNotes[existingIdx] = newNote;
		} else {
			allNotes.unshift(newNote);
		}
		return allNotes;
	});

	if (!result.success || !createdNote) {
		return json({ error: 'Impossibile salvare la nota su disco.' }, { status: 500 });
	}

	invalidateNotes();
	return json(createdNote, { status: 201 });
};

export const PUT: RequestHandler = async (event) => {
	const { request, cookies } = event;

	if (!isSameOriginRequest(event)) {
		return json({ error: 'Origine non consentita' }, { status: 403 });
	}

	const user = readSession(cookies);
	if (!user) {
		return json({ error: 'Non autorizzato: autenticazione richiesta.' }, { status: 401 });
	}

	const updated: Partial<Note> & { id: string } = await request.json();
	if (!updated.id) {
		return json({ error: 'ID nota mancante.' }, { status: 400 });
	}

	let oldNoteForCleanup: Note | null = null;
	let savedNote: Note | null = null;
	let accessDenied = false;
	let notFound = false;

	const result = await mutateJsonSafe<Note[]>(NOTES_FILE_PATH, [], (allNotes) => {
		const index = allNotes.findIndex((n) => n.id === updated.id);

		if (index === -1) {
			// Se la nota non esiste ancora sul server (es. creata offline), creala direttamente
			const now = new Date().toISOString();
			const noteContent = updated.content || '';
			const contentImages = Array.from(extractMediaFilenames([noteContent])).map((fn) => `/uploads/${fn}`);
			const explicitImages = Array.isArray(updated.images) ? updated.images : [];
			const combinedImages = Array.from(new Set([...explicitImages, ...contentImages]));

			const userNotes = allNotes.filter((n) => !n.userId || n.userId === user.userId);
			const maxOrder = userNotes.reduce((max, n) => Math.max(max, n.order ?? 0), 0);

			savedNote = {
				id: updated.id,
				userId: user.userId,
				title: updated.title?.trim() || 'Nuovo Appunto',
				content: noteContent,
				category: updated.category?.trim() || 'Generale & Varie',
				tags: Array.isArray(updated.tags) ? updated.tags.map((t) => String(t).trim()).filter(Boolean) : [],
				images: combinedImages,
				isPinned: Boolean(updated.isPinned),
				order: typeof updated.order === 'number' ? updated.order : maxOrder + 1,
				createdAt: updated.createdAt || now,
				updatedAt: now
			};

			allNotes.unshift(savedNote);
			return allNotes;
		}

		// Verifica appartenenza nota all'utente
		if (allNotes[index].userId && allNotes[index].userId !== user.userId && !user.isAdmin) {
			accessDenied = true;
			return allNotes;
		}

		const oldNote = allNotes[index];
		oldNoteForCleanup = oldNote;

		const newContent = updated.content !== undefined ? updated.content : oldNote.content;
		const contentImages = Array.from(extractMediaFilenames([newContent])).map((fn) => `/uploads/${fn}`);
		const explicitImages = Array.isArray(updated.images) ? updated.images : (oldNote.images || []);
		const newImages = Array.from(new Set([...explicitImages, ...contentImages]));

		const now = new Date().toISOString();
		const noteToSave: Note = {
			...allNotes[index],
			title: updated.title !== undefined ? updated.title.trim() : allNotes[index].title,
			content: newContent,
			category: updated.category !== undefined ? updated.category.trim() : allNotes[index].category,
			tags: Array.isArray(updated.tags)
				? updated.tags.map((t) => String(t).trim()).filter(Boolean)
				: allNotes[index].tags,
			images: newImages,
			isPinned: updated.isPinned !== undefined ? Boolean(updated.isPinned) : allNotes[index].isPinned,
			order: typeof updated.order === 'number' ? updated.order : allNotes[index].order,
			updatedAt: now
		};

		allNotes[index] = noteToSave;
		savedNote = noteToSave;
		return allNotes;
	});

	if (accessDenied) {
		return json({ error: 'Accesso negato a questa nota.' }, { status: 403 });
	}

	if (!savedNote || !result.success) {
		return json({ error: 'Impossibile aggiornare la nota.' }, { status: 500 });
	}

	invalidateNotes();

	// Cancella fisicamente dal disco i file immagine rimossi da questa nota
	if (oldNoteForCleanup) {
		await cleanupUnusedImagesOnNoteUpdate(oldNoteForCleanup, savedNote);
	}

	return json(savedNote);
};

export const DELETE: RequestHandler = async (event) => {
	const { url, cookies } = event;

	if (!isSameOriginRequest(event)) {
		return json({ error: 'Origine non consentita' }, { status: 403 });
	}

	const user = readSession(cookies);
	if (!user) {
		return json({ error: 'Non autorizzato: autenticazione richiesta.' }, { status: 401 });
	}

	const id = url.searchParams.get('id');
	if (!id) {
		return json({ error: 'Parametro id mancante.' }, { status: 400 });
	}

	let deletedNote: Note | null = null;
	let accessDenied = false;

	const result = await mutateJsonSafe<Note[]>(NOTES_FILE_PATH, [], (allNotes) => {
		const note = allNotes.find((n) => n.id === id);
		if (!note) {
			return allNotes;
		}

		if (note.userId && note.userId !== user.userId && !user.isAdmin) {
			accessDenied = true;
			return allNotes;
		}

		deletedNote = note;
		return allNotes.filter((n) => n.id !== id);
	});

	if (accessDenied) {
		return json({ error: 'Accesso negato: nota non appartenente al tuo account.' }, { status: 403 });
	}

	if (!result.success) {
		return json({ error: 'Impossibile eliminare la nota.' }, { status: 500 });
	}

	invalidateNotes();

	if (deletedNote) {
		// Elimina tutti i file immagine fisici associati a questa nota (se non usati altrove)
		await deleteImagesForNote(deletedNote);
	}

	return json({ success: true, id });
};

// PATCH per riordinamento batch di più note in modo concorrente e sicuro
export const PATCH: RequestHandler = async (event) => {
	const { request, cookies } = event;

	if (!isSameOriginRequest(event)) {
		return json({ error: 'Origine non consentita' }, { status: 403 });
	}

	const user = readSession(cookies);
	if (!user) {
		return json({ error: 'Non autorizzato: autenticazione richiesta.' }, { status: 401 });
	}

	const payload: { items: { id: string; order: number }[] } = await request.json();
	if (!payload || !Array.isArray(payload.items)) {
		return json({ error: 'Formato batch non valido.' }, { status: 400 });
	}

	const orderMap = new Map(payload.items.map((i) => [i.id, i.order]));

	const result = await mutateJsonSafe<Note[]>(NOTES_FILE_PATH, [], (allNotes) => {
		for (let i = 0; i < allNotes.length; i++) {
			const targetNote = allNotes[i];
			if (orderMap.has(targetNote.id)) {
				if (!targetNote.userId || targetNote.userId === user.userId || user.isAdmin) {
					allNotes[i].order = orderMap.get(targetNote.id)!;
				}
			}
		}
		return allNotes;
	});

	if (!result.success) {
		return json({ error: 'Impossibile salvare il nuovo ordine.' }, { status: 500 });
	}

	invalidateNotes();
	return json({ success: true });
};
