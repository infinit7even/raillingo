import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { adminLogs } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { isAuthorizedAdmin } from '$lib/server/auth';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!isAuthorizedAdmin(locals.user)) {
		return json({ error: 'Accesso negato: Permessi amministratore richiesti.' }, { status: 403 });
	}

	try {
		const actionFilter = url.searchParams.get('action');
		const limitParam = parseInt(url.searchParams.get('limit') || '150', 10);
		const limit = isNaN(limitParam) ? 150 : Math.min(limitParam, 500);

		let query = db.select().from(adminLogs);

		if (actionFilter) {
			query = query.where(eq(adminLogs.action, actionFilter)) as any;
		}

		const logs = await query.orderBy(desc(adminLogs.createdAt)).limit(limit);

		return json(logs, {
			headers: { 'Cache-Control': 'no-cache' }
		});
	} catch (err) {
		console.error('Errore recupero log admin:', err);
		return json({ error: 'Errore interno nel recupero dei log' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ locals }) => {
	if (!isAuthorizedAdmin(locals.user)) {
		return json({ error: 'Accesso negato: Permessi amministratore richiesti.' }, { status: 403 });
	}

	try {
		await db.delete(adminLogs);
		return json({ success: true, message: 'Log svuotati con successo' });
	} catch (err) {
		console.error('Errore cancellazione log admin:', err);
		return json({ error: 'Errore durante la cancellazione dei log' }, { status: 500 });
	}
};
