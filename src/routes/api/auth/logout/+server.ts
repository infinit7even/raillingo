import { redirect, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ cookies }) => {
	cookies.delete('admin_session', { path: '/' });
	cookies.delete('user_session', { path: '/' }); // legacy cleanup
	throw redirect(302, '/admin');
};

export const POST: RequestHandler = async ({ cookies }) => {
	cookies.delete('admin_session', { path: '/' });
	cookies.delete('user_session', { path: '/' }); // legacy cleanup
	return new Response(null, { status: 200 });
};

