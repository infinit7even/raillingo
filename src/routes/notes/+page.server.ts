import type { PageServerLoad } from './$types';
import { readSession } from '$lib/server/auth';
import { readNotes } from '$lib/server/dataCache';
import type { Note } from '$lib/types/notes';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const user = readSession(cookies);
	const error = url.searchParams.get('error');

	if (!user) {
		return {
			user: null,
			initialNotes: [],
			error
		};
	}

	let notes: Note[] = [];
	try {
		const allNotes = await readNotes<Note[]>();
		notes = allNotes.filter((n) => !n.userId || n.userId === user.userId || user.isAdmin);
	} catch (e) {
		console.error('Errore lettura note SSR:', e);
		notes = [];
	}

	return {
		user,
		initialNotes: notes,
		error
	};
};
