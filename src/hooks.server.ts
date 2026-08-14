import type { Handle } from '@sveltejs/kit';

// Header di sicurezza + de-indicizzazione applicati a OGNI risposta.
const SECURITY_HEADERS: Record<string, string> = {
	'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'Referrer-Policy': 'no-referrer',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(key, value);
	}

	if (event.url.protocol === 'https:') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}

	return response;
};
