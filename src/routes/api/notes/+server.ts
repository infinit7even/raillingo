import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { notes } from '$lib/server/db/schema';
import { eq, desc, or, and, isNull } from 'drizzle-orm';
import {
	deleteImagesForNote,
	cleanupUnusedImagesOnNoteUpdate,
	extractMediaFilenames
} from '$lib/server/mediaCleanup';
import type { Note } from '$lib/types/notes';

export const GET: RequestHandler = async ({ url, locals }) => {
	const user = locals.user;
	const singleId = url.searchParams.get('id');
	const shareId = url.searchParams.get('shareId');

	try {
		// 1. Se viene richiesta una specifica nota tramite ID o link di condivisione
		if (singleId || shareId) {
			const query = singleId
				? eq(notes.id, singleId)
				: eq(notes.shareId, shareId!);

			const found = await db.select().from(notes).where(query).limit(1);
			if (found.length > 0) {
				const n = found[0];
				// Consenti se è pubblica, se appartiene all'utente o se è admin
				if (n.isPublic || (user && n.userId === user.id) || user?.role === 'admin' || !n.userId) {
					const noteObj: Note = {
						id: n.id,
						userId: n.userId || undefined,
						title: n.title,
						content: n.content,
						category: n.category,
						tags: (n.tags as string[]) || [],
						images: (n.images as string[]) || [],
						isPinned: n.isPinned,
						isPublic: n.isPublic,
						shareId: n.shareId || undefined,
						order: n.order,
						createdAt: n.createdAt.toISOString(),
						updatedAt: n.updatedAt.toISOString()
					};
					return json(noteObj);
				}
				return json({ error: 'Nota privata o non accessibile' }, { status: 403 });
			}
			return json({ error: 'Nota non trovata' }, { status: 404 });
		}

		// 2. Lettura lista note per utente autenticato o note generali
		let list;
		if (user) {
			if (user.isAdmin || user.role === 'admin') {
				list = await db
					.select()
					.from(notes)
					.where(
						or(
							eq(notes.userId, user.id),
							eq(notes.userId, '691289686093725736'),
							eq(notes.userId, 'local-user'),
							isNull(notes.userId)
						)
					)
					.orderBy(desc(notes.order), desc(notes.createdAt));
			} else {
				list = await db
					.select()
					.from(notes)
					.where(eq(notes.userId, user.id))
					.orderBy(desc(notes.order), desc(notes.createdAt));
			}
		} else {
			list = await db
				.select()
				.from(notes)
				.where(eq(notes.isPublic, true))
				.orderBy(desc(notes.order), desc(notes.createdAt));
		}

		const formatted: Note[] = list.map((n) => ({
			id: n.id,
			userId: n.userId || undefined,
			title: n.title,
			content: n.content,
			category: n.category,
			tags: (n.tags as string[]) || [],
			images: (n.images as string[]) || [],
			isPinned: n.isPinned,
			isPublic: n.isPublic,
			shareId: n.shareId || undefined,
			order: n.order,
			createdAt: n.createdAt.toISOString(),
			updatedAt: n.updatedAt.toISOString()
		}));

		return json(formatted, {
			headers: { 'Cache-Control': 'no-cache' }
		});
	} catch (err) {
		console.error('Errore lettura note da PostgreSQL:', err);
		return json([], { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	const payload: Partial<Note> = await request.json();

	if (!payload.title || typeof payload.title !== 'string' || !payload.title.trim()) {
		return json({ error: 'Il titolo della nota è obbligatorio.' }, { status: 400 });
	}

	try {
		const now = new Date();
		const noteContent = payload.content || '';
		const contentImages = Array.from(extractMediaFilenames([noteContent])).map((fn) => `/uploads/${fn}`);
		const explicitImages = Array.isArray(payload.images) ? payload.images : [];
		const combinedImages = Array.from(new Set([...explicitImages, ...contentImages]));

		const noteId = payload.id || `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
		const userId = user?.id || payload.userId || 'local-user';

		const [inserted] = await db
			.insert(notes)
			.values({
				id: noteId,
				userId,
				title: payload.title.trim(),
				content: noteContent,
				category: payload.category?.trim() || 'Normativa RFI',
				tags: Array.isArray(payload.tags) ? payload.tags : [],
				images: combinedImages,
				isPinned: Boolean(payload.isPinned),
				isPublic: Boolean(payload.isPublic),
				shareId: payload.shareId || noteId,
				order: typeof payload.order === 'number' ? payload.order : 0,
				createdAt: payload.createdAt ? new Date(payload.createdAt) : now,
				updatedAt: now
			})
			.onConflictDoUpdate({
				target: notes.id,
				set: {
					title: payload.title.trim(),
					content: noteContent,
					category: payload.category?.trim() || 'Normativa RFI',
					tags: Array.isArray(payload.tags) ? payload.tags : [],
					images: combinedImages,
					isPinned: Boolean(payload.isPinned),
					isPublic: Boolean(payload.isPublic),
					order: typeof payload.order === 'number' ? payload.order : 0,
					updatedAt: now
				}
			})
			.returning();

		const formatted: Note = {
			id: inserted.id,
			userId: inserted.userId || undefined,
			title: inserted.title,
			content: inserted.content,
			category: inserted.category,
			tags: (inserted.tags as string[]) || [],
			images: (inserted.images as string[]) || [],
			isPinned: inserted.isPinned,
			isPublic: inserted.isPublic,
			shareId: inserted.shareId || undefined,
			order: inserted.order,
			createdAt: inserted.createdAt.toISOString(),
			updatedAt: inserted.updatedAt.toISOString()
		};

		return json(formatted, { status: 201 });
	} catch (err: any) {
		console.error('Errore inserimento nota su database:', err);
		return json({ error: err.message || 'Impossibile salvare la nota' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	const updated: Partial<Note> & { id: string } = await request.json();

	if (!updated.id) {
		return json({ error: 'ID nota mancante.' }, { status: 400 });
	}

	try {
		const existing = await db.select().from(notes).where(eq(notes.id, updated.id)).limit(1);

		const now = new Date();
		const newContent = updated.content !== undefined ? updated.content : (existing[0]?.content || '');
		const contentImages = Array.from(extractMediaFilenames([newContent])).map((fn) => `/uploads/${fn}`);
		const explicitImages = Array.isArray(updated.images)
			? updated.images
			: ((existing[0]?.images as string[]) || []);
		const newImages = Array.from(new Set([...explicitImages, ...contentImages]));

		if (existing.length === 0) {
			// Se la nota non esiste ancora sul server (creata offline), inseriscila
			const [created] = await db
				.insert(notes)
				.values({
					id: updated.id,
					userId: user?.id || updated.userId || 'local-user',
					title: updated.title?.trim() || 'Nuovo Appunto',
					content: newContent,
					category: updated.category?.trim() || 'Normativa RFI',
					tags: Array.isArray(updated.tags) ? updated.tags : [],
					images: newImages,
					isPinned: Boolean(updated.isPinned),
					isPublic: Boolean(updated.isPublic),
					shareId: updated.shareId || updated.id,
					order: typeof updated.order === 'number' ? updated.order : 0,
					createdAt: updated.createdAt ? new Date(updated.createdAt) : now,
					updatedAt: now
				})
				.returning();

			const formatted: Note = {
				id: created.id,
				userId: created.userId || undefined,
				title: created.title,
				content: created.content,
				category: created.category,
				tags: (created.tags as string[]) || [],
				images: (created.images as string[]) || [],
				isPinned: created.isPinned,
				isPublic: created.isPublic,
				shareId: created.shareId || undefined,
				order: created.order,
				createdAt: created.createdAt.toISOString(),
				updatedAt: created.updatedAt.toISOString()
			};
			return json(formatted);
		}

		const oldNote = existing[0];
		const oldNoteType: Note = {
			id: oldNote.id,
			userId: oldNote.userId || undefined,
			title: oldNote.title,
			content: oldNote.content,
			category: oldNote.category,
			tags: (oldNote.tags as string[]) || [],
			images: (oldNote.images as string[]) || [],
			isPinned: oldNote.isPinned,
			isPublic: oldNote.isPublic,
			shareId: oldNote.shareId || undefined,
			order: oldNote.order,
			createdAt: oldNote.createdAt.toISOString(),
			updatedAt: oldNote.updatedAt.toISOString()
		};

		const [saved] = await db
			.update(notes)
			.set({
				title: updated.title !== undefined ? updated.title.trim() : oldNote.title,
				content: newContent,
				category: updated.category !== undefined ? updated.category.trim() : oldNote.category,
				tags: Array.isArray(updated.tags) ? updated.tags : (oldNote.tags as string[]) || [],
				images: newImages,
				isPinned: updated.isPinned !== undefined ? Boolean(updated.isPinned) : oldNote.isPinned,
				isPublic: updated.isPublic !== undefined ? Boolean(updated.isPublic) : oldNote.isPublic,
				shareId: updated.shareId !== undefined ? updated.shareId : oldNote.shareId || oldNote.id,
				order: typeof updated.order === 'number' ? updated.order : oldNote.order,
				updatedAt: now
			})
			.where(eq(notes.id, updated.id))
			.returning();

		const formatted: Note = {
			id: saved.id,
			userId: saved.userId || undefined,
			title: saved.title,
			content: saved.content,
			category: saved.category,
			tags: (saved.tags as string[]) || [],
			images: (saved.images as string[]) || [],
			isPinned: saved.isPinned,
			isPublic: saved.isPublic,
			shareId: saved.shareId || undefined,
			order: saved.order,
			createdAt: saved.createdAt.toISOString(),
			updatedAt: saved.updatedAt.toISOString()
		};

		// Pulisci le immagini rimosse in background
		await cleanupUnusedImagesOnNoteUpdate(oldNoteType, formatted).catch(() => {});

		return json(formatted);
	} catch (err: any) {
		console.error('Errore aggiornamento nota:', err);
		return json({ error: err.message || 'Impossibile aggiornare la nota' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
	const user = locals.user;
	const id = url.searchParams.get('id');
	if (!id) {
		return json({ error: 'Parametro id mancante.' }, { status: 400 });
	}

	try {
		const existing = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
		if (existing.length > 0) {
			const n = existing[0];
			if (n.userId && user && n.userId !== user.id && user.role !== 'admin' && !user.isAdmin) {
				return json({ error: 'Non autorizzato ad eliminare questa nota.' }, { status: 403 });
			}

			const noteType: Note = {
				id: n.id,
				userId: n.userId || undefined,
				title: n.title,
				content: n.content,
				category: n.category,
				tags: (n.tags as string[]) || [],
				images: (n.images as string[]) || [],
				isPinned: n.isPinned,
				isPublic: n.isPublic,
				shareId: n.shareId || undefined,
				order: n.order,
				createdAt: n.createdAt.toISOString(),
				updatedAt: n.updatedAt.toISOString()
			};
			await deleteImagesForNote(noteType).catch(() => {});
		}

		await db.delete(notes).where(eq(notes.id, id));
		return json({ success: true, id });
	} catch (err: any) {
		console.error('Errore eliminazione nota:', err);
		return json({ error: err.message || 'Impossibile eliminare la nota' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	try {
		const payload: { items: { id: string; order: number }[] } = await request.json();
		if (!payload || !Array.isArray(payload.items)) {
			return json({ error: 'Formato batch non valido.' }, { status: 400 });
		}

		for (const item of payload.items) {
			if (user?.role === 'admin' || user?.isAdmin) {
				await db.update(notes).set({ order: item.order }).where(eq(notes.id, item.id));
			} else if (user) {
				await db
					.update(notes)
					.set({ order: item.order })
					.where(and(eq(notes.id, item.id), eq(notes.userId, user.id)));
			}
		}

		return json({ success: true });
	} catch (err: any) {
		console.error('Errore riordinamento note:', err);
		return json({ error: err.message || 'Impossibile aggiornare ordine' }, { status: 500 });
	}
};
