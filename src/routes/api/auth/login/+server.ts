import { redirect, type RequestHandler } from '@sveltejs/kit';

const CLIENT_ID = '1533519975476629564';

export const GET: RequestHandler = async ({ url }) => {
	const redirectUri = `${url.origin}/api/auth/callback`;
	const scope = encodeURIComponent('identify');
	const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
		redirectUri
	)}&response_type=code&scope=${scope}`;

	throw redirect(302, discordAuthUrl);
};
