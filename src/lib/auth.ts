import { betterAuth } from 'better-auth';
import { env } from '$env/dynamic/private';

export const auth = betterAuth({
	baseURL: env.SITE_URL || env.BETTER_AUTH_URL || 'http://localhost:4009',
	secret: env.BETTER_AUTH_SECRET || env.SESSION_SECRET || 'raillingo_better_auth_secret_key_8f9a0b1c2d3e4f5a6b7c8d9e',
	socialProviders: {
		discord: {
			clientId: env.DISCORD_CLIENT_ID || '1533519975476629564',
			clientSecret: env.DISCORD_CLIENT_SECRET || 'BiwE65HiOYsZOjND8P5GlsqwsvUXbpEw'
		}
	}
});
