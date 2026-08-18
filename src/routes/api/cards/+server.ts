import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { cards } from '$lib/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { isAuthorizedAdmin } from '$lib/server/auth';
import { logAdminAction } from '$lib/server/adminLogger';
import {
	moveImagesToTrash,
	restoreImagesFromTrash,
	permanentlyDeleteImages,
	cleanupUnusedImagesOnCardUpdate
} from '$lib/server/mediaCleanup';
import type { Card } from '$lib/types/cards';

export const GET: RequestHandler = async ({ url }) => {
	const isTrashRequest = url.searchParams.get('trash') === 'true';

	try {
		const list = await db
			.select()
			.from(cards)
			.where(eq(cards.isDeleted, isTrashRequest))
			.orderBy(desc(cards.createdAt));

		const formatted: Card[] = list.map((c) => ({
			id: c.id,
			title: c.title,
			hasAcronym: Boolean(c.hasAcronym),
			acronym: c.acronym || undefined,
			description: c.description,
			category: c.category,
			images: (c.images as string[]) || [],
			tags: (c.tags as string[]) || [],
			showInWiki: c.showInWiki !== false,
			gameModes: (c.gameModes as string[]) || ['flashcard', 'quiz', 'reels', 'scrittura'],
			isDeleted: Boolean(c.isDeleted),
			deletedAt: c.deletedAt ? c.deletedAt.toISOString() : undefined,
			createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
			updatedAt: c.updatedAt ? c.updatedAt.toISOString() : new Date().toISOString()
		}));

		return json(formatted, {
			headers: { 'Cache-Control': 'no-cache' }
		});
	} catch (err) {
		console.error('Errore lettura schede da database:', err);
		return json([], { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!isAuthorizedAdmin(locals.user)) {
		return json(
			{ error: 'Accesso negato: Soltanto gli amministratori possono inserire nuove schede.' },
			{ status: 403 }
		);
	}

	try {
		const newCard: Partial<Card> = await request.json();

		const title = (newCard.title || '').trim();
		const hasAcronym = Boolean(newCard.hasAcronym);
		const acronym = (newCard.acronym || '').trim();
		const description = (newCard.description || '').trim();
		const category = (newCard.category || '').trim();
		const images = Array.isArray(newCard.images)
			? newCard.images.filter((img): img is string => typeof img === 'string' && img.trim().length > 0)
			: [];
		const tags = Array.isArray(newCard.tags) ? newCard.tags : [];
		const showInWiki = newCard.showInWiki !== false;
		const gameModes = Array.isArray(newCard.gameModes) && newCard.gameModes.length > 0
			? newCard.gameModes
			: ['flashcard', 'quiz', 'reels', 'scrittura'];

		const mainTitle = title;
		if (!mainTitle && images.length === 0) {
			return json(
				{ error: "Inserisci almeno un titolo, un acronimo o un'immagine per la scheda." },
				{ status: 400 }
			);
		}

		const cardId =
			newCard.id ||
			`card-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

		const now = new Date();
		const [inserted] = await db
			.insert(cards)
			.values({
				id: cardId,
				title: title,
				hasAcronym,
				acronym: acronym || null,
				description,
				category: category || 'Generale',
				images,
				tags,
				showInWiki,
				gameModes,
				isDeleted: false,
				createdAt: now,
				updatedAt: now
			})
			.onConflictDoUpdate({
				target: cards.id,
				set: {
					title: title,
					hasAcronym,
					acronym: acronym || null,
					description,
					category: category || 'Generale',
					images,
					tags,
					showInWiki,
					gameModes,
					isDeleted: false,
					deletedAt: null,
					updatedAt: now
				}
			})
			.returning();

		const formatted: Card = {
			id: inserted.id,
			title: inserted.title,
			hasAcronym: Boolean(inserted.hasAcronym),
			acronym: inserted.acronym || undefined,
			description: inserted.description,
			category: inserted.category,
			images: (inserted.images as string[]) || [],
			tags: (inserted.tags as string[]) || [],
			showInWiki: inserted.showInWiki !== false,
			gameModes: (inserted.gameModes as string[]) || ['flashcard', 'quiz', 'reels', 'scrittura'],
			isDeleted: Boolean(inserted.isDeleted),
			deletedAt: inserted.deletedAt ? inserted.deletedAt.toISOString() : undefined,
			createdAt: inserted.createdAt.toISOString(),
			updatedAt: inserted.updatedAt.toISOString()
		};

		await logAdminAction({
			userId: locals.user?.id || 'admin',
			userName: locals.user?.name || locals.user?.username || 'Admin',
			userAvatar: locals.user?.image,
			action: 'create_card',
			targetType: 'card',
			targetId: formatted.id,
			targetTitle: formatted.title || formatted.acronym || 'Nuova scheda',
			details: { category: formatted.category }
		});

		return json(formatted, { status: 201 });
	} catch (err: any) {
		console.error('Errore inserimento scheda nel database:', err);
		return json({ error: err.message || 'Errore durante il salvataggio della scheda' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!isAuthorizedAdmin(locals.user)) {
		return json(
			{ error: 'Accesso negato: Soltanto gli amministratori possono modificare le schede.' },
			{ status: 403 }
		);
	}

	try {
		const updatedCard: Partial<Card> = await request.json();
		if (!updatedCard.id) {
			return json({ error: 'ID card mancante' }, { status: 400 });
		}

		const existing = await db.select().from(cards).where(eq(cards.id, updatedCard.id)).limit(1);
		if (existing.length === 0) {
			return json({ error: 'Card non trovata' }, { status: 404 });
		}

		const oldCard = existing[0];
		const oldCardType: Card = {
			id: oldCard.id,
			title: oldCard.title,
			hasAcronym: Boolean(oldCard.hasAcronym),
			acronym: oldCard.acronym || undefined,
			description: oldCard.description,
			category: oldCard.category,
			images: (oldCard.images as string[]) || [],
			tags: (oldCard.tags as string[]) || [],
			showInWiki: oldCard.showInWiki !== false,
			gameModes: (oldCard.gameModes as string[]) || ['flashcard', 'quiz', 'reels', 'scrittura'],
			isDeleted: Boolean(oldCard.isDeleted),
			deletedAt: oldCard.deletedAt ? oldCard.deletedAt.toISOString() : undefined,
			createdAt: oldCard.createdAt.toISOString(),
			updatedAt: oldCard.updatedAt.toISOString()
		};

		const title = (updatedCard.title !== undefined ? updatedCard.title : oldCard.title || '').trim();
		const hasAcronym = updatedCard.hasAcronym !== undefined ? Boolean(updatedCard.hasAcronym) : Boolean(oldCard.hasAcronym);
		const acronym = (updatedCard.acronym !== undefined ? updatedCard.acronym : oldCard.acronym || '').trim();
		const description = (updatedCard.description !== undefined ? updatedCard.description : oldCard.description || '').trim();
		const category = (updatedCard.category !== undefined ? updatedCard.category : oldCard.category || '').trim();
		const images = Array.isArray(updatedCard.images)
			? updatedCard.images.filter((img): img is string => typeof img === 'string' && img.trim().length > 0)
			: (oldCard.images as string[]) || [];
		const tags = Array.isArray(updatedCard.tags) ? updatedCard.tags : (oldCard.tags as string[]) || [];
		const showInWiki = updatedCard.showInWiki !== undefined ? updatedCard.showInWiki : (oldCard.showInWiki !== false);
		const gameModes = Array.isArray(updatedCard.gameModes) && updatedCard.gameModes.length > 0
			? updatedCard.gameModes
			: ((oldCard.gameModes as string[]) || ['flashcard', 'quiz', 'reels', 'scrittura']);

		const now = new Date();
		const [updated] = await db
			.update(cards)
			.set({
				title: title,
				hasAcronym,
				acronym: acronym || null,
				description,
				category: category || oldCard.category || 'Generale',
				images,
				tags,
				showInWiki,
				gameModes,
				updatedAt: now
			})
			.where(eq(cards.id, updatedCard.id))
			.returning();

		const formatted: Card = {
			id: updated.id,
			title: updated.title,
			hasAcronym: Boolean(updated.hasAcronym),
			acronym: updated.acronym || undefined,
			description: updated.description,
			category: updated.category,
			images: (updated.images as string[]) || [],
			tags: (updated.tags as string[]) || [],
			showInWiki: updated.showInWiki !== false,
			gameModes: (updated.gameModes as string[]) || ['flashcard', 'quiz', 'reels', 'scrittura'],
			isDeleted: Boolean(updated.isDeleted),
			deletedAt: updated.deletedAt ? updated.deletedAt.toISOString() : undefined,
			createdAt: updated.createdAt.toISOString(),
			updatedAt: updated.updatedAt.toISOString()
		};

		// Pulisci le immagini rimosse in background
		await cleanupUnusedImagesOnCardUpdate(oldCardType, formatted).catch(() => {});

		await logAdminAction({
			userId: locals.user?.id || 'admin',
			userName: locals.user?.name || locals.user?.username || 'Admin',
			userAvatar: locals.user?.image,
			action: 'update_card',
			targetType: 'card',
			targetId: formatted.id,
			targetTitle: formatted.title || formatted.acronym || 'Scheda',
			details: {
				category: formatted.category,
				titleChanged: oldCard.title !== formatted.title
			}
		});

		return json(formatted);
	} catch (err: any) {
		console.error('Errore aggiornamento scheda nel database:', err);
		return json({ error: err.message || "Errore durante l'aggiornamento della scheda" }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
	if (!isAuthorizedAdmin(locals.user)) {
		return json({ error: 'Accesso negato: admin richiesto.' }, { status: 403 });
	}

	try {
		const { id, action } = await request.json();
		if (!id) return json({ error: 'ID mancante.' }, { status: 400 });

		if (action === 'restore') {
			const existing = await db.select().from(cards).where(eq(cards.id, id)).limit(1);
			if (existing.length > 0) {
				const card = existing[0];
				await restoreImagesFromTrash(card).catch(() => {});
			}

			const [restored] = await db
				.update(cards)
				.set({
					isDeleted: false,
					deletedAt: null,
					updatedAt: new Date()
				})
				.where(eq(cards.id, id))
				.returning();

			await logAdminAction({
				userId: locals.user?.id || 'admin',
				userName: locals.user?.name || locals.user?.username || 'Admin',
				userAvatar: locals.user?.image,
				action: 'restore_card',
				targetType: 'card',
				targetId: id,
				targetTitle: restored.title || restored.acronym || 'Scheda'
			});

			return json({ success: true, card: restored });
		}

		return json({ error: 'Azione non riconosciuta.' }, { status: 400 });
	} catch (err: any) {
		console.error('Errore patch card:', err);
		return json({ error: err.message || 'Errore ripristino scheda' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
	if (!isAuthorizedAdmin(locals.user)) {
		return json(
			{ error: 'Accesso negato: Soltanto gli amministratori possono eliminare le schede.' },
			{ status: 403 }
		);
	}

	const id = url.searchParams.get('id');
	const isPermanent = url.searchParams.get('permanent') === 'true';

	if (!id) {
		return json({ error: 'ID non specificato' }, { status: 400 });
	}

	try {
		const existing = await db.select().from(cards).where(eq(cards.id, id)).limit(1);
		if (existing.length === 0) {
			return json({ error: 'Scheda non trovata' }, { status: 404 });
		}

		const old = existing[0];

		if (isPermanent) {
			// Eliminazione definitiva: rimuovi immagini dal disco ed elimina riga da Postgres
			await permanentlyDeleteImages(old).catch(() => {});
			await db.delete(cards).where(eq(cards.id, id));

			await logAdminAction({
				userId: locals.user?.id || 'admin',
				userName: locals.user?.name || locals.user?.username || 'Admin',
				userAvatar: locals.user?.image,
				action: 'permanent_delete_card',
				targetType: 'card',
				targetId: id,
				targetTitle: old.title || old.acronym || 'Scheda'
			});

			return json({ success: true, id, permanent: true });
		} else {
			// Soft-delete: sposta nel cestino e sposta immagini nella cartella trash
			await moveImagesToTrash(old).catch(() => {});
			await db
				.update(cards)
				.set({
					isDeleted: true,
					deletedAt: new Date(),
					updatedAt: new Date()
				})
				.where(eq(cards.id, id));

			await logAdminAction({
				userId: locals.user?.id || 'admin',
				userName: locals.user?.name || locals.user?.username || 'Admin',
				userAvatar: locals.user?.image,
				action: 'trash_card',
				targetType: 'card',
				targetId: id,
				targetTitle: old.title || old.acronym || 'Scheda'
			});

			return json({ success: true, id, trash: true });
		}
	} catch (err: any) {
		console.error('Errore eliminazione scheda dal database:', err);
		return json({ error: err.message || "Errore durante l'eliminazione della scheda" }, { status: 500 });
	}
};
