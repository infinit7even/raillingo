import { redirect, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import fs from 'node:fs/promises';
import path from 'node:path';

const CLIENT_ID = env.DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID || '1533519975476629564';
const CLIENT_SECRET = env.DISCORD_CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET || 'BiwE65HiOYsZOjND8P5GlsqwsvUXbpEw';

const rawAdminIds = env.DISCORD_ADMIN_IDS || process.env.DISCORD_ADMIN_IDS || env.DISCORD_ADMIN_ID || '691289686093725736';
const ALLOWED_ADMIN_IDS = rawAdminIds.split(',').map((id) => id.trim());

const USERS_FILE_PATH = path.resolve('static/data/users.json');

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
}

async function readUsersFromFile(): Promise<StoredUser[]> {
	try {
		const data = await fs.readFile(USERS_FILE_PATH, 'utf-8');
		return JSON.parse(data);
	} catch {
		return [];
	}
}

async function writeUsersToFile(users: StoredUser[]): Promise<boolean> {
	try {
		const dir = path.dirname(USERS_FILE_PATH);
		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf-8');
		return true;
	} catch {
		return false;
	}
}

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

		// 2. Ottieni le informazioni utente da Discord (ID, email, username, avatar)
		const userRes = await fetch('https://discord.com/api/users/@me', {
			headers: { Authorization: `Bearer ${accessToken}` }
		});

		if (!userRes.ok) {
			throw redirect(302, '/login?error=user_failed');
		}

		const userData = await userRes.json();
		const email = userData.email || `${userData.id}@discord.user`;
		const username = userData.username || userData.id;
		const avatarUrl = userData.avatar
			? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
			: undefined;

		const discordUserId = String(userData.id).trim();
		const rawAdminIds = env.DISCORD_ADMIN_IDS || process.env.DISCORD_ADMIN_IDS || env.DISCORD_ADMIN_ID || '691289686093725736';
		const ALLOWED_ADMIN_IDS = rawAdminIds.split(',').map((id) => String(id).trim()).filter(Boolean);
		if (!ALLOWED_ADMIN_IDS.includes('691289686093725736')) {
			ALLOWED_ADMIN_IDS.push('691289686093725736');
		}

		const isAdmin = ALLOWED_ADMIN_IDS.includes(discordUserId);
		const now = new Date().toISOString();

		// 3. Salva / aggiorna il profilo utente nel file static/data/users.json
		const users = await readUsersFromFile();
		let storedUser = users.find((u) => String(u.discordId).trim() === discordUserId);

		if (storedUser) {
			storedUser.email = email;
			storedUser.username = username;
			if (avatarUrl) storedUser.avatar = avatarUrl;
			storedUser.role = isAdmin ? 'admin' : storedUser.role || 'user';
			storedUser.lastLoginAt = now;
		} else {
			storedUser = {
				discordId: discordUserId,
				email,
				username,
				avatar: avatarUrl,
				role: isAdmin ? 'admin' : 'user',
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

		await writeUsersToFile(users);

		// 4. Imposta il cookie di sessione per 7 giorni
		const sessionData = {
			userId: discordUserId,
			email,
			username,
			avatar: avatarUrl,
			role: storedUser.role,
			isAdmin,
			stats: storedUser.stats,
			loginAt: now
		};

		const cookieOpts = {
			path: '/',
			httpOnly: true,
			sameSite: 'lax' as const,
			maxAge: 60 * 60 * 24 * 7 // 7 giorni
		};

		cookies.set('user_session', JSON.stringify(sessionData), cookieOpts);
		cookies.set('admin_session', JSON.stringify(sessionData), cookieOpts);

		// Reindirizza SEMPRE alla Home (/) da loggato come richiesto!
		throw redirect(302, '/');
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e && 'location' in e) {
			throw e; // SvelteKit redirect
		}
		console.error('Errore durante auth Discord:', e);
		throw redirect(302, '/login?error=auth_error');
	}
};
