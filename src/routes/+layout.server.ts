import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import fs from 'fs/promises';
import path from 'path';

const USERS_FILE_PATH = path.resolve('data/users.json');

export const load: LayoutServerLoad = async ({ cookies }) => {
	const userCookie = cookies.get('user_session') || cookies.get('admin_session');
	let user: any = null;

	if (userCookie) {
		try {
			const parsed = JSON.parse(userCookie);
			// Valida che il cookie abbia i campi minimi attesi
			if (parsed && parsed.userId && parsed.username) {
				const discordUserId = String(parsed.userId).trim();
				const rawAdminIds = env.DISCORD_ADMIN_IDS || process.env.DISCORD_ADMIN_IDS || '691289686093725736';
				const ALLOWED_ADMIN_IDS = rawAdminIds.split(',').map((id) => String(id).trim()).filter(Boolean);
				if (!ALLOWED_ADMIN_IDS.includes('691289686093725736')) {
					ALLOWED_ADMIN_IDS.push('691289686093725736');
				}

				// Verifica che l'utente sia admin anche nel file (doppio check)
				let isAdminInFile = false;
				try {
					const raw = await fs.readFile(USERS_FILE_PATH, 'utf-8');
					const usersList = JSON.parse(raw);
					const fileUser = usersList.find((u: any) => String(u.discordId).trim() === discordUserId);
					if (fileUser && fileUser.role === 'admin') {
						isAdminInFile = true;
					}
				} catch {
					// File non trovato o errore lettura — assume non-admin
				}

				const isAdmin = ALLOWED_ADMIN_IDS.includes(discordUserId) || isAdminInFile;
				user = {
					...parsed,
					isAdmin,
					role: isAdmin ? 'admin' : 'user'
				};
			}
		} catch {
			// Cookie malformato — eliminalo
			cookies.delete('user_session', { path: '/' });
			cookies.delete('admin_session', { path: '/' });
		}
	}

	let initialCards: any[] = [];
	try {
		const cardsRaw = await fs.readFile(path.resolve('data/cards.json'), 'utf-8');
		initialCards = JSON.parse(cardsRaw);
	} catch {
		initialCards = [];
	}

	return { user, initialCards };
};
