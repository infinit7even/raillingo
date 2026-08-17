import { redirect, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
	throw redirect(302, `/api/auth/callback/discord${url.search}`);
};
