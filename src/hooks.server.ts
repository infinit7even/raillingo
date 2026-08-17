import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { auth, getAdminIds } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

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

		let isAdmin = session.user.role === 'admin';

		if (!isAdmin) {
			try {
				const accounts = await db
					.select({ accountId: schema.account.accountId })
					.from(schema.account)
					.where(
						and(
							eq(schema.account.userId, session.user.id),
							eq(schema.account.providerId, 'discord')
						)
					);

				const discordId = accounts[0]?.accountId?.trim();
				if (discordId && adminIds.includes(discordId)) {
					isAdmin = true;
					await db
						.update(schema.user)
						.set({ role: 'admin' })
						.where(eq(schema.user.id, session.user.id));
				}
			} catch (err) {
				console.error('Errore durante la verifica admin Discord:', err);
			}
		}

		event.locals.user = {
			...session.user,
			username: session.user.name,
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
