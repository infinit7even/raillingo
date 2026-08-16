import { redirect, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getAdminIds, sessionCookieOptions, signSession } from '$lib/server/auth';
import { USERS_FILE_PATH, invalidateUsers, readUsers } from '$lib/server/dataCache';
import { mutateJsonSafe } from '$lib/server/fileStorage';

// ⚠️ Credenziali obbligatorie da variabili d'ambiente — nessun fallback hardcoded
const CLIENT_ID = env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = env.DISCORD_CLIENT_SECRET;

interface StoredUser {
	discordId: string;
	email: string;
	username: string;
	avatar?: string;
	role: 'admin' | 'user';
	createdAt: string;
	lastLoginAt: string;
	stats?: {
		cardsStudied: number;
		quizAnswered: number;
		quizCorrect: number;
		streakDays: number;
		lastStudiedDate: string;
		favorites: string[];
	};
	ignoredCardIds?: string[];
}


export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!CLIENT_ID || !CLIENT_SECRET) {
		console.error(
			"Variabili d'ambiente DISCORD_CLIENT_ID e/o DISCORD_CLIENT_SECRET non configurate!"
		);
		throw redirect(302, '/admin?error=config_error');
	}

	const code = url.searchParams.get('code');
	if (!code) {
		throw redirect(302, '/admin?error=nocode');
	}

	// Verifica anti CSRF: il parametro `state` deve corrispondere al cookie.
	const state = url.searchParams.get('state');
	const storedState = cookies.get('oauth_state');
	cookies.delete('oauth_state', { path: '/', secure: url.protocol === 'https:' });
	if (!state || !storedState || state !== storedState) {
		console.warn('Stato OAuth non valido o mancante.');
		throw redirect(302, '/admin?error=invalid_state');
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
		const email = userData.email || `${userData.id}@discord.user`;
		const username = userData.username || userData.id;
		const avatarUrl = userData.avatar
			? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
			: undefined;

		const discordUserId = String(userData.id).trim();

		// 3. Verifica autorizzazione admin
		const isAdmin = getAdminIds().includes(discordUserId);
		const userRole: 'admin' | 'user' = isAdmin ? 'admin' : 'user';

		const now = new Date().toISOString();

		// 4. Salva / aggiorna il profilo nel file data/users.json in modo concorrente e sicuro
		await mutateJsonSafe<StoredUser[]>(USERS_FILE_PATH, [], (users) => {
			let storedUser = users.find((u: StoredUser) => String(u.discordId).trim() === discordUserId);

			if (storedUser) {
				storedUser.email = email;
				storedUser.username = username;
				if (avatarUrl) storedUser.avatar = avatarUrl;
				storedUser.role = userRole;
				storedUser.lastLoginAt = now;
			} else {
				storedUser = {
					discordId: discordUserId,
					email,
					username,
					avatar: avatarUrl,
					role: userRole,
					createdAt: now,
					lastLoginAt: now,
					stats: {
						cardsStudied: 0,
						quizAnswered: 0,
						quizCorrect: 0,
						streakDays: 1,
						lastStudiedDate: now.split('T')[0],
						favorites: []
					}
				};
				users.push(storedUser);
			}
			return users;
		});

		invalidateUsers();

		// 5. Imposta cookie di sessione sicuri (httpOnly, sameSite lax)
		const sessionData = {
			userId: discordUserId,
			email,
			username,
			avatar: avatarUrl,
			role: userRole,
			isAdmin,
			loginAt: now
		};

		const cookieName = isAdmin ? 'admin_session' : 'user_session';
		cookies.set(
			cookieName,
			signSession(sessionData),
			sessionCookieOptions(url.protocol === 'https:')
		);

		// Recupera eventuale URL di ritorno salvato
		const returnTo = cookies.get('oauth_return_to');
		cookies.delete('oauth_return_to', { path: '/', secure: url.protocol === 'https:' });
		const targetRedirect =
			returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';

		throw redirect(302, targetRedirect);
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e && 'location' in e) {
			throw e; // SvelteKit redirect
		}
		console.error('Errore durante auth Discord:', e);
		throw redirect(302, '/?error=auth_error');
	}
};
