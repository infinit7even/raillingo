import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { cards } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import { readCards } from '$lib/server/dataCache';

export const load: LayoutServerLoad = async ({ locals }) => {
	const user = locals.user || null;

	let initialCards: any[] = [];
	try {
		const dbCards = await db.select().from(cards).orderBy(desc(cards.createdAt));
		if (dbCards && dbCards.length > 0) {
			initialCards = dbCards.map((c) => ({
				...c,
				createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
				updatedAt: c.updatedAt ? c.updatedAt.toISOString() : new Date().toISOString()
			}));
		} else {
			initialCards = await readCards<any[]>();
		}
	} catch {
		try {
			initialCards = await readCards<any[]>();
		} catch {
			initialCards = [];
		}
	}

	return { user, initialCards };
};
