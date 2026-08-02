import { json, type RequestHandler } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Card } from '$lib/types/cards';
import { getDbCards, pool } from '$lib/db';

const CARDS_FILE_PATH = path.resolve('static/data/cards.json');

async function readCardsFromFile(): Promise<Card[]> {
	try {
		const dbCards = await getDbCards();
		if (dbCards && dbCards.length > 0) {
			return dbCards;
		}
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

export const GET: RequestHandler = async () => {
	const cards = await readCardsFromFile();
	return json(cards);
};

export const POST: RequestHandler = async ({ request }) => {
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

	try {
		await pool.query(
			`INSERT INTO cards (id, title, description, category, tags, images, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
			 ON CONFLICT (id) DO UPDATE SET
				title = EXCLUDED.title,
				description = EXCLUDED.description,
				category = EXCLUDED.category,
				tags = EXCLUDED.tags,
				images = EXCLUDED.images,
				updated_at = NOW();`,
			[newCard.id, newCard.title, newCard.description, newCard.category || null, newCard.tags || [], newCard.images || []]
		);
	} catch (e) {
		// Ignore DB error
	}

	return json(newCard, { status: 201 });
};

export const PUT: RequestHandler = async ({ request }) => {
	const updatedCard: Card = await request.json();
	if (!updatedCard.id) {
		return json({ error: 'ID card mancante' }, { status: 400 });
	}

	const cards = await readCardsFromFile();
	const index = cards.findIndex((c) => c.id === updatedCard.id);
	if (index === -1) {
		return json({ error: 'Card non trovata' }, { status: 404 });
	}

	cards[index] = {
		...cards[index],
		...updatedCard,
		updatedAt: new Date().toISOString()
	};

	await writeCardsToFile(cards);
	return json(cards[index]);
};

export const DELETE: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id');
	if (!id) {
		return json({ error: 'ID non specificato' }, { status: 400 });
	}

	const cards = await readCardsFromFile();
	const filtered = cards.filter((c) => c.id !== id);
	await writeCardsToFile(filtered);

	try {
		await pool.query('DELETE FROM cards WHERE id = $1', [id]);
	} catch (e) {
		// Ignore DB error
	}

	return json({ success: true, id });
};
