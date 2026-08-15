import { json, type RequestHandler } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { readSession } from '$lib/server/auth';
import { isSameOriginRequest } from '$lib/server/csrf';
import { invalidateNotes, readNotes } from '$lib/server/dataCache';
import {
	deleteImagesForNote,
	cleanupUnusedImagesOnNoteUpdate,
	extractMediaFilenames
} from '$lib/server/mediaCleanup';
import type { Note } from '$lib/types/notes';

const NOTES_FILE_PATH = path.resolve('data/notes.json');

async function writeNotesToFile(notes: Note[]): Promise<boolean> {
	try {
		const dir = path.dirname(NOTES_FILE_PATH);
		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(NOTES_FILE_PATH, JSON.stringify(notes, null, 2), 'utf-8');
		invalidateNotes();
		return true;
	} catch (err) {
		console.error('Errore scrittura data/notes.json:', err);
		return false;
	}
}

export const GET: RequestHandler = async ({ request, cookies }) => {
	const user = readSession(cookies);
	if (!user) {
		return json({ error: 'Non autorizzato: autenticazione richiesta.' }, { status: 401 });
	}

	const allNotes = await readNotes<Note[]>();
	// Restituisce le note associate all'utente corrente
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

	const allNotes = await readNotes<Note[]>();
	const userNotes = allNotes.filter((n) => !n.userId || n.userId === user.userId);
	const maxOrder = userNotes.reduce((max, n) => Math.max(max, n.order ?? 0), 0);

	const now = new Date().toISOString();
	const noteContent = payload.content || '';
	const contentImages = Array.from(extractMediaFilenames([noteContent])).map((fn) => `/uploads/${fn}`);
	const explicitImages = Array.isArray(payload.images) ? payload.images : [];
	const combinedImages = Array.from(new Set([...explicitImages, ...contentImages]));

	const newNote: Note = {
		id: payload.id || crypto.randomUUID(),
		userId: user.userId,
		title: payload.title.trim(),
		content: noteContent,
		category: payload.category?.trim() || 'Generale & Varie',
		tags: Array.isArray(payload.tags) ? payload.tags.map((t) => String(t).trim()).filter(Boolean) : [],
		images: combinedImages,
		isPinned: Boolean(payload.isPinned),
		order: typeof payload.order === 'number' ? payload.order : maxOrder + 1,
		createdAt: payload.createdAt || now,
		updatedAt: now
	};

	allNotes.unshift(newNote);
	const saved = await writeNotesToFile(allNotes);
	if (!saved) {
		return json({ error: 'Impossibile salvare la nota su disco.' }, { status: 500 });
	}

	return json(newNote, { status: 201 });
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

	const allNotes = await readNotes<Note[]>();
	const index = allNotes.findIndex((n) => n.id === updated.id);

	if (index === -1) {
		return json({ error: 'Nota non trovata.' }, { status: 404 });
	}

	// Verifica appartenenza nota all'utente
	if (allNotes[index].userId && allNotes[index].userId !== user.userId && !user.isAdmin) {
		return json({ error: 'Accesso negato a questa nota.' }, { status: 403 });
	}

	const oldNote = allNotes[index];
	const newContent = updated.content !== undefined ? updated.content : oldNote.content;
	const contentImages = Array.from(extractMediaFilenames([newContent])).map((fn) => `/uploads/${fn}`);
	const explicitImages = Array.isArray(updated.images)
		? updated.images
		: (oldNote.images || []);
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

	// Cancella fisicamente dal disco i file immagine rimossi da questa nota
	await cleanupUnusedImagesOnNoteUpdate(oldNote, noteToSave);

	allNotes[index] = noteToSave;

	const saved = await writeNotesToFile(allNotes);
	if (!saved) {
		return json({ error: 'Impossibile aggiornare la nota.' }, { status: 500 });
	}

	return json(allNotes[index]);
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

	const allNotes = await readNotes<Note[]>();
	const noteToDelete = allNotes.find((n) => n.id === id);

	if (!noteToDelete) {
		return json({ error: 'Nota non trovata.' }, { status: 404 });
	}

	if (noteToDelete.userId && noteToDelete.userId !== user.userId && !user.isAdmin) {
		return json({ error: 'Accesso negato: nota non appartenente al tuo account.' }, { status: 403 });
	}

	// Elimina tutti i file immagine fisici associati a questa nota (se non usati altrove)
	await deleteImagesForNote(noteToDelete);

	const filtered = allNotes.filter((n) => n.id !== id);
	const saved = await writeNotesToFile(filtered);
	if (!saved) {
		return json({ error: 'Impossibile eliminare la nota.' }, { status: 500 });
	}

	return json({ success: true, id });
};

// PATCH per riordinamento batch di più note
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

	const allNotes = await readNotes<Note[]>();
	const orderMap = new Map(payload.items.map((i) => [i.id, i.order]));

	for (let i = 0; i < allNotes.length; i++) {
		const targetNote = allNotes[i];
		if (orderMap.has(targetNote.id)) {
			if (!targetNote.userId || targetNote.userId === user.userId || user.isAdmin) {
				allNotes[i].order = orderMap.get(targetNote.id)!;
			}
		}
	}

	const saved = await writeNotesToFile(allNotes);
	if (!saved) {
		return json({ error: 'Impossibile salvare il nuovo ordine.' }, { status: 500 });
	}

	return json({ success: true });
};
