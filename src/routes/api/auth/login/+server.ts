import { redirect, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import crypto from 'node:crypto';

const CLIENT_ID = env.DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID;

export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!CLIENT_ID) {
		console.error('DISCORD_CLIENT_ID non configurato!');
		throw redirect(302, '/admin?error=config_error');
	}

	const secure = url.protocol === 'https:';
	const redirectUri = `${url.origin}/api/auth/callback`;
	const scope = encodeURIComponent('identify');

	const returnUrl = url.searchParams.get('returnUrl') || url.searchParams.get('redirect');
	if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
		cookies.set('oauth_return_to', returnUrl, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure,
			maxAge: 60 * 10
		});
	}

	// Anti login-CSRF: `state` casuale salvato in un cookie di breve durata.
	const state = crypto.randomBytes(16).toString('hex');
	cookies.set('oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure,
		maxAge: 60 * 10 // 10 minuti
	});

	const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
		redirectUri
	)}&response_type=code&scope=${scope}&state=${encodeURIComponent(state)}`;

	throw redirect(302, discordAuthUrl);
};
