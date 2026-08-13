import { json, type RequestHandler } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import { readSession } from '$lib/server/auth';
import { isSameOriginRequest } from '$lib/server/csrf';
import { invalidateUsers, readUsers } from '$lib/server/dataCache';

const USERS_FILE_PATH = path.resolve('data/users.json');

async function writeUsers(users: any[]): Promise<boolean> {
	try {
		const dir = path.dirname(USERS_FILE_PATH);
		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf-8');
		invalidateUsers();
		return true;
	} catch {
		return false;
	}
}

export const GET: RequestHandler = async ({ cookies }) => {
	const cookieVal = cookies.get('rf_ignored_cards');
	let ignoredCardIds: string[] = [];

	if (cookieVal) {
		try {
			ignoredCardIds = JSON.parse(cookieVal);
		} catch {
			ignoredCardIds = [];
		}
	}

	const session = readSession(cookies);
	if (session && session.userId) {
		try {
			const users = await readUsers<any[]>();
			const user = users.find((u) => String(u.discordId).trim() === String(session.userId).trim());
			if (user && Array.isArray(user.ignoredCardIds)) {
				// Merge user saved ignored cards with cookie
				const merged = Array.from(new Set([...ignoredCardIds, ...user.ignoredCardIds]));
				ignoredCardIds = merged;
			}
		} catch {
			// Cookie invalid or unreadable
		}
	}

	return json({ ignoredCardIds });
};

export const POST: RequestHandler = async (event) => {
	const { request, cookies } = event;

	if (!isSameOriginRequest(event)) {
		return json({ error: 'Origine non consentita' }, { status: 403 });
	}

	const { ignoredCardIds } = await request.json();

	if (!Array.isArray(ignoredCardIds)) {
		return json({ error: 'Array ignoredCardIds non valido' }, { status: 400 });
	}

	// Always set cookie for persistence
	cookies.set('rf_ignored_cards', JSON.stringify(ignoredCardIds), {
		path: '/',
		maxAge: 60 * 60 * 24 * 365,
		sameSite: 'lax',
		httpOnly: false
	});

	// If logged in, associate with user object in data/users.json
	const session = readSession(cookies);
	if (session && session.userId) {
		try {
			const users = await readUsers<any[]>();
			const userIndex = users.findIndex(
				(u) => String(u.discordId).trim() === String(session.userId).trim()
			);
			if (userIndex >= 0) {
				users[userIndex].ignoredCardIds = ignoredCardIds;
				await writeUsers(users);
			}
		} catch (e) {
			console.error('Errore salvataggio card ignorate utente:', e);
		}
	}

	return json({ success: true, ignoredCardIds });
};
