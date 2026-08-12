import { writable } from 'svelte/store';

function createNavStore() {
	const { subscribe, set, update } = writable<boolean>(false);

	return {
		subscribe,
		open: () => set(true),
		close: () => set(false),
		toggle: () => update((open) => !open),
		set
	};
}

export const navStore = createNavStore();
