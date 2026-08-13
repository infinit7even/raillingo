import type { Handle } from '@sveltejs/kit';
import { verifyBasicAuth } from '$lib/server/basicAuth';

// Header di sicurezza + de-indicizzazione applicati a OGNI risposta.
const SECURITY_HEADERS: Record<string, string> = {
	'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'Referrer-Policy': 'no-referrer',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

function isAdminProtectedRoute(pathname: string, method: string): boolean {
	if (pathname.startsWith('/admin')) return true;
	if (pathname === '/api/cards' && method !== 'GET') return true;
	if (pathname === '/api/upload' && method !== 'GET') return true;
	return false;
}

export const handle: Handle = async ({ event, resolve }) => {
	// Barriera extra HTTP Basic Auth sulla sezione admin.
	if (isAdminProtectedRoute(event.url.pathname, event.request.method)) {
		if (!verifyBasicAuth(event.request)) {
			return new Response('Autenticazione richiesta', {
				status: 401,
				headers: { 'WWW-Authenticate': 'Basic realm="admin", charset="UTF-8"' }
			});
		}
	}

	const response = await resolve(event);

	for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(key, value);
	}

	if (event.url.protocol === 'https:') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}

	return response;
};
