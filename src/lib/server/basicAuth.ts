import { env } from '$env/dynamic/private';
import crypto from 'node:crypto';

/**
 * Verifica le credenziali HTTP Basic Auth (`Authorization: Basic ...`) confrontandole
 * con `ADMIN_BASIC_USER`/`ADMIN_BASIC_PASSWORD` in modo timing-safe.
 * Fail-closed: se le variabili non sono configurate, l'accesso è negato.
 */
export function verifyBasicAuth(request: Request): boolean {
	const user = env.ADMIN_BASIC_USER || process.env.ADMIN_BASIC_USER;
	const pass = env.ADMIN_BASIC_PASSWORD || process.env.ADMIN_BASIC_PASSWORD;
	if (!user || !pass) return false;

	const header = request.headers.get('authorization');
	if (!header || !header.startsWith('Basic ')) return false;

	let decoded: string;
	try {
		decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf-8');
	} catch {
		return false;
	}

	const idx = decoded.indexOf(':');
	if (idx === -1) return false;

	const reqUser = decoded.slice(0, idx);
	const reqPass = decoded.slice(idx + 1);

	return safeEqual(reqUser, user) && safeEqual(reqPass, pass);
}

function safeEqual(a: string, b: string): boolean {
	const bufA = Buffer.from(a);
	const bufB = Buffer.from(b);
	if (bufA.length !== bufB.length) return false;
	return crypto.timingSafeEqual(bufA, bufB);
}
