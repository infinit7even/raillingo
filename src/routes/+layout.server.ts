import type { LayoutServerLoad } from './$types';
import { getAdminIds, readSession } from '$lib/server/auth';
import { readCards, readUsers } from '$lib/server/dataCache';

export const load: LayoutServerLoad = async ({ cookies }) => {
	const session = readSession(cookies);
	let user: any = null;

	if (session && session.userId && session.username) {
		const discordUserId = String(session.userId).trim();

		// Verifica che l'utente sia admin anche nel file (doppio check)
		let isAdminInFile = false;
		try {
			const usersList = await readUsers<any[]>();
			const fileUser = usersList.find((u: any) => String(u.discordId).trim() === discordUserId);
			if (fileUser && fileUser.role === 'admin') {
				isAdminInFile = true;
			}
		} catch {
			// File non trovato o errore lettura — assume non-admin
		}

		const isAdmin = getAdminIds().includes(discordUserId) || isAdminInFile;
		user = {
			...session,
			isAdmin,
			role: isAdmin ? 'admin' : 'user'
		};
	} else if (session) {
		// Sessione priva dei campi minimi — elimina i cookie
		cookies.delete('user_session', { path: '/' });
		cookies.delete('admin_session', { path: '/' });
	}

	let initialCards: any[] = [];
	try {
		initialCards = await readCards<any[]>();
	} catch {
		initialCards = [];
	}

	return { user, initialCards };
};
