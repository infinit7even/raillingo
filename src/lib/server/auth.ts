import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

let env: Record<string, string | undefined> = process.env;
try {
	const dynamicEnv = await import('$env/dynamic/private');
	if (dynamicEnv?.env) {
		env = { ...process.env, ...dynamicEnv.env };
	}
} catch {
	// Standalone script mode
}

export const DEFAULT_ADMIN_ID = '691289686093725736';

export function getAdminIds(): string[] {
	const raw = env.DISCORD_ADMIN_IDS || process.env.DISCORD_ADMIN_IDS || DEFAULT_ADMIN_ID;
	const ids = raw
		.split(',')
		.map((id) => String(id).trim())
		.filter(Boolean);

	if (!ids.includes(DEFAULT_ADMIN_ID)) {
		ids.push(DEFAULT_ADMIN_ID);
	}
	return ids;
}

const socialProviders: Record<string, any> = {};

const discordClientId = env.DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID;
const discordClientSecret = env.DISCORD_CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET;

if (discordClientId && discordClientSecret) {
	socialProviders.discord = {
		clientId: discordClientId,
		clientSecret: discordClientSecret,
		scope: ['identify', 'email']
	};
}

export const auth = betterAuth({
	baseURL: env.ORIGIN || env.BETTER_AUTH_URL || env.SITE_URL || 'https://raillingo.7fx.it',
	trustedOrigins: async (request) => {
		const origins: string[] = [
			'https://raillingo.7fx.it',
			'http://raillingo.7fx.it',
			'http://raillingo.7fx.it:3099',
			'https://raillingo.7fx.it:3099',
			'http://localhost:5173',
			'http://localhost:4009',
			'http://localhost:3099',
			'http://localhost:3000'
		];
		if (env.ORIGIN) origins.push(env.ORIGIN);
		if (env.BETTER_AUTH_URL) origins.push(env.BETTER_AUTH_URL);
		if (env.SITE_URL) origins.push(env.SITE_URL);
		const host = request?.headers.get('host');
		if (host) {
			const proto = request?.headers.get('x-forwarded-proto') || 'https';
			origins.push(`${proto}://${host}`);
			origins.push(`http://${host}`);
			origins.push(`https://${host}`);
		}
		return Array.from(new Set(origins));
	},
	secret: env.BETTER_AUTH_SECRET || 'raillingo_better_auth_secret_key_8f9a0b1c2d3e4f5a6b7c8d9e',
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification
		}
	}),
	socialProviders,
	session: {
		cookieCache: { enabled: false }
	},
	user: {
		fields: {
			name: 'name'
		},
		additionalFields: {
			role: {
				type: 'string',
				defaultValue: 'user',
				input: false
			},
			ignoredCardIds: {
				type: 'string',
				required: false
			},
			favorites: {
				type: 'string',
				required: false
			},
			stats: {
				type: 'string',
				required: false
			}
		}
	},
	databaseHooks: {
		account: {
			create: {
				after: async (accountData) => {
					// Se l'account Discord corrisponde ad un admin, imposta role: 'admin'
					if (accountData.providerId === 'discord') {
						const adminIds = getAdminIds();
						if (adminIds.includes(String(accountData.accountId).trim())) {
							await db
								.update(schema.user)
								.set({ role: 'admin' })
								.where(eq(schema.user.id, accountData.userId));
						}
					}
				}
			}
		}
	},
	plugins: [sveltekitCookies(getRequestEvent)]
});

export type Auth = typeof auth;

export function isAuthorizedAdmin(user: { id?: string; role?: string; email?: string } | null | undefined): boolean {
	if (!user) return false;
	if (user.role === 'admin') return true;
	return false;
}
