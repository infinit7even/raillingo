import { json, type RequestHandler } from '@sveltejs/kit';
import { readSession } from '$lib/server/auth';
import { isSameOriginRequest } from '$lib/server/csrf';
import { USERS_FILE_PATH, invalidateUsers, readUsers } from '$lib/server/dataCache';
import { mutateJsonSafe } from '$lib/server/fileStorage';

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
			// Cookie non leggibile o corrotto
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

	// Salva nei cookie per persistenza client immediata
	cookies.set('rf_ignored_cards', JSON.stringify(ignoredCardIds), {
		path: '/',
		maxAge: 60 * 60 * 24 * 365,
		sameSite: 'lax',
		httpOnly: false
	});

	// Se autenticato, associa all'oggetto utente in data/users.json in modo atomico
	const session = readSession(cookies);
	if (session && session.userId) {
		await mutateJsonSafe<any[]>(USERS_FILE_PATH, [], (users) => {
			const userIndex = users.findIndex(
				(u) => String(u.discordId).trim() === String(session.userId).trim()
			);
			if (userIndex >= 0) {
				users[userIndex].ignoredCardIds = ignoredCardIds;
			}
			return users;
		});
		invalidateUsers();
	}

	return json({ success: true, ignoredCardIds });
};
