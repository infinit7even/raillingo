import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { cards } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { isAuthorizedAdmin } from '$lib/server/auth';
import { logAdminAction } from '$lib/server/adminLogger';
import type { Card } from '$lib/types/cards';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;
	if (!isAuthorizedAdmin(locals.user)) {
		return json({ error: 'Accesso negato: richiesta riservata agli amministratori.' }, { status: 403 });
	}

	try {
		const body = await event.request.json();
		const { mode, cards: importedCards } = body as { mode: 'merge' | 'replace'; cards: Card[] };

		if (!Array.isArray(importedCards)) {
			return json({ error: 'Formato file di backup non valido: array schede mancante.' }, { status: 400 });
		}

		if (mode === 'replace') {
			// Sostituisce tutto: elimina le schede correnti e reinserisce quelle del backup
			await db.delete(cards);
		}

		let insertedCount = 0;
		let updatedCount = 0;

		for (const c of importedCards) {
			if (!c.title || !c.title.trim()) continue;

			const cleanTitle = c.title.trim();
			const cleanDesc = (c.description || '').trim();
			const cleanCategory = (c.category || 'Normativa RFI').trim();
			const cardId = c.id && c.id.trim() ? c.id.trim() : crypto.randomUUID();

			if (mode === 'merge') {
				// Verifica se la scheda esiste già per ID
				const existing = await db
					.select({ id: cards.id })
					.from(cards)
					.where(eq(cards.id, cardId))
					.limit(1);

				if (existing.length > 0) {
					// Aggiorna
					await db
						.update(cards)
						.set({
							title: cleanTitle,
							hasAcronym: Boolean(c.hasAcronym),
							acronym: c.acronym || null,
							fullName: c.fullName || null,
							description: cleanDesc,
							category: cleanCategory,
							tags: c.tags || [],
							images: c.images || [],
							showInWiki: c.showInWiki !== false,
							gameModes: Array.isArray(c.gameModes) && c.gameModes.length > 0 ? c.gameModes : ['flashcard', 'quiz', 'reels', 'scrittura'],
							isDeleted: Boolean(c.isDeleted),
							deletedAt: c.deletedAt ? new Date(c.deletedAt) : null,
							updatedAt: new Date()
						})
						.where(eq(cards.id, cardId));
					updatedCount++;
					continue;
				}
			}

			// Inserisce nuova scheda
			await db.insert(cards).values({
				id: cardId,
				title: cleanTitle,
				hasAcronym: Boolean(c.hasAcronym),
				acronym: c.acronym || null,
				fullName: c.fullName || null,
				description: cleanDesc,
				category: cleanCategory,
				tags: c.tags || [],
				images: c.images || [],
				showInWiki: c.showInWiki !== false,
				gameModes: Array.isArray(c.gameModes) && c.gameModes.length > 0 ? c.gameModes : ['flashcard', 'quiz', 'reels', 'scrittura'],
				isDeleted: Boolean(c.isDeleted),
				deletedAt: c.deletedAt ? new Date(c.deletedAt) : null,
				createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
				updatedAt: new Date()
			});
			insertedCount++;
		}

		await logAdminAction({
			userId: locals.user?.id || 'admin',
			userName: locals.user?.name || locals.user?.username || 'Admin',
			userAvatar: locals.user?.image,
			action: 'import_cards',
			targetType: 'system',
			targetTitle: `Importazione ${mode === 'replace' ? 'Sostitutiva' : 'Unione'}`,
			details: {
				mode,
				insertedCount,
				updatedCount,
				totalProcessed: importedCards.length
			}
		});

		return json({
			success: true,
			mode,
			insertedCount,
			updatedCount,
			totalProcessed: importedCards.length
		});
	} catch (err: any) {
		console.error('Errore importazione backup:', err);
		return json({ error: err.message || 'Errore elaborazione file di backup' }, { status: 500 });
	}
};
