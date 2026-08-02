import { redirect, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { upsertDbUser } from '$lib/db';

const CLIENT_ID = env.DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID || '1533519975476629564';
const CLIENT_SECRET = env.DISCORD_CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET || 'BiwE65HiOYsZOjND8P5GlsqwsvUXbpEw';

const rawAdminIds = env.DISCORD_ADMIN_IDS || process.env.DISCORD_ADMIN_IDS || env.DISCORD_ADMIN_ID || '691289686093725736';
const ALLOWED_ADMIN_IDS = rawAdminIds.split(',').map((id) => id.trim());

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');

	if (!code) {
		throw redirect(302, '/login?error=nocode');
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
			throw redirect(302, '/login?error=token_failed');
		}

		const tokenData = await tokenRes.json();
		const accessToken = tokenData.access_token;

		// 2. Ottieni le informazioni utente da Discord (ID, email, username - NO foto)
		const userRes = await fetch('https://discord.com/api/users/@me', {
			headers: { Authorization: `Bearer ${accessToken}` }
		});

		if (!userRes.ok) {
			throw redirect(302, '/login?error=user_failed');
		}

		const userData = await userRes.json();
		const email = userData.email || `${userData.id}@discord.user`;
		const username = userData.username || userData.id;

		// 3. Salva / aggiorna l'utente nel Database PostgreSQL ed ottieni il ruolo
		const defaultRole = ALLOWED_ADMIN_IDS.includes(userData.id) ? 'admin' : 'user';
		const role = await upsertDbUser(userData.id, email, username, defaultRole);
		const isAdmin = role === 'admin' || ALLOWED_ADMIN_IDS.includes(userData.id);

		// 4. Salva il cookie di sessione per 7 giorni (senza avatar)
		const sessionData = {
			userId: userData.id,
			email,
			username,
			role: isAdmin ? 'admin' : 'user',
			isAdmin,
			loginAt: new Date().toISOString()
		};

		cookies.set('admin_session', JSON.stringify(sessionData), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 7 giorni
		});

		throw redirect(302, '/');
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e && 'location' in e) {
			throw e; // SvelteKit redirect
		}
		console.error('Errore durante auth Discord:', e);
		throw redirect(302, '/login?error=auth_error');
	}
};
