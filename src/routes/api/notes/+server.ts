import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { notes } from '$lib/server/db/schema';
import { eq, desc, or, and, isNull } from 'drizzle-orm';
import {
	moveImagesToTrash,
	restoreImagesFromTrash,
	permanentlyDeleteImages,
	extractMediaFilenames
} from '$lib/server/mediaCleanup';
import type { Note } from '$lib/types/notes';

export const GET: RequestHandler = async ({ url, locals }) => {
	const user = locals.user;
	const singleId = url.searchParams.get('id');
	const shareId = url.searchParams.get('shareId');
	const isTrashRequest = url.searchParams.get('trash') === 'true';

	try {
		// 1. Se viene richiesta una specifica nota tramite ID o link di condivisione
		if (singleId || shareId) {
			const query = singleId
				? eq(notes.id, singleId)
				: eq(notes.shareId, shareId!);

			const found = await db.select().from(notes).where(query).limit(1);
			if (found.length > 0) {
				const n = found[0];
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
						isArchived: Boolean(n.isArchived),
						archivedAt: n.archivedAt ? n.archivedAt.toISOString() : undefined,
						isPublic: n.isPublic,
						shareId: n.shareId || undefined,
						order: n.order,
						isDeleted: Boolean(n.isDeleted),
						deletedAt: n.deletedAt ? n.deletedAt.toISOString() : undefined,
						createdAt: n.createdAt ? n.createdAt.toISOString() : new Date().toISOString(),
						updatedAt: n.updatedAt ? n.updatedAt.toISOString() : new Date().toISOString()
					};
					return json(noteObj);
				}
				return json({ error: 'Nota privata o non accessibile' }, { status: 403 });
			}
			return json({ error: 'Nota non trovata' }, { status: 404 });
		}

		// 2. Lettura lista note per utente autenticato
		let list;
		if (user) {
			if (user.isAdmin || user.role === 'admin') {
				list = await db
					.select()
					.from(notes)
					.where(
						and(
							eq(notes.isDeleted, isTrashRequest),
							or(
								eq(notes.userId, user.id),
								eq(notes.userId, '691289686093725736'),
								eq(notes.userId, 'local-user'),
								isNull(notes.userId)
							)
						)
					)
					.orderBy(desc(notes.order), desc(notes.createdAt));
			} else {
				list = await db
					.select()
					.from(notes)
					.where(
						and(
							eq(notes.isDeleted, isTrashRequest),
							eq(notes.userId, user.id)
						)
					)
					.orderBy(desc(notes.order), desc(notes.createdAt));
			}
		} else {
			list = await db
				.select()
				.from(notes)
				.where(and(eq(notes.isPublic, true), eq(notes.isDeleted, false)))
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
			isArchived: Boolean(n.isArchived),
			archivedAt: n.archivedAt ? n.archivedAt.toISOString() : undefined,
			isPublic: n.isPublic,
			shareId: n.shareId || undefined,
			order: n.order,
			isDeleted: Boolean(n.isDeleted),
			deletedAt: n.deletedAt ? n.deletedAt.toISOString() : undefined,
			createdAt: n.createdAt ? n.createdAt.toISOString() : new Date().toISOString(),
			updatedAt: n.updatedAt ? n.updatedAt.toISOString() : new Date().toISOString()
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

		const noteId = payload.id || crypto.randomUUID();
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
				isArchived: Boolean(payload.isArchived),
				archivedAt: payload.isArchived ? (payload.archivedAt ? new Date(payload.archivedAt) : now) : null,
				isPublic: Boolean(payload.isPublic),
				shareId: payload.shareId || noteId,
				order: typeof payload.order === 'number' ? payload.order : 0,
				isDeleted: false,
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
					isArchived: Boolean(payload.isArchived),
					archivedAt: payload.isArchived ? (payload.archivedAt ? new Date(payload.archivedAt) : now) : null,
					isPublic: Boolean(payload.isPublic),
					order: typeof payload.order === 'number' ? payload.order : 0,
					isDeleted: false,
					deletedAt: null,
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
			isArchived: Boolean(inserted.isArchived),
			archivedAt: inserted.archivedAt ? inserted.archivedAt.toISOString() : undefined,
			isPublic: inserted.isPublic,
			shareId: inserted.shareId || undefined,
			order: inserted.order,
			isDeleted: Boolean(inserted.isDeleted),
			deletedAt: inserted.deletedAt ? inserted.deletedAt.toISOString() : undefined,
			createdAt: inserted.createdAt ? inserted.createdAt.toISOString() : new Date().toISOString(),
			updatedAt: inserted.updatedAt ? inserted.updatedAt.toISOString() : new Date().toISOString()
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
					isArchived: Boolean(updated.isArchived),
					archivedAt: updated.isArchived ? (updated.archivedAt ? new Date(updated.archivedAt) : now) : null,
					isPublic: Boolean(updated.isPublic),
					shareId: updated.shareId || updated.id,
					order: typeof updated.order === 'number' ? updated.order : 0,
					isDeleted: false,
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
				isArchived: Boolean(created.isArchived),
				archivedAt: created.archivedAt ? created.archivedAt.toISOString() : undefined,
				isPublic: created.isPublic,
				shareId: created.shareId || undefined,
				order: created.order,
				isDeleted: Boolean(created.isDeleted),
				deletedAt: created.deletedAt ? created.deletedAt.toISOString() : undefined,
				createdAt: created.createdAt ? created.createdAt.toISOString() : new Date().toISOString(),
				updatedAt: created.updatedAt ? created.updatedAt.toISOString() : new Date().toISOString()
			};
			return json(formatted);
		}

		const isNowArchived = updated.isArchived !== undefined ? Boolean(updated.isArchived) : existing[0].isArchived;

		const [saved] = await db
			.update(notes)
			.set({
				title: updated.title !== undefined ? updated.title.trim() : existing[0].title,
				content: newContent,
				category: updated.category !== undefined ? updated.category.trim() : existing[0].category,
				tags: Array.isArray(updated.tags) ? updated.tags : (existing[0].tags as string[]) || [],
				images: newImages,
				isPinned: updated.isPinned !== undefined ? Boolean(updated.isPinned) : existing[0].isPinned,
				isArchived: isNowArchived,
				archivedAt: updated.isArchived !== undefined
					? (updated.isArchived ? (updated.archivedAt ? new Date(updated.archivedAt) : now) : null)
					: existing[0].archivedAt,
				isPublic: updated.isPublic !== undefined ? Boolean(updated.isPublic) : existing[0].isPublic,
				shareId: updated.shareId !== undefined ? updated.shareId : existing[0].shareId || existing[0].id,
				order: typeof updated.order === 'number' ? updated.order : existing[0].order,
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
			isArchived: Boolean(saved.isArchived),
			archivedAt: saved.archivedAt ? saved.archivedAt.toISOString() : undefined,
			isPublic: saved.isPublic,
			shareId: saved.shareId || undefined,
			order: saved.order,
			isDeleted: Boolean(saved.isDeleted),
			deletedAt: saved.deletedAt ? saved.deletedAt.toISOString() : undefined,
			createdAt: saved.createdAt ? saved.createdAt.toISOString() : new Date().toISOString(),
			updatedAt: saved.updatedAt ? saved.updatedAt.toISOString() : new Date().toISOString()
		};

		return json(formatted);
	} catch (err: any) {
		console.error('Errore aggiornamento nota:', err);
		return json({ error: err.message || 'Impossibile aggiornare la nota' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	try {
		const payload = await request.json();

		if (payload.action === 'restore' && payload.id) {
			const existing = await db.select().from(notes).where(eq(notes.id, payload.id)).limit(1);
			if (existing.length > 0) {
				const n = existing[0];
				if (n.userId && user && n.userId !== user.id && user.role !== 'admin' && !user.isAdmin) {
					return json({ error: 'Non autorizzato a ripristinare questa nota.' }, { status: 403 });
				}
				await restoreImagesFromTrash(n).catch(() => {});
			}

			const [restored] = await db
				.update(notes)
				.set({
					isDeleted: false,
					deletedAt: null,
					updatedAt: new Date()
				})
				.where(eq(notes.id, payload.id))
				.returning();

			return json({ success: true, note: restored });
		}

		if ((payload.action === 'archive' || payload.action === 'unarchive') && payload.id) {
			const isArchived = payload.action === 'archive';
			const [updated] = await db
				.update(notes)
				.set({
					isArchived,
					archivedAt: isArchived ? new Date() : null,
					updatedAt: new Date()
				})
				.where(eq(notes.id, payload.id))
				.returning();

			return json({ success: true, note: updated });
		}

		if (payload && Array.isArray(payload.items)) {
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
		}

		return json({ error: 'Richiesta non valida.' }, { status: 400 });
	} catch (err: any) {
		console.error('Errore patch note:', err);
		return json({ error: err.message || 'Errore elaborazione richiesta' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
	const user = locals.user;
	const id = url.searchParams.get('id');
	const isPermanent = url.searchParams.get('permanent') === 'true';

	if (!id) {
		return json({ error: 'Parametro id mancante.' }, { status: 400 });
	}

	try {
		const existing = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
		if (existing.length === 0) {
			return json({ error: 'Nota non trovata' }, { status: 404 });
		}

		const n = existing[0];
		if (n.userId && user && n.userId !== user.id && user.role !== 'admin' && !user.isAdmin) {
			return json({ error: 'Non autorizzato ad eliminare questa nota.' }, { status: 403 });
		}

		if (isPermanent) {
			await permanentlyDeleteImages(n).catch(() => {});
			await db.delete(notes).where(eq(notes.id, id));
			return json({ success: true, id, permanent: true });
		} else {
			await moveImagesToTrash(n).catch(() => {});
			await db
				.update(notes)
				.set({
					isDeleted: true,
					deletedAt: new Date(),
					updatedAt: new Date()
				})
				.where(eq(notes.id, id));

			return json({ success: true, id, trash: true });
		}
	} catch (err: any) {
		console.error('Errore eliminazione nota:', err);
		return json({ error: err.message || 'Impossibile eliminare la nota' }, { status: 500 });
	}
};
