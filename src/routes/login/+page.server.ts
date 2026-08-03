import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const userCookie = cookies.get('user_session') || cookies.get('admin_session');
	let user = null;

	if (userCookie) {
		try {
			user = JSON.parse(userCookie);
		} catch (e) {
			cookies.delete('user_session', { path: '/' });
			cookies.delete('admin_session', { path: '/' });
		}
	}

	const error = url.searchParams.get('error');

	return {
		user,
		error
	};
};
