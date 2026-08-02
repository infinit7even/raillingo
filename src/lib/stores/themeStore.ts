import { browser } from '$app/environment';

export type Theme = 'dark' | 'light';

class ThemeStore {
	private currentTheme: Theme = 'dark';
	private listeners = new Set<(theme: Theme) => void>();

	constructor() {
		if (browser) {
			const saved = localStorage.getItem('rf_theme') as Theme | null;
			if (saved && (saved === 'dark' || saved === 'light')) {
				this.currentTheme = saved;
			} else {
				const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
				this.currentTheme = prefersDark ? 'dark' : 'light';
			}
			this.applyTheme(this.currentTheme);
		}
	}

	public get theme(): Theme {
		return this.currentTheme;
	}

	public subscribe(run: (theme: Theme) => void): () => void {
		this.listeners.add(run);
		run(this.currentTheme);
		return () => {
			this.listeners.delete(run);
		};
	}

	public toggle() {
		const next = this.currentTheme === 'dark' ? 'light' : 'dark';
		this.setTheme(next);
	}

	public setTheme(theme: Theme) {
		this.currentTheme = theme;
		if (browser) {
			localStorage.setItem('rf_theme', theme);
			this.applyTheme(theme);
		}
		this.notify();
	}

	private applyTheme(theme: Theme) {
		if (!browser) return;
		const root = document.documentElement;
		if (theme === 'dark') {
			root.classList.add('dark');
			root.setAttribute('data-theme', 'dark');
		} else {
			root.classList.remove('dark');
			root.setAttribute('data-theme', 'light');
		}
	}

	private notify() {
		for (const listener of this.listeners) {
			listener(this.currentTheme);
		}
	}
}

export const themeStore = new ThemeStore();
