import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isAuthorizedAdmin, readSession } from '$lib/server/auth';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const user = readSession(cookies);

	if (!isAuthorizedAdmin(cookies)) {
		throw redirect(302, '/api/auth/login?error=admin_required');
	}

	const error = url.searchParams.get('error');

	return {
		user,
		error
	};
};
