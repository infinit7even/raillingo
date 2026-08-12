import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const sessionCookie = cookies.get('admin_session') || cookies.get('user_session');
	let user = null;

	if (sessionCookie) {
		try {
			user = JSON.parse(sessionCookie);
		} catch (e) {
			cookies.delete('admin_session', { path: '/' });
			cookies.delete('user_session', { path: '/' });
		}
	}

	const isAdminUser = user && (user.isAdmin || user.role === 'admin' || String(user.userId).trim() === '691289686093725736');

	if (!isAdminUser) {
		throw redirect(302, '/api/auth/login?error=admin_required');
	}

	const error = url.searchParams.get('error');

	return {
		user,
		error
	};
};
