import { redirect, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getAdminIds, sessionCookieOptions } from '$lib/server/auth';
import fs from 'node:fs/promises';
import path from 'node:path';

// ⚠️ Credenziali obbligatorie da variabili d'ambiente — nessun fallback hardcoded
const CLIENT_ID = env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = env.DISCORD_CLIENT_SECRET;

// Path sicuro fuori da static/ (non accessibile via HTTP)
const USERS_FILE_PATH = path.resolve('data/users.json');

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

		if (!isAdmin) {
			console.warn(`Tentativo di accesso admin non autorizzato: ${discordUserId} (${username})`);
			throw redirect(302, '/admin?error=unauthorized');
		}

		const now = new Date().toISOString();

		// 4. Salva / aggiorna il profilo nel file data/users.json
		const users = await readUsersFromFile();
		let storedUser = users.find((u) => String(u.discordId).trim() === discordUserId);

		if (storedUser) {
			storedUser.email = email;
			storedUser.username = username;
			if (avatarUrl) storedUser.avatar = avatarUrl;
			storedUser.role = 'admin';
			storedUser.lastLoginAt = now;
		} else {
			storedUser = {
				discordId: discordUserId,
				email,
				username,
				avatar: avatarUrl,
				role: 'admin',
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

		// 5. Imposta cookie di sessione sicuri (httpOnly, sameSite strict)
		const sessionData = {
			userId: discordUserId,
			email,
			username,
			avatar: avatarUrl,
			role: 'admin',
			isAdmin: true,
			loginAt: now
		};

		cookies.set(
			'admin_session',
			JSON.stringify(sessionData),
			sessionCookieOptions(url.protocol === 'https:')
		);

		throw redirect(302, '/');
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e && 'location' in e) {
			throw e; // SvelteKit redirect
		}
		console.error('Errore durante auth Discord:', e);
		throw redirect(302, '/?error=auth_error');
	}
};
