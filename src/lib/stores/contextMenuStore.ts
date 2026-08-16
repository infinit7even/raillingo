import { writable } from 'svelte/store';

export type ContextMenuType = 'global-nav' | 'note-item' | 'notes-workspace';

export interface ContextMenuState {
	isOpen: boolean;
	type: ContextMenuType;
	x: number;
	y: number;
	targetNoteId: string | null;
}

const initialState: ContextMenuState = {
	isOpen: false,
	type: 'global-nav',
	x: 0,
	y: 0,
	targetNoteId: null
};

function createContextMenuStore() {
	const { subscribe, set, update } = writable<ContextMenuState>(initialState);

	return {
		subscribe,
		openGlobalNav: (x: number, y: number) => {
			set({
				isOpen: true,
				type: 'global-nav',
				x,
				y,
				targetNoteId: null
			});
		},
		openNoteItem: (x: number, y: number, noteId: string) => {
			set({
				isOpen: true,
				type: 'note-item',
				x,
				y,
				targetNoteId: noteId
			});
		},
		openNotesWorkspace: (x: number, y: number, currentNoteId?: string | null) => {
			set({
				isOpen: true,
				type: 'notes-workspace',
				x,
				y,
				targetNoteId: currentNoteId || null
			});
		},
		close: () => {
			set(initialState);
		}
	};
}

export const contextMenuStore = createContextMenuStore();
