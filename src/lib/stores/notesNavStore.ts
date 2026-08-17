import { writable } from 'svelte/store';
import type { Note } from '$lib/types/notes';

export interface NotesNavState {
	isVaultCollapsed: boolean;
	notes: Note[];
	selectedNoteId: string | null;
}

const initialState: NotesNavState = {
	isVaultCollapsed: false,
	notes: [],
	selectedNoteId: null
};

function createNotesNavStore() {
	const { subscribe, set, update } = writable<NotesNavState>(initialState);

	return {
		subscribe,
		setCollapsed(collapsed: boolean) {
			update((s) => ({ ...s, isVaultCollapsed: collapsed }));
		},
		toggleCollapsed() {
			update((s) => ({ ...s, isVaultCollapsed: !s.isVaultCollapsed }));
		},
		syncNotes(notes: Note[], selectedId: string | null, collapsed: boolean) {
			set({
				isVaultCollapsed: collapsed,
				notes,
				selectedNoteId: selectedId
			});
		},
		selectNote(id: string) {
			update((s) => ({ ...s, selectedNoteId: id }));
			if (typeof window !== 'undefined') {
				window.dispatchEvent(new CustomEvent('rf-select-note', { detail: { id } }));
			}
		}
	};
}

export const notesNavStore = createNotesNavStore();
