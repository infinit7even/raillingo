import { env } from '$env/dynamic/private';
import crypto from 'node:crypto';

export const DEFAULT_ADMIN_ID = '691289686093725736';

export interface SessionUser {
	userId: string;
	username?: string;
	email?: string;
	avatar?: string;
	role?: string;
	isAdmin?: boolean;
	loginAt?: string;
}

function getSessionSecret(): string | undefined {
	return env.SESSION_SECRET || process.env.SESSION_SECRET;
}

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

/** Firma un payload di sessione con HMAC-SHA256: ritorna `payload.signature`. */
export function signSession(payload: unknown): string {
	const secret = getSessionSecret();
	if (!secret) {
		throw new Error('SESSION_SECRET non configurata: impossibile firmare la sessione.');
	}
	const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
	const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
	return `${data}.${signature}`;
}

/** Verifica la firma di una sessione e restituisce il payload, oppure null. */
export function verifySession(signed: unknown): unknown | null {
	const secret = getSessionSecret();
	if (!secret || typeof signed !== 'string') return null;

	const idx = signed.lastIndexOf('.');
	if (idx <= 0 || idx === signed.length - 1) return null;

	const data = signed.slice(0, idx);
	const signature = signed.slice(idx + 1);

	const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
	const a = Buffer.from(signature);
	const b = Buffer.from(expected);
	if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

	try {
		return JSON.parse(data);
	} catch {
		return null;
	}
}

/** Legge e verifica la sessione dai cookie; ritorna il payload verificato o null. */
export function readSession(cookies: {
	get: (name: string) => string | undefined;
}): SessionUser | null {
	const cookieVal = cookies.get('admin_session') || cookies.get('user_session');
	if (!cookieVal) return null;

	const session = verifySession(cookieVal);
	if (!session || typeof session !== 'object') return null;

	const user = session as SessionUser;
	if (!user.userId) return null;
	return user;
}

/** Verifica se i cookie di sessione appartengono a un amministratore autorizzato. */
export function isAuthorizedAdmin(cookies: { get: (name: string) => string | undefined }): boolean {
	const session = readSession(cookies);
	if (!session) return false;
	return getAdminIds().includes(String(session.userId).trim());
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
