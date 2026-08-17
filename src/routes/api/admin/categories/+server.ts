import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { cards } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { isAuthorizedAdmin } from '$lib/server/auth';
import { isSameOriginRequest } from '$lib/server/csrf';

export const PUT: RequestHandler = async (event) => {
	const { request, locals } = event;

	if (!isSameOriginRequest(event)) {
		return json({ error: 'Origine non consentita.' }, { status: 403 });
	}

	if (!isAuthorizedAdmin(locals.user)) {
		return json(
			{ error: 'Accesso negato: Soltanto gli amministratori possono modificare le categorie.' },
			{ status: 403 }
		);
	}

	try {
		const { oldCategory, newCategory } = await request.json();

		const oldCat = typeof oldCategory === 'string' ? oldCategory.trim() : '';
		const newCat = typeof newCategory === 'string' ? newCategory.trim() : '';

		if (!oldCat || !newCat) {
			return json({ error: 'Specifica sia la vecchia che la nuova categoria.' }, { status: 400 });
		}

		if (oldCat === newCat) {
			return json({ success: true, count: 0, message: 'La categoria di origine e destinazione coincide.' });
		}

		const now = new Date();
		const updated = await db
			.update(cards)
			.set({
				category: newCat,
				updatedAt: now
			})
			.where(eq(cards.category, oldCat))
			.returning();

		return json({
			success: true,
			count: updated.length,
			oldCategory: oldCat,
			newCategory: newCat
		});
	} catch (err: any) {
		console.error('Errore rinomina categoria in blocco:', err);
		return json({ error: err.message || 'Errore durante la rinomina della categoria.' }, { status: 500 });
	}
};
