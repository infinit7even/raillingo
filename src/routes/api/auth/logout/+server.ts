import { redirect, type RequestHandler } from '@sveltejs/kit';
import { sessionCookieOptions } from '$lib/server/auth';
import { isSameOriginRequest } from '$lib/server/csrf';

function safeRedirect(raw: string | null): string {
	if (!raw) return '/';
	if (!raw.startsWith('/')) return '/';
	if (raw.startsWith('//') || raw.includes(':/')) return '/';
	return raw;
}

export const POST: RequestHandler = async (event) => {
	const { cookies, url } = event;

	if (!isSameOriginRequest(event)) {
		return new Response(null, { status: 403 });
	}

	const opts = sessionCookieOptions(url.protocol === 'https:');
	cookies.delete('admin_session', opts);
	cookies.delete('user_session', opts); // legacy cleanup

	throw redirect(302, safeRedirect(url.searchParams.get('redirect')));
};
