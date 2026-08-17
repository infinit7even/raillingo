import { redirect, type ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async () => {
	throw redirect(308, '/flashcard?writing=true');
};
