import { browser } from '$app/environment';

export type ThemeMode = 'dark' | 'light';
export type TrainLivery = 'regionale' | 'frecciarossa' | 'intercity';

export interface LiveryOption {
	id: TrainLivery;
	name: string;
	desc: string;
	trainModel: string;
	color: string;
	depth: string;
	hoverColor: string;
	emoji: string;
	badgeBg: string;
}

export const LIVERY_OPTIONS: LiveryOption[] = [
	{
		id: 'regionale',
		name: 'Regionale',
		desc: 'Verde Trenitalia Regionale',
		trainModel: 'Regionale Rock / Pop',
		color: '#58cc02',
		depth: '#46a302',
		hoverColor: '#61df02',
		emoji: '🟢',
		badgeBg: 'rgba(88, 204, 2, 0.15)'
	},
	{
		id: 'frecciarossa',
		name: 'Frecciarossa',
		desc: 'Rosso Corsa Alta Velocità',
		trainModel: 'Frecciarossa ETR 1000',
		color: '#ff5e5b',
		depth: '#d9423f',
		hoverColor: '#ff7370',
		emoji: '🔴',
		badgeBg: 'rgba(255, 94, 91, 0.15)'
	},
	{
		id: 'intercity',
		name: 'Intercity',
		desc: 'Azzurro Elettrico Nuova Livrea',
		trainModel: 'Intercity Giorno ETR 421',
		color: '#0080da',
		depth: '#005899',
		hoverColor: '#1ca0f4',
		emoji: '🔵',
		badgeBg: 'rgba(0, 128, 218, 0.15)'
	}
];

export interface ThemeState {
	theme: ThemeMode;
	livery: TrainLivery;
}

class ThemeStore {
	private currentTheme: ThemeMode = 'dark';
	private currentLivery: TrainLivery = 'regionale';
	private listeners = new Set<(state: ThemeState) => void>();

	constructor() {
		if (browser) {
			const savedTheme = localStorage.getItem('rf_theme') as ThemeMode | null;
			if (savedTheme === 'light' || savedTheme === 'dark') {
				this.currentTheme = savedTheme;
			} else {
				const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
				this.currentTheme = prefersDark ? 'dark' : 'light';
			}

			const savedLivery = localStorage.getItem('rf_livery') as TrainLivery | null;
			if (savedLivery && LIVERY_OPTIONS.some((l) => l.id === savedLivery)) {
				this.currentLivery = savedLivery;
			} else {
				this.currentLivery = 'regionale';
			}

			this.applyDOM();
		}
	}

	public get theme(): ThemeMode {
		return this.currentTheme;
	}

	public get livery(): TrainLivery {
		return this.currentLivery;
	}

	public get state(): ThemeState {
		return {
			theme: this.currentTheme,
			livery: this.currentLivery
		};
	}

	public subscribe(run: (state: ThemeState) => void): () => void {
		this.listeners.add(run);
		run({ theme: this.currentTheme, livery: this.currentLivery });
		return () => {
			this.listeners.delete(run);
		};
	}

	public setTheme(theme: ThemeMode) {
		if (this.currentTheme === theme) return;
		this.currentTheme = theme;
		if (browser) {
			localStorage.setItem('rf_theme', theme);
			this.applyDOM();
		}
		this.notify();
	}

	public toggleTheme() {
		this.setTheme(this.currentTheme === 'dark' ? 'light' : 'dark');
	}

	public setLivery(livery: TrainLivery) {
		if (this.currentLivery === livery) return;
		this.currentLivery = livery;
		if (browser) {
			localStorage.setItem('rf_livery', livery);
			this.applyDOM();
		}
		this.notify();
	}

	public cycleLivery() {
		const currentIndex = LIVERY_OPTIONS.findIndex((l) => l.id === this.currentLivery);
		const nextIndex = (currentIndex + 1) % LIVERY_OPTIONS.length;
		this.setLivery(LIVERY_OPTIONS[nextIndex].id);
	}

	private applyDOM() {
		if (!browser) return;
		const root = document.documentElement;

		// Applica tema Dark/Light
		root.setAttribute('data-theme', this.currentTheme);
		if (this.currentTheme === 'light') {
			root.classList.remove('dark');
		} else {
			root.classList.add('dark');
		}

		// Applica livrea ferroviaria
		root.setAttribute('data-livery', this.currentLivery);

		// Aggiorna meta theme-color per la status bar dei browser mobile
		const metaTheme = document.querySelector('meta[name="theme-color"]');
		if (metaTheme) {
			metaTheme.setAttribute('content', this.currentTheme === 'dark' ? '#171f23' : '#ffffff');
		}
	}

	private notify() {
		const currentState = { theme: this.currentTheme, livery: this.currentLivery };
		for (const listener of this.listeners) {
			listener(currentState);
		}
	}
}

export const themeStore = new ThemeStore();
