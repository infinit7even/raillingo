import { json, type RequestHandler } from '@sveltejs/kit';
import crypto from 'node:crypto';
import { isAuthorizedAdmin } from '$lib/server/auth';
import { isSameOriginRequest } from '$lib/server/csrf';
import { CARDS_FILE_PATH, invalidateCards, readCards } from '$lib/server/dataCache';
import { mutateJsonSafe } from '$lib/server/fileStorage';
import { deleteImagesForCard, cleanupUnusedImagesOnCardUpdate } from '$lib/server/mediaCleanup';
import type { Card } from '$lib/types/cards';

export const GET: RequestHandler = async ({ request }) => {
	const cards = await readCards<Card[]>();
	const body = JSON.stringify(cards);
	const etag = `"${crypto.createHash('sha1').update(body).digest('base64url')}"`;

	if (request.headers.get('if-none-match') === etag) {
		return new Response(null, {
			status: 304,
			headers: { ETag: etag, 'Cache-Control': 'no-cache' }
		});
	}

	return json(cards, {
		headers: { ETag: etag, 'Cache-Control': 'no-cache' }
	});
};

export const POST: RequestHandler = async (event) => {
	const { request, cookies } = event;

	if (!isSameOriginRequest(event)) {
		return json({ error: 'Origine non consentita' }, { status: 403 });
	}

	if (!isAuthorizedAdmin(cookies)) {
		return json(
			{
				error:
					'Accesso negato: Soltanto gli amministratori specificati in DISCORD_ADMIN_IDS possono inserire nuove schede.'
			},
			{ status: 403 }
		);
	}

	const newCard: Partial<Card> = await request.json();

	const title = (newCard.title || '').trim();
	const fullName = (newCard.fullName || '').trim();
	const description = (newCard.description || '').trim();
	const category = (newCard.category || '').trim();
	const images = Array.isArray(newCard.images)
		? newCard.images.filter((img): img is string => typeof img === 'string' && img.trim().length > 0)
		: undefined;

	// Deve avere almeno un identificatore visivo o testuale
	const mainTitle = title || fullName;
	if (!mainTitle && (!images || images.length === 0)) {
		return json(
			{ error: 'Inserisci almeno un titolo, un acronimo o un\'immagine per la scheda.' },
			{ status: 400 }
		);
	}

	const now = new Date().toISOString();
	const cardToSave: Card = {
		id: newCard.id || `card-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
		title: title,
		fullName: fullName || undefined,
		description: description,
		category: category || 'Generale',
		images: images && images.length > 0 ? images : undefined,
		tags: Array.isArray(newCard.tags) ? newCard.tags : undefined,
		createdAt: newCard.createdAt || now,
		updatedAt: now
	};

	const result = await mutateJsonSafe<Card[]>(CARDS_FILE_PATH, [], (cards) => {
		const existingIndex = cards.findIndex((c) => c.id === cardToSave.id);
		if (existingIndex >= 0) {
			cards[existingIndex] = cardToSave;
		} else {
			cards.unshift(cardToSave);
		}
		return cards;
	});

	if (!result.success) {
		return json({ error: 'Errore durante la scrittura della scheda su disco.' }, { status: 500 });
	}

	invalidateCards();
	return json(cardToSave, { status: 201 });
};

export const PUT: RequestHandler = async (event) => {
	const { request, cookies } = event;

	if (!isSameOriginRequest(event)) {
		return json({ error: 'Origine non consentita' }, { status: 403 });
	}

	if (!isAuthorizedAdmin(cookies)) {
		return json(
			{
				error:
					'Accesso negato: Soltanto gli amministratori specificati in DISCORD_ADMIN_IDS possono modificare le schede.'
			},
			{ status: 403 }
		);
	}

	const updatedCard: Partial<Card> = await request.json();
	if (!updatedCard.id) {
		return json({ error: 'ID card mancante' }, { status: 400 });
	}

	let oldCardForCleanup: Card | null = null;
	let finalSavedCard: Card | null = null;

	const result = await mutateJsonSafe<Card[]>(CARDS_FILE_PATH, [], (cards) => {
		const index = cards.findIndex((c) => c.id === updatedCard.id);
		if (index === -1) {
			return cards;
		}

		const oldCard = cards[index];
		oldCardForCleanup = oldCard;

		const oldImages = oldCard.images || [];
		const newImages = Array.isArray(updatedCard.images)
			? updatedCard.images.filter((img): img is string => typeof img === 'string' && img.trim().length > 0)
			: oldImages;

		const title = (updatedCard.title !== undefined ? updatedCard.title : oldCard.title || '').trim();
		const fullName = (updatedCard.fullName !== undefined ? updatedCard.fullName : oldCard.fullName || '').trim();
		const description = (updatedCard.description !== undefined ? updatedCard.description : oldCard.description || '').trim();
		const category = (updatedCard.category !== undefined ? updatedCard.category : oldCard.category || '').trim();

		finalSavedCard = {
			...oldCard,
			...updatedCard,
			id: oldCard.id,
			title: title,
			fullName: fullName || undefined,
			description: description,
			category: category || oldCard.category || 'Generale',
			images: newImages.length > 0 ? newImages : undefined,
			updatedAt: new Date().toISOString()
		};

		cards[index] = finalSavedCard;
		return cards;
	});

	if (!finalSavedCard) {
		return json({ error: 'Card non trovata' }, { status: 404 });
	}

	if (!result.success) {
		return json({ error: 'Errore durante l\'aggiornamento della scheda su disco.' }, { status: 500 });
	}

	invalidateCards();

	// Cancella le immagini non più usate in background
	if (oldCardForCleanup) {
		await cleanupUnusedImagesOnCardUpdate(oldCardForCleanup, finalSavedCard);
	}

	return json(finalSavedCard);
};

export const DELETE: RequestHandler = async (event) => {
	const { url, cookies } = event;

	if (!isSameOriginRequest(event)) {
		return json({ error: 'Origine non consentita' }, { status: 403 });
	}

	if (!isAuthorizedAdmin(cookies)) {
		return json(
			{
				error:
					'Accesso negato: Soltanto gli amministratori specificati in DISCORD_ADMIN_IDS possono eliminare le schede.'
			},
			{ status: 403 }
		);
	}

	const id = url.searchParams.get('id');
	if (!id) {
		return json({ error: 'ID non specificato' }, { status: 400 });
	}

	let deletedCard: Card | null = null;

	const result = await mutateJsonSafe<Card[]>(CARDS_FILE_PATH, [], (cards) => {
		const found = cards.find((c) => c.id === id);
		if (found) {
			deletedCard = found;
		}
		return cards.filter((c) => c.id !== id);
	});

	if (!result.success) {
		return json({ error: 'Errore durante l\'eliminazione della scheda dal disco.' }, { status: 500 });
	}

	invalidateCards();

	if (deletedCard) {
		// Elimina fisicamente dal disco tutti i file immagine associati a questa scheda
		await deleteImagesForCard(deletedCard);
	}

	return json({ success: true, id });
};
