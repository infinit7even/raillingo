import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { notes } from '$lib/server/db/schema';
import { eq, or, desc } from 'drizzle-orm';
import type { Note } from '$lib/types/notes';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user || null;
	const error = url.searchParams.get('error');
	const sharedNoteId = url.searchParams.get('id') || url.searchParams.get('shareId');

	let initialNotes: Note[] = [];
	let sharedNote: Note | null = null;

	try {
		// 1. Se c'è un ID condiviso nell'URL, cercalo
		if (sharedNoteId) {
			const found = await db
				.select()
				.from(notes)
				.where(or(eq(notes.id, sharedNoteId), eq(notes.shareId, sharedNoteId)))
				.limit(1);

			if (found.length > 0) {
				const n = found[0];
				if (n.isPublic || (user && n.userId === user.id) || user?.role === 'admin' || !n.userId) {
					sharedNote = {
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
				}
			}
		}

		// 2. Carica le note dell'utente se autenticato
		if (user) {
			const dbList = await db
				.select()
				.from(notes)
				.where(or(eq(notes.userId, user.id), eq(notes.userId, '691289686093725736')))
				.orderBy(desc(notes.order), desc(notes.createdAt));

			initialNotes = dbList.map((n) => ({
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
		} else if (sharedNote) {
			initialNotes = [sharedNote];
		}
	} catch (e) {
		console.error('Errore lettura note SSR da PostgreSQL:', e);
	}

	return {
		user,
		initialNotes,
		sharedNote,
		sharedNoteId,
		error
	};
};
