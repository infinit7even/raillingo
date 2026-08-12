import { env } from '$env/dynamic/private';

export const DEFAULT_ADMIN_ID = '691289686093725736';

/** Legge la lista degli ID admin dalle variabili d'ambiente, garantendo l'ID predefinito incluso. */
export function getAdminIds(): string[] {
	const raw = env.DISCORD_ADMIN_IDS || process.env.DISCORD_ADMIN_IDS || DEFAULT_ADMIN_ID;
	const ids = raw
		.split(',')
		.map((id) => String(id).trim())
		.filter(Boolean);

	if (!ids.includes(DEFAULT_ADMIN_ID)) {
		ids.push(DEFAULT_ADMIN_ID);
	}
	return ids;
}

/** Verifica se i cookie di sessione appartengono a un amministratore autorizzato. */
export function isAuthorizedAdmin(cookies: { get: (name: string) => string | undefined }): boolean {
	const cookieVal = cookies.get('admin_session') || cookies.get('user_session');
	if (!cookieVal) return false;

	try {
		const session = JSON.parse(cookieVal);
		if (session.isAdmin === true) return true;
		return getAdminIds().includes(String(session.userId).trim());
	} catch {
		return false;
	}
}

/**
 * Opzioni condivise per il cookie di sessione admin.
 * `secure` deriva dal protocollo della richiesta: così l'impostazione (login)
 * e l'eliminazione (logout) usano sempre gli stessi attributi, evitando che su
 * HTTP non-localhost il browser scarti il cookie di cancellazione (`Secure`).
 */
export function sessionCookieOptions(secure: boolean) {
	return {
		path: '/',
		httpOnly: true, // non leggibile da JS
		sameSite: 'lax' as const,
		secure,
		maxAge: 60 * 60 * 24 * 7 // 7 giorni
	};
}
