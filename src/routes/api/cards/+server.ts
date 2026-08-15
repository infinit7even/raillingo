import { json, type RequestHandler } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { isAuthorizedAdmin } from '$lib/server/auth';
import { isSameOriginRequest } from '$lib/server/csrf';
import { invalidateCards, readCards } from '$lib/server/dataCache';
import { deleteImagesForCard, cleanupUnusedImagesOnCardUpdate } from '$lib/server/mediaCleanup';
import type { Card } from '$lib/types/cards';

const CARDS_FILE_PATH = path.resolve('data/cards.json');

async function writeCardsToFile(cards: Card[]): Promise<boolean> {
	try {
		const dir = path.dirname(CARDS_FILE_PATH);
		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(CARDS_FILE_PATH, JSON.stringify(cards, null, 2), 'utf-8');
		invalidateCards();
		return true;
	} catch (err) {
		console.error('Errore durante il salvataggio di data/cards.json:', err);
		return false;
	}
}

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
		id: newCard.id || `card-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
		title: title || fullName || 'Scheda Visiva',
		fullName: fullName || undefined,
		description: description,
		category: category || 'Generale',
		images: images && images.length > 0 ? images : undefined,
		tags: Array.isArray(newCard.tags) ? newCard.tags : undefined,
		createdAt: newCard.createdAt || now,
		updatedAt: now
	};

	const cards = await readCards<Card[]>();
	const existingIndex = cards.findIndex((c) => c.id === cardToSave.id);
	if (existingIndex >= 0) {
		cards[existingIndex] = cardToSave;
	} else {
		cards.unshift(cardToSave);
	}

	const ok = await writeCardsToFile(cards);
	if (!ok) {
		return json({ error: 'Errore durante la scrittura della scheda su disco.' }, { status: 500 });
	}

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

	const cards = await readCards<Card[]>();
	const index = cards.findIndex((c) => c.id === updatedCard.id);
	if (index === -1) {
		return json({ error: 'Card non trovata' }, { status: 404 });
	}

	const oldCard = cards[index];
	const oldImages = oldCard.images || [];
	const newImages = Array.isArray(updatedCard.images)
		? updatedCard.images.filter((img): img is string => typeof img === 'string' && img.trim().length > 0)
		: [];

	const title = (updatedCard.title !== undefined ? updatedCard.title : oldCard.title || '').trim();
	const fullName = (updatedCard.fullName !== undefined ? updatedCard.fullName : oldCard.fullName || '').trim();
	const description = (updatedCard.description !== undefined ? updatedCard.description : oldCard.description || '').trim();
	const category = (updatedCard.category !== undefined ? updatedCard.category : oldCard.category || '').trim();

	const cardToSave: Card = {
		...oldCard,
		...updatedCard,
		id: oldCard.id,
		title: title || fullName || oldCard.title || 'Scheda Visiva',
		fullName: fullName || undefined,
		description: description,
		category: category || oldCard.category || 'Generale',
		images: newImages.length > 0 ? newImages : undefined,
		updatedAt: new Date().toISOString()
	};

	// Cancella le immagini non più usate
	await cleanupUnusedImagesOnCardUpdate(oldCard, cardToSave);

	cards[index] = cardToSave;

	const ok = await writeCardsToFile(cards);
	if (!ok) {
		return json({ error: 'Errore durante l\'aggiornamento della scheda su disco.' }, { status: 500 });
	}

	return json(cards[index]);
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

	const cards = await readCards<Card[]>();
	const cardToDelete = cards.find((c) => c.id === id);

	if (cardToDelete) {
		// Elimina fisicamente dal disco tutti i file immagine associati a questa scheda
		await deleteImagesForCard(cardToDelete);
	}

	const filtered = cards.filter((c) => c.id !== id);
	const ok = await writeCardsToFile(filtered);
	if (!ok) {
		return json({ error: 'Errore durante l\'eliminazione della scheda dal disco.' }, { status: 500 });
	}

	return json({ success: true, id });
};
