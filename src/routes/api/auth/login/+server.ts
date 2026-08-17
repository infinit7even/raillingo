import { redirect, type RequestHandler } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';

export const GET: RequestHandler = async ({ url, request }) => {
	const returnUrl = url.searchParams.get('returnUrl') || url.searchParams.get('redirect') || '/admin';

	try {
		const res = await auth.api.signInSocial({
			body: {
				provider: 'discord',
				callbackURL: returnUrl
			},
			headers: request.headers
		});

		if (res && typeof res === 'object' && 'url' in res && res.url) {
			throw redirect(302, res.url);
		}
	} catch (e: any) {
		if (e?.status === 302 || e?.location) {
			throw e;
		}
		console.error('Errore signInSocial:', e);
	}

	throw redirect(302, '/admin?error=auth_failed');
};
