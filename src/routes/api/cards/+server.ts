import { json, type RequestHandler } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isAuthorizedAdmin } from '$lib/server/auth';
import type { Card } from '$lib/types/cards';

const CARDS_FILE_PATH = path.resolve('data/cards.json');

async function readCardsFromFile(): Promise<Card[]> {
	try {
		const data = await fs.readFile(CARDS_FILE_PATH, 'utf-8');
		return JSON.parse(data);
	} catch (err) {
		return [];
	}
}

async function writeCardsToFile(cards: Card[]): Promise<boolean> {
	try {
		const dir = path.dirname(CARDS_FILE_PATH);
		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(CARDS_FILE_PATH, JSON.stringify(cards, null, 2), 'utf-8');
		return true;
	} catch (err) {
		return false;
	}
}

async function deleteMediaFile(imgUrl: string) {
	if (!imgUrl || typeof imgUrl !== 'string') return;
	const filename = path.basename(imgUrl.split('?')[0]);
	if (!filename || filename.includes('..')) return;

	const dataPath = path.resolve('data/uploads', filename);
	const staticPath = path.resolve('static/uploads', filename);

	await Promise.all([
		fs.unlink(dataPath).catch(() => {}),
		fs.unlink(staticPath).catch(() => {})
	]);
}

export const GET: RequestHandler = async () => {
	const cards = await readCardsFromFile();
	return json(cards);
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	if (!isAuthorizedAdmin(cookies)) {
		return json(
			{
				error:
					'Accesso negato: Soltanto gli amministratori specificati in DISCORD_ADMIN_IDS possono inserire nuove schede.'
			},
			{ status: 403 }
		);
	}

	const newCard: Card = await request.json();
	if (!newCard.title || !newCard.description) {
		return json({ error: 'Titolo e descrizione sono obbligatori' }, { status: 400 });
	}

	const cards = await readCardsFromFile();
	const existingIndex = cards.findIndex((c) => c.id === newCard.id);
	if (existingIndex >= 0) {
		cards[existingIndex] = newCard;
	} else {
		cards.unshift(newCard);
	}

	await writeCardsToFile(cards);
	return json(newCard, { status: 201 });
};

export const PUT: RequestHandler = async ({ request, cookies }) => {
	if (!isAuthorizedAdmin(cookies)) {
		return json(
			{
				error:
					'Accesso negato: Soltanto gli amministratori specificati in DISCORD_ADMIN_IDS possono modificare le schede.'
			},
			{ status: 403 }
		);
	}

	const updatedCard: Card = await request.json();
	if (!updatedCard.id) {
		return json({ error: 'ID card mancante' }, { status: 400 });
	}

	const cards = await readCardsFromFile();
	const index = cards.findIndex((c) => c.id === updatedCard.id);
	if (index === -1) {
		return json({ error: 'Card non trovata' }, { status: 404 });
	}

	const oldCard = cards[index];
	const oldImages = oldCard.images || [];
	const newImages = updatedCard.images || [];
	const removedImages = oldImages.filter((img) => !newImages.includes(img));
	for (const imgUrl of removedImages) {
		await deleteMediaFile(imgUrl);
	}

	cards[index] = {
		...cards[index],
		...updatedCard,
		updatedAt: new Date().toISOString()
	};

	await writeCardsToFile(cards);
	return json(cards[index]);
};

export const DELETE: RequestHandler = async ({ url, cookies }) => {
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

	const cards = await readCardsFromFile();
	const cardToDelete = cards.find((c) => c.id === id);

	if (cardToDelete && cardToDelete.images && Array.isArray(cardToDelete.images)) {
		for (const imgUrl of cardToDelete.images) {
			await deleteMediaFile(imgUrl);
		}
	}

	const filtered = cards.filter((c) => c.id !== id);
	await writeCardsToFile(filtered);

	return json({ success: true, id });
};
