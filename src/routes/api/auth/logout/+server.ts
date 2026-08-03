import { redirect, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ cookies }) => {
	cookies.delete('user_session', { path: '/' });
	cookies.delete('admin_session', { path: '/' });
	throw redirect(302, '/');
};

export const POST: RequestHandler = async ({ cookies }) => {
	cookies.delete('user_session', { path: '/' });
	cookies.delete('admin_session', { path: '/' });
	return new Response(null, { status: 200 });
};
