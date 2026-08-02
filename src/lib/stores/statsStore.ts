import { browser } from '$app/environment';

export interface StatsData {
	cardsStudied: number;
	quizAnswered: number;
	quizCorrect: number;
	streakDays: number;
	lastStudiedDate: string;
	favorites: string[];
}

const DEFAULT_STATS: StatsData = {
	cardsStudied: 0,
	quizAnswered: 0,
	quizCorrect: 0,
	streakDays: 1,
	lastStudiedDate: new Date().toISOString().split('T')[0],
	favorites: []
};

class StatsStore {
	private data: StatsData = { ...DEFAULT_STATS };
	private listeners = new Set<(stats: StatsData) => void>();

	constructor() {
		if (browser) {
			const saved = localStorage.getItem('rf_stats');
			if (saved) {
				try {
					this.data = { ...DEFAULT_STATS, ...JSON.parse(saved) };
					this.updateStreak();
				} catch (e) {
					console.error('Errore durante il parsing delle statistiche:', e);
				}
			}
		}
	}

	public subscribe(run: (stats: StatsData) => void): () => void {
		this.listeners.add(run);
		run(this.data);
		return () => {
			this.listeners.delete(run);
		};
	}

	public recordStudySession() {
		const today = new Date().toISOString().split('T')[0];
		this.data.cardsStudied += 1;
		this.data.lastStudiedDate = today;
		this.save();
		this.notify();
	}

	public recordQuizAnswer(isCorrect: boolean) {
		this.data.quizAnswered += 1;
		if (isCorrect) {
			this.data.quizCorrect += 1;
		}
		this.save();
		this.notify();
	}

	public toggleFavorite(cardId: string) {
		if (this.data.favorites.includes(cardId)) {
			this.data.favorites = this.data.favorites.filter((id) => id !== cardId);
		} else {
			this.data.favorites = [...this.data.favorites, cardId];
		}
		this.save();
		this.notify();
	}

	public isFavorite(cardId: string): boolean {
		return this.data.favorites.includes(cardId);
	}

	private updateStreak() {
		const today = new Date().toISOString().split('T')[0];
		const lastDate = this.data.lastStudiedDate;
		if (!lastDate) {
			this.data.streakDays = 1;
			this.data.lastStudiedDate = today;
			return;
		}

		const diffTime = Math.abs(new Date(today).getTime() - new Date(lastDate).getTime());
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

		if (diffDays === 1) {
			// Continuous streak!
		} else if (diffDays > 1) {
			// Streak reset
			this.data.streakDays = 1;
		}
	}

	private save() {
		if (browser) {
			localStorage.setItem('rf_stats', JSON.stringify(this.data));
		}
	}

	private notify() {
		for (const listener of this.listeners) {
			listener(this.data);
		}
	}
}

export const statsStore = new StatsStore();
