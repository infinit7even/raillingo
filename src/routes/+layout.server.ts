import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies }) => {
	const sessionCookie = cookies.get('admin_session');
	let user = null;

	if (sessionCookie) {
		try {
			user = JSON.parse(sessionCookie);
		} catch (e) {
			cookies.delete('admin_session', { path: '/' });
		}
	}

	return {
		user
	};
};
