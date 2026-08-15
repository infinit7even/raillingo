import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'rf_global_selected_category';

function createGlobalCategoryStore() {
	let initialCategory = 'ALL';
	if (browser) {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved && saved.trim()) {
				initialCategory = saved.trim();
			}
		} catch {
			// Ignora errori di accesso al localStorage
		}
	}

	const { subscribe, set } = writable<string>(initialCategory);

	return {
		subscribe,
		setCategory: (category: string) => {
			const safeCat = category && category.trim() ? category.trim() : 'ALL';
			if (browser) {
				try {
					localStorage.setItem(STORAGE_KEY, safeCat);
				} catch {
					// Ignora
				}
			}
			set(safeCat);
		},
		reset: () => {
			if (browser) {
				try {
					localStorage.setItem(STORAGE_KEY, 'ALL');
				} catch {
					// Ignora
				}
			}
			set('ALL');
		}
	};
}

export const globalCategoryStore = createGlobalCategoryStore();
