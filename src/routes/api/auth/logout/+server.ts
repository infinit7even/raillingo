import { redirect, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ cookies, url, request }) => {
	cookies.delete('admin_session', { path: '/' });
	cookies.delete('user_session', { path: '/' }); // legacy cleanup
	const redirectTo = url.searchParams.get('redirect') || request.headers.get('referer') || '/';
	throw redirect(302, redirectTo);
};

export const POST: RequestHandler = async ({ cookies }) => {
	cookies.delete('admin_session', { path: '/' });
	cookies.delete('user_session', { path: '/' }); // legacy cleanup
	return new Response(null, { status: 200 });
};

