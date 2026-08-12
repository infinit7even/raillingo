import { writable } from 'svelte/store';

export const isDrawerOpenStore = writable<boolean>(false);

export function toggleDrawer() {
	isDrawerOpenStore.update((v) => !v);
}

export function closeDrawer() {
	isDrawerOpenStore.set(false);
}

export function openDrawer() {
	isDrawerOpenStore.set(true);
}
