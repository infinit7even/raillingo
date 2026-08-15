import { browser } from '$app/environment';

export type ThemePreset = 'dark' | 'light' | 'purple' | 'frecciarossa' | 'emerald' | 'amber';

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
		bg: '#171f23',
		cardBg: '#18252d'
	},
	{
		id: 'light',
		name: 'Tema Chiaro',
		desc: 'Chiaro pulito ad alto contrasto',
		color: '#58cc02',
		bg: '#ffffff',
		cardBg: '#ffffff'
	},
	{
		id: 'purple',
		name: 'Cosmic Purple',
		desc: 'Super viola cosmico brillante',
		color: '#ce82ff',
		bg: '#11091e',
		cardBg: '#1d1033'
	},
	{
		id: 'frecciarossa',
		name: 'Frecciarossa',
		desc: 'Rosso corsa alta velocità',
		color: '#ff4b4b',
		bg: '#16080a',
		cardBg: '#261114'
	},
	{
		id: 'emerald',
		name: 'Trazione Verde',
		desc: 'Verde smeraldo ferroviario',
		color: '#58cc02',
		bg: '#051913',
		cardBg: '#0d2d22'
	},
	{
		id: 'amber',
		name: 'Italo Gold',
		desc: 'Ambra dorata e bronzo scuro',
		color: '#ff9600',
		bg: '#14100a',
		cardBg: '#241a10'
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
		if (this.currentTheme === theme) return;
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

		const isLight = theme === 'light';
		if (isLight) {
			root.classList.remove('dark');
		} else {
			root.classList.add('dark');
		}

		// Aggiorna meta theme-color per la status bar dei browser mobile
		const themeOption = THEME_OPTIONS.find((t) => t.id === theme);
		const metaTheme = document.querySelector('meta[name="theme-color"]');
		if (metaTheme && themeOption) {
			metaTheme.setAttribute('content', themeOption.bg);
		}
	}

	private notify() {
		for (const listener of this.listeners) {
			listener(this.currentTheme);
		}
	}
}

export const themeStore = new ThemeStore();
