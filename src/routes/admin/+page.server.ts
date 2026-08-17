import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isAuthorizedAdmin } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user;

	if (!isAuthorizedAdmin(user)) {
		throw redirect(302, '/notes?error=admin_required');
	}

	const error = url.searchParams.get('error');

	return {
		user,
		error
	};
};
