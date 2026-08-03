import { json, type RequestHandler } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '$env/dynamic/private';
import type { Card } from '$lib/types/cards';

const CARDS_FILE_PATH = path.resolve('static/data/cards.json');

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

function isAuthorizedAdmin(cookies: any): boolean {
	const cookieVal = cookies.get('user_session') || cookies.get('admin_session');
	if (!cookieVal) return false;

	try {
		const session = JSON.parse(cookieVal);
		if (session.isAdmin) return true;

		const rawAdminIds = env.DISCORD_ADMIN_IDS || process.env.DISCORD_ADMIN_IDS || '691289686093725736';
		const adminIds = rawAdminIds.split(',').map((id: string) => id.trim());
		return adminIds.includes(session.userId);
	} catch {
		return false;
	}
}

export const GET: RequestHandler = async () => {
	const cards = await readCardsFromFile();
	return json(cards);
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	if (!isAuthorizedAdmin(cookies)) {
		return json({ error: 'Accesso negato: Soltanto gli amministratori specificati in DISCORD_ADMIN_IDS possono inserire nuove schede.' }, { status: 403 });
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
		return json({ error: 'Accesso negato: Soltanto gli amministratori specificati in DISCORD_ADMIN_IDS possono modificare le schede.' }, { status: 403 });
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
		return json({ error: 'Accesso negato: Soltanto gli amministratori specificati in DISCORD_ADMIN_IDS possono eliminare le schede.' }, { status: 403 });
	}

	const id = url.searchParams.get('id');
	if (!id) {
		return json({ error: 'ID non specificato' }, { status: 400 });
	}

	const cards = await readCardsFromFile();
	const filtered = cards.filter((c) => c.id !== id);
	await writeCardsToFile(filtered);

	return json({ success: true, id });
};
