import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { auth, getAdminIds } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';

// Header di sicurezza + de-indicizzazione applicati a OGNI risposta.
const SECURITY_HEADERS: Record<string, string> = {
	'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

const handleSecurity: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(key, value);
	}

	if (event.url.protocol === 'https:') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}

	return response;
};

const handleAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		const adminIds = getAdminIds();
		const isAdmin =
			session.user.role === 'admin' ||
			adminIds.includes(String(session.user.id).trim());

		event.locals.user = {
			...session.user,
			isAdmin,
			role: isAdmin ? 'admin' : session.user.role || 'user'
		};
	} else {
		event.locals.session = null;
		event.locals.user = null;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = sequence(handleSecurity, handleAuth);
