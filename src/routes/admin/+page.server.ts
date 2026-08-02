import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const sessionCookie = cookies.get('admin_session');
	let user = null;

	if (sessionCookie) {
		try {
			user = JSON.parse(sessionCookie);
		} catch (e) {
			cookies.delete('admin_session', { path: '/' });
		}
	}

	const error = url.searchParams.get('error');

	return {
		user,
		error
	};
};
