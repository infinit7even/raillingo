import { json, type RequestHandler } from '@sveltejs/kit';
import { getDbAnnouncement, setDbAnnouncement } from '$lib/db';

export const GET: RequestHandler = async () => {
	const announcement = await getDbAnnouncement();
	return json({ announcement });
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	const sessionCookie = cookies.get('admin_session');
	if (!sessionCookie) {
		return json({ error: 'Non autorizzato' }, { status: 401 });
	}

	const { content } = await request.json();
	if (typeof content !== 'string') {
		return json({ error: 'Contenuto non valido' }, { status: 400 });
	}

	const success = await setDbAnnouncement(content);
	return json({ success, announcement: content });
};
