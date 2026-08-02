import { json, type RequestHandler } from '@sveltejs/kit';
import { getAllDbUsers, updateDbUserRole } from '$lib/db';

export const GET: RequestHandler = async ({ cookies }) => {
	const sessionCookie = cookies.get('admin_session');
	if (!sessionCookie) {
		return json({ error: 'Non autorizzato' }, { status: 401 });
	}

	try {
		const session = JSON.parse(sessionCookie);
		if (!session.isAdmin) {
			return json({ error: 'Accesso riservato agli amministratori' }, { status: 403 });
		}
	} catch (e) {
		return json({ error: 'Sessione non valida' }, { status: 401 });
	}

	const users = await getAllDbUsers();
	return json({ users });
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	const sessionCookie = cookies.get('admin_session');
	if (!sessionCookie) {
		return json({ error: 'Non autorizzato' }, { status: 401 });
	}

	try {
		const session = JSON.parse(sessionCookie);
		if (!session.isAdmin) {
			return json({ error: 'Accesso riservato agli amministratori' }, { status: 403 });
		}
	} catch (e) {
		return json({ error: 'Sessione non valida' }, { status: 401 });
	}

	const { discordId, role } = await request.json();
	if (!discordId || (role !== 'admin' && role !== 'user')) {
		return json({ error: 'Parametri non validi' }, { status: 400 });
	}

	const success = await updateDbUserRole(discordId, role);
	return json({ success });
};
