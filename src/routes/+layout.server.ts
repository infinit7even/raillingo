import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { cards, user as userTable } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const user = locals.user || null;

	let initialCards: any[] = [];
	try {
		const dbCards = await db
			.select()
			.from(cards)
			.where(eq(cards.isDeleted, false))
			.orderBy(desc(cards.createdAt));

		if (dbCards && dbCards.length > 0) {
			initialCards = dbCards.map((c) => ({
				...c,
				hasAcronym: Boolean(c.hasAcronym),
				acronym: c.acronym || undefined,
				showInWiki: c.showInWiki !== false,
				gameModes: (c.gameModes as string[]) || ['flashcard', 'quiz', 'reels', 'scrittura'],
				isDeleted: Boolean(c.isDeleted),
				deletedAt: c.deletedAt ? c.deletedAt.toISOString() : undefined,
				createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
				updatedAt: c.updatedAt ? c.updatedAt.toISOString() : new Date().toISOString()
			}));
		}
	} catch (e) {
		console.error('Errore caricamento cards dal DB:', e);
		initialCards = [];
	}

	let initialIgnoredCardIds: string[] = [];
	if (user && user.id) {
		try {
			const dbUser = await db
				.select({ ignoredCardIds: userTable.ignoredCardIds })
				.from(userTable)
				.where(eq(userTable.id, user.id))
				.limit(1);

			if (dbUser.length > 0 && Array.isArray(dbUser[0].ignoredCardIds)) {
				initialIgnoredCardIds = dbUser[0].ignoredCardIds;
			}
		} catch (e) {
			console.error('Errore caricamento ignoredCardIds utente:', e);
		}
	} else {
		const cookieVal = cookies.get('rf_ignored_cards_guest');
		if (cookieVal) {
			try {
				initialIgnoredCardIds = JSON.parse(cookieVal);
			} catch {}
		}
	}

	return { user, initialCards, initialIgnoredCardIds };
};
