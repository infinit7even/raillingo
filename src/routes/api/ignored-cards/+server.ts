import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ cookies, locals }) => {
	const currentUser = locals.user;

	// 1. Se l'utente è autenticato, le card ignorate arrivano ESCLUSIVAMENTE dal suo profilo nel database
	if (currentUser && currentUser.id) {
		try {
			const dbUser = await db
				.select({ ignoredCardIds: user.ignoredCardIds })
				.from(user)
				.where(eq(user.id, currentUser.id))
				.limit(1);

			if (dbUser.length > 0 && Array.isArray(dbUser[0].ignoredCardIds)) {
				return json({ ignoredCardIds: dbUser[0].ignoredCardIds });
			}
			return json({ ignoredCardIds: [] });
		} catch (e) {
			console.warn('Errore lettura ignoredCardIds utente:', e);
			return json({ ignoredCardIds: [] });
		}
	}

	// 2. Se l'utente è ospite (non autenticato), usiamo il cookie isolato per gli ospiti
	const cookieVal = cookies.get('rf_ignored_cards_guest');
	let ignoredCardIds: string[] = [];

	if (cookieVal) {
		try {
			ignoredCardIds = JSON.parse(cookieVal);
		} catch {
			ignoredCardIds = [];
		}
	}

	return json({ ignoredCardIds });
};

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	const { ignoredCardIds } = await request.json();

	if (!Array.isArray(ignoredCardIds)) {
		return json({ error: 'Array ignoredCardIds non valido' }, { status: 400 });
	}

	const currentUser = locals.user;

	if (currentUser && currentUser.id) {
		try {
			await db
				.update(user)
				.set({ ignoredCardIds })
				.where(eq(user.id, currentUser.id));

			return json({ success: true, ignoredCardIds });
		} catch (e) {
			console.error('Errore salvataggio card ignorate utente:', e);
			return json({ error: 'Errore salvataggio database' }, { status: 500 });
		}
	}

	// Salvataggio per utente ospite (cookie isolato)
	cookies.set('rf_ignored_cards_guest', JSON.stringify(ignoredCardIds), {
		path: '/',
		maxAge: 60 * 60 * 24 * 365,
		sameSite: 'lax',
		httpOnly: false
	});

	return json({ success: true, ignoredCardIds });
};
