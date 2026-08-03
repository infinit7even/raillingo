import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies }) => {
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

	return {
		user
	};
};
