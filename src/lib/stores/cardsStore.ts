import { browser } from '$app/environment';
import type { Card } from '$lib/types/cards';

class CardsStore {
	private cards: Card[] = [];
	private loading = false;
	private listeners = new Set<(cards: Card[]) => void>();

	private hydrated = false;

	constructor() {
		// L'inizializzazione avviene tramite hydrate() con i dati SSR,
		// evitando un secondo fetch di /api/cards al primo caricamento.
	}

	/** Inizializza lo store con i dati provenienti dal server (SSR). */
	public hydrate(initialCards: Card[] | null | undefined) {
		if (this.hydrated) return;
		this.hydrated = true;

		if (initialCards && initialCards.length > 0) {
			this.cards = initialCards;
			this.notify();
			return;
		}

		// Fallback: cache locale + API (accesso senza dati SSR)
		this.loadFromStorageOrApi();
	}

	public subscribe(run: (cards: Card[]) => void): () => void {
		this.listeners.add(run);
		run(this.cards);
		return () => {
			this.listeners.delete(run);
		};
	}

	public async loadFromStorageOrApi() {
		if (this.loading) return;
		this.loading = true;

		try {
			// 1. Try local storage cache
			const cached = localStorage.getItem('rf_cards_cache');
			if (cached) {
				try {
					this.cards = JSON.parse(cached);
					this.notify();
				} catch (e) {
					console.error('Errore durante il parsing delle card memorizzate in locale:', e);
				}
			}

			// 2. Fetch fresh cards from API / static JSON
			const res = await fetch('/api/cards');
			if (res.ok) {
				const freshCards: Card[] = await res.json();
				this.cards = freshCards;
				localStorage.setItem('rf_cards_cache', JSON.stringify(freshCards));
				this.notify();
			} else {
				// Fallback to static JSON file directly
				const fallbackRes = await fetch('/data/cards.json');
				if (fallbackRes.ok) {
					const fallbackCards: Card[] = await fallbackRes.json();
					this.cards = fallbackCards;
					localStorage.setItem('rf_cards_cache', JSON.stringify(fallbackCards));
					this.notify();
				}
			}
		} catch (err) {
			console.warn('Modalità offline o errore durante il caricamento delle card:', err);
		} finally {
			this.loading = false;
		}
	}

	public get list(): Card[] {
		return this.cards;
	}

	public async addCard(
		newCard: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>
	): Promise<Card | null> {
		const now = new Date().toISOString();
		const card: Card = {
			...newCard,
			id: 'card-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
			createdAt: now,
			updatedAt: now
		};

		try {
			const res = await fetch('/api/cards', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(card)
			});

			if (res.ok) {
				const created = await res.json();
				this.cards = [created, ...this.cards];
			} else {
				this.cards = [card, ...this.cards];
			}
		} catch (e) {
			console.warn('Salvataggio locale in seguito a errore API:', e);
			this.cards = [card, ...this.cards];
		}

		this.saveToStorage();
		this.notify();
		return card;
	}

	public async updateCard(updated: Card): Promise<boolean> {
		updated.updatedAt = new Date().toISOString();
		try {
			const res = await fetch('/api/cards', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updated)
			});
			if (res.ok) {
				const savedCard: Card = await res.json();
				this.cards = this.cards.map((c) => (c.id === savedCard.id ? savedCard : c));
			} else {
				this.cards = this.cards.map((c) => (c.id === updated.id ? updated : c));
			}
		} catch (e) {
			this.cards = this.cards.map((c) => (c.id === updated.id ? updated : c));
		}

		this.saveToStorage();
		this.notify();
		return true;
	}

	public async deleteCard(id: string): Promise<boolean> {
		try {
			await fetch(`/api/cards?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
		} catch (e) {
			console.warn('Errore eliminazione card da API:', e);
		}

		this.cards = this.cards.filter((c) => c.id !== id);
		this.saveToStorage();
		this.notify();
		return true;
	}

	public async resetToDefault() {
		try {
			const res = await fetch('/data/cards.json');
			if (res.ok) {
				const defaultCards = await res.json();
				this.cards = defaultCards;
				this.saveToStorage();
				this.notify();
			}
		} catch (e) {
			console.error('Errore nel ripristino delle card predefinite:', e);
		}
	}

	public async updateCategoryBatch(oldCategory: string, newCategory: string): Promise<number> {
		let count = 0;
		const updatedCards: Card[] = [];

		for (const c of this.cards) {
			if (c.category === oldCategory) {
				count++;
				const updated = { ...c, category: newCategory, updatedAt: new Date().toISOString() };
				updatedCards.push(updated);
			} else {
				updatedCards.push(c);
			}
		}

		if (count > 0) {
			this.cards = updatedCards;
			this.saveToStorage();
			this.notify();

			// Bulk sync to API if available
			for (const updated of updatedCards.filter((c) => c.category === newCategory)) {
				try {
					await fetch('/api/cards', {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(updated)
					});
				} catch (e) {
					console.warn('Errore sync categoria batch API:', e);
				}
			}
		}

		return count;
	}

	private saveToStorage() {
		if (browser) {
			localStorage.setItem('rf_cards_cache', JSON.stringify(this.cards));
		}
	}

	private notify() {
		for (const listener of this.listeners) {
			listener(this.cards);
		}
	}
}

export const cardsStore = new CardsStore();
