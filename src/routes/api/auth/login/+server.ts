import { redirect, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
	const returnUrl = url.searchParams.get('returnUrl') || url.searchParams.get('redirect') || '/admin';
	throw redirect(302, `/api/auth/sign-in/social?provider=discord&callbackURL=${encodeURIComponent(returnUrl)}`);
};
