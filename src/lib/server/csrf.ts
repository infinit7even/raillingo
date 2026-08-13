import type { RequestEvent } from '@sveltejs/kit';

/**
 * Protezione CSRF per endpoint JSON (non coperti dal check `origin` integrato di
 * SvelteKit, che si applica solo alle form submission). Verifica che la richiesta
 * mutante provenga dallo stesso origin.
 */
export function isSameOriginRequest(event: RequestEvent): boolean {
	const origin = event.request.headers.get('origin');
	if (origin) {
		try {
			if (new URL(origin).origin !== event.url.origin) return false;
		} catch {
			return false;
		}
	}

	const secFetchSite = event.request.headers.get('sec-fetch-site');
	if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
		return false;
	}

	return true;
}
