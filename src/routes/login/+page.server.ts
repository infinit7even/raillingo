import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { readSession } from '$lib/server/auth';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const user = readSession(cookies);
	const returnUrl = url.searchParams.get('returnUrl') || url.searchParams.get('redirect') || '/notes';
	const error = url.searchParams.get('error');

	// Se l'utente è già autenticato, reindirizza alla destinazione richiesta
	if (user) {
		const safeTarget = returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/notes';
		throw redirect(302, safeTarget);
	}

	return {
		returnUrl,
		error
	};
};
