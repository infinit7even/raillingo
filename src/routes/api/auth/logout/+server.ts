import { redirect, type RequestHandler } from '@sveltejs/kit';
import { sessionCookieOptions } from '$lib/server/auth';

export const GET: RequestHandler = async ({ cookies, url, request }) => {
	const opts = sessionCookieOptions(url.protocol === 'https:');
	cookies.delete('admin_session', opts);
	cookies.delete('user_session', opts); // legacy cleanup
	const redirectTo = url.searchParams.get('redirect') || request.headers.get('referer') || '/';
	throw redirect(302, redirectTo);
};

export const POST: RequestHandler = async ({ cookies, url }) => {
	const opts = sessionCookieOptions(url.protocol === 'https:');
	cookies.delete('admin_session', opts);
	cookies.delete('user_session', opts); // legacy cleanup
	return new Response(null, { status: 200 });
};
