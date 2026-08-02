import { browser } from '$app/environment';

export type ThemePreset = 'dark' | 'light';

export interface ThemeOption {
	id: ThemePreset;
	name: string;
	desc: string;
	color: string;
	bg: string;
	cardBg: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
	{
		id: 'dark',
		name: 'Tema Scuro',
		desc: 'Notte blu teal iconico con bordi 3D',
		color: '#1cb0f6',
		bg: '#131f24',
		cardBg: '#18252d'
	},
	{
		id: 'light',
		name: 'Tema Chiaro',
		desc: 'Chiaro pulito ad alto contrasto',
		color: '#58cc02',
		bg: '#ffffff',
		cardBg: '#ffffff'
	}
];

class ThemeStore {
	private currentTheme: ThemePreset = 'dark';
	private listeners = new Set<(theme: ThemePreset) => void>();

	constructor() {
		if (browser) {
			const saved = localStorage.getItem('rf_theme') as ThemePreset | null;
			if (saved && THEME_OPTIONS.some((t) => t.id === saved)) {
				this.currentTheme = saved;
			} else {
				const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
				this.currentTheme = prefersDark ? 'dark' : 'light';
			}
			this.applyTheme(this.currentTheme);
		}
	}

	public get theme(): ThemePreset {
		return this.currentTheme;
	}

	public subscribe(run: (theme: ThemePreset) => void): () => void {
		this.listeners.add(run);
		run(this.currentTheme);
		return () => {
			this.listeners.delete(run);
		};
	}

	public setTheme(theme: ThemePreset) {
		this.currentTheme = theme;
		if (browser) {
			localStorage.setItem('rf_theme', theme);
			this.applyTheme(theme);
		}
		this.notify();
	}

	private applyTheme(theme: ThemePreset) {
		if (!browser) return;
		const root = document.documentElement;
		root.setAttribute('data-theme', theme);
		if (theme === 'light') {
			root.classList.remove('dark');
		} else {
			root.classList.add('dark');
		}
	}

	private notify() {
		for (const listener of this.listeners) {
			listener(this.currentTheme);
		}
	}
}

export const themeStore = new ThemeStore();
