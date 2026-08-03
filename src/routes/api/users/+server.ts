import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	return json({ users: [] });
};

export const POST: RequestHandler = async () => {
	return json({ error: 'Gestione utenti disattivata. Autenticazione riservata unicamente all\'amministratore.' }, { status: 400 });
};
