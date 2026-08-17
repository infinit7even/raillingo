import { createAuthClient } from 'better-auth/svelte';

export const authClient = createAuthClient();

export const { signIn, signOut, useSession, getSession } = authClient;

export async function loginWithDiscord(callbackURL: string = '/admin') {
	const absoluteUrl =
		typeof window !== 'undefined'
			? new URL(callbackURL, window.location.origin).href
			: callbackURL;

	await signIn.social({
		provider: 'discord',
		callbackURL: absoluteUrl
	});
}

export async function logoutUser() {
	await signOut();
	window.location.href = '/';
}
