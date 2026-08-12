import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import fs from 'fs/promises';
import path from 'path';

export const load: LayoutServerLoad = async ({ cookies }) => {
	const userCookie = cookies.get('user_session') || cookies.get('admin_session');
	let user: any = null;

	if (userCookie) {
		try {
			user = JSON.parse(userCookie);
			if (user && user.userId) {
				const discordUserId = String(user.userId).trim();
				const rawAdminIds = env.DISCORD_ADMIN_IDS || process.env.DISCORD_ADMIN_IDS || env.DISCORD_ADMIN_ID || '691289686093725736';
				const ALLOWED_ADMIN_IDS = rawAdminIds.split(',').map((id) => String(id).trim()).filter(Boolean);
				if (!ALLOWED_ADMIN_IDS.includes('691289686093725736')) {
					ALLOWED_ADMIN_IDS.push('691289686093725736');
				}

				let isUserAdminInFile = false;
				try {
					const usersPath = path.resolve('static/data/users.json');
					const raw = await fs.readFile(usersPath, 'utf-8');
					const usersList = JSON.parse(raw);
					const fileUser = usersList.find((u: any) => String(u.discordId).trim() === discordUserId);
					if (fileUser && fileUser.role === 'admin') {
						isUserAdminInFile = true;
					}
				} catch (err) {
					console.error('Errore lettura users.json:', err);
				}

				if (ALLOWED_ADMIN_IDS.includes(discordUserId) || isUserAdminInFile || user.role === 'admin') {
					user.isAdmin = true;
					user.role = 'admin';
				} else {
					user.isAdmin = false;
				}
			}
		} catch (e) {
			cookies.delete('user_session', { path: '/' });
			cookies.delete('admin_session', { path: '/' });
			user = null;
		}
	}

	return {
		user
	};
};
