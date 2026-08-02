import { redirect, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const CLIENT_ID = env.DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID || '1533519975476629564';
const CLIENT_SECRET = env.DISCORD_CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET || 'BiwE65HiOYsZOjND8P5GlsqwsvUXbpEw';

// Supporta lista di ID admin separati da virgola in DISCORD_ADMIN_IDS
const rawAdminIds = env.DISCORD_ADMIN_IDS || process.env.DISCORD_ADMIN_IDS || env.DISCORD_ADMIN_ID || '691289686093725736';
const ALLOWED_ADMIN_IDS = rawAdminIds.split(',').map((id) => id.trim());

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');

	if (!code) {
		throw redirect(302, '/admin?error=nocode');
	}

	const redirectUri = `${url.origin}/api/auth/callback`;

	try {
		// 1. Scambia il codice con il token d'accesso
		const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: CLIENT_ID,
				client_secret: CLIENT_SECRET,
				grant_type: 'authorization_code',
				code,
				redirect_uri: redirectUri
			})
		});

		if (!tokenRes.ok) {
			const errBody = await tokenRes.text();
			console.error('Errore scambio token Discord:', errBody);
			throw redirect(302, '/admin?error=token_failed');
		}

		const tokenData = await tokenRes.json();
		const accessToken = tokenData.access_token;

		// 2. Ottieni le informazioni utente da Discord
		const userRes = await fetch('https://discord.com/api/users/@me', {
			headers: { Authorization: `Bearer ${accessToken}` }
		});

		if (!userRes.ok) {
			throw redirect(302, '/admin?error=user_failed');
		}

		const userData = await userRes.json();

		// 3. Verifica se l'ID fa parte della lista degli amministratori autorizzati
		if (!ALLOWED_ADMIN_IDS.includes(userData.id)) {
			console.warn(`Tentativo di accesso admin non autorizzato da ID Discord: ${userData.id}`);
			throw redirect(302, '/admin?error=unauthorized');
		}

		// 4. Salva il cookie di sessione admin per 7 giorni
		const sessionData = {
			userId: userData.id,
			username: userData.username,
			avatar: userData.avatar
				? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
				: null,
			loginAt: new Date().toISOString()
		};

		cookies.set('admin_session', JSON.stringify(sessionData), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 7 giorni
		});

		throw redirect(302, '/admin');
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e && 'location' in e) {
			throw e; // SvelteKit redirect
		}
		console.error('Errore durante auth Discord:', e);
		throw redirect(302, '/admin?error=auth_error');
	}
};
