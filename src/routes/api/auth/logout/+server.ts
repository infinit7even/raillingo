import { redirect, type RequestHandler } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';

export const GET: RequestHandler = async ({ request, cookies }) => {
	await auth.api.signOut({ headers: request.headers }).catch(() => {});
	cookies.delete('user_session', { path: '/' });
	cookies.delete('admin_session', { path: '/' });
	throw redirect(302, '/');
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	await auth.api.signOut({ headers: request.headers }).catch(() => {});
	cookies.delete('user_session', { path: '/' });
	cookies.delete('admin_session', { path: '/' });
	throw redirect(302, '/');
};
