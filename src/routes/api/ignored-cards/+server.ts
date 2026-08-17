import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ cookies, locals }) => {
	const cookieVal = cookies.get('rf_ignored_cards');
	let ignoredCardIds: string[] = [];

	if (cookieVal) {
		try {
			ignoredCardIds = JSON.parse(cookieVal);
		} catch {
			ignoredCardIds = [];
		}
	}

	const currentUser = locals.user;
	if (currentUser && currentUser.id) {
		try {
			const dbUser = await db.select().from(user).where(eq(user.id, currentUser.id)).limit(1);
			if (dbUser.length > 0 && Array.isArray(dbUser[0].ignoredCardIds)) {
				const merged = Array.from(new Set([...ignoredCardIds, ...dbUser[0].ignoredCardIds]));
				ignoredCardIds = merged;
			}
		} catch (e) {
			console.warn('Errore lettura ignoredCardIds:', e);
		}
	}

	return json({ ignoredCardIds });
};

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	const { ignoredCardIds } = await request.json();

	if (!Array.isArray(ignoredCardIds)) {
		return json({ error: 'Array ignoredCardIds non valido' }, { status: 400 });
	}

	cookies.set('rf_ignored_cards', JSON.stringify(ignoredCardIds), {
		path: '/',
		maxAge: 60 * 60 * 24 * 365,
		sameSite: 'lax',
		httpOnly: false
	});

	const currentUser = locals.user;
	if (currentUser && currentUser.id) {
		try {
			await db
				.update(user)
				.set({ ignoredCardIds })
				.where(eq(user.id, currentUser.id));
		} catch (e) {
			console.error('Errore salvataggio card ignorate utente:', e);
		}
	}

	return json({ success: true, ignoredCardIds });
};
