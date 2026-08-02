import { browser } from '$app/environment';

export type ThemePreset = 'dark' | 'light' | 'frecciarossa' | 'emerald' | 'purple';

export interface ThemeOption {
	id: ThemePreset;
	name: string;
	color: string;
	bg: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
	{ id: 'dark', name: 'Notte Ferroviaria', color: '#38bdf8', bg: '#0b0f19' },
	{ id: 'light', name: 'Giorno RFI', color: '#0284c7', bg: '#f8fafc' },
	{ id: 'frecciarossa', name: 'Frecciarossa', color: '#ef4444', bg: '#18080a' },
	{ id: 'emerald', name: 'Trazione Verde', color: '#10b981', bg: '#061a14' },
	{ id: 'purple', name: 'Alta Velocità', color: '#a855f7', bg: '#13091f' }
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
