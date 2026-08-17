import { browser } from '$app/environment';
import type { Card } from '$lib/types/cards';

class CardsStore {
	private cards: Card[] = [];
	private loading = false;
	private listeners = new Set<(cards: Card[]) => void>();

	private hydrated = false;

	constructor() {}

	/** Inizializza lo store con i dati provenienti dal server (SSR). */
	public hydrate(initialCards: Card[] | null | undefined) {
		if (this.hydrated) return;
		this.hydrated = true;

		if (initialCards && initialCards.length > 0) {
			this.cards = initialCards.filter((c) => !c.isDeleted);
			this.saveToStorage();
			this.notify();
			return;
		}

		// Fallback: cache locale + API
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

			// 2. Fetch fresh cards from API
			const res = await fetch('/api/cards');
			if (res.ok) {
				const freshCards: Card[] = await res.json();
				this.cards = freshCards.filter((c) => !c.isDeleted);
				this.saveToStorage();
				this.notify();
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

	public async fetchTrash(): Promise<Card[]> {
		try {
			const res = await fetch('/api/cards?trash=true');
			if (res.ok) {
				return await res.json();
			}
			return [];
		} catch (err) {
			console.error('Errore caricamento cestino card:', err);
			return [];
		}
	}

	public async addCard(
		newCard: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>
	): Promise<Card> {
		const now = new Date().toISOString();
		const cardPayload: Card = {
			...newCard,
			id: 'card-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
			createdAt: now,
			updatedAt: now
		};

		const res = await fetch('/api/cards', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(cardPayload)
		});

		if (!res.ok) {
			const errData = await res.json().catch(() => ({ error: 'Errore salvataggio server' }));
			throw new Error(errData.error || `Errore salvataggio scheda (${res.status})`);
		}

		const created: Card = await res.json();
		this.cards = [created, ...this.cards.filter((c) => c.id !== created.id)];
		this.saveToStorage();
		this.notify();
		return created;
	}

	public async updateCard(updated: Card): Promise<Card> {
		const payload = {
			...updated,
			updatedAt: new Date().toISOString()
		};

		const res = await fetch('/api/cards', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		if (!res.ok) {
			const errData = await res.json().catch(() => ({ error: 'Errore modifica server' }));
			throw new Error(errData.error || `Errore aggiornamento scheda (${res.status})`);
		}

		const savedCard: Card = await res.json();
		this.cards = this.cards.map((c) => (c.id === savedCard.id ? savedCard : c));
		this.saveToStorage();
		this.notify();
		return savedCard;
	}

	/** Sposta la scheda nel cestino (soft-delete) */
	public async deleteCard(id: string): Promise<boolean> {
		const res = await fetch(`/api/cards?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
		if (!res.ok) {
			const errData = await res.json().catch(() => ({ error: 'Errore eliminazione server' }));
			throw new Error(errData.error || `Errore eliminazione scheda (${res.status})`);
		}

		this.cards = this.cards.filter((c) => c.id !== id);
		this.saveToStorage();
		this.notify();
		return true;
	}

	/** Ripristina una scheda dal cestino */
	public async restoreCard(id: string): Promise<boolean> {
		const res = await fetch('/api/cards', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'restore', id })
		});

		if (!res.ok) {
			const errData = await res.json().catch(() => ({ error: 'Errore ripristino scheda' }));
			throw new Error(errData.error || `Errore ripristino scheda (${res.status})`);
		}

		// Ricarica la lista attiva
		await this.loadFromStorageOrApi();
		return true;
	}

	/** Elimina definitivamente una scheda e le sue immagini dal disco e dal database */
	public async permanentDeleteCard(id: string): Promise<boolean> {
		const res = await fetch(`/api/cards?id=${encodeURIComponent(id)}&permanent=true`, {
			method: 'DELETE'
		});

		if (!res.ok) {
			const errData = await res.json().catch(() => ({ error: 'Errore eliminazione definitiva' }));
			throw new Error(errData.error || `Errore eliminazione definitiva (${res.status})`);
		}

		this.cards = this.cards.filter((c) => c.id !== id);
		this.saveToStorage();
		this.notify();
		return true;
	}

	public async updateCategoryBatch(oldCategory: string, newCategory: string): Promise<number> {
		const oldCat = oldCategory.trim();
		const newCat = newCategory.trim();

		if (!oldCat || !newCat || oldCat === newCat) return 0;

		const res = await fetch('/api/admin/categories', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ oldCategory: oldCat, newCategory: newCat })
		});

		if (!res.ok) {
			const errData = await res.json().catch(() => ({ error: 'Errore durante la modifica della categoria' }));
			throw new Error(errData.error || `Errore rinomina categoria (${res.status})`);
		}

		const data = await res.json();
		this.cards = this.cards.map((c) => {
			if ((c.category || '').trim() === oldCat) {
				return { ...c, category: newCat };
			}
			return c;
		});
		this.saveToStorage();
		this.notify();
		return data.count || 0;
	}

	private saveToStorage() {
		if (browser) {
			try {
				localStorage.setItem('rf_cards_cache', JSON.stringify(this.cards));
			} catch (e) {
				console.error('Errore salvataggio card in localStorage:', e);
			}
		}
	}

	private notify() {
		for (const listener of this.listeners) {
			listener(this.cards);
		}
	}
}

export const cardsStore = new CardsStore();
