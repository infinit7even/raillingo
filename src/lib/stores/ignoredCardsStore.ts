import { browser } from '$app/environment';

class IgnoredCardsStore {
	private ignoredIds = new Set<string>();
	private listeners = new Set<(ids: Set<string>) => void>();

	constructor() {
		if (browser) {
			this.loadIgnoredCards();
		}
	}

	public subscribe(run: (ids: Set<string>) => void): () => void {
		this.listeners.add(run);
		run(new Set(this.ignoredIds));
		return () => {
			this.listeners.delete(run);
		};
	}

	private getCookie(name: string): string | null {
		if (!browser) return null;
		const nameEQ = name + '=';
		const ca = document.cookie.split(';');
		for (let i = 0; i < ca.length; i++) {
			let c = ca[i];
			while (c.charAt(0) === ' ') c = c.substring(1, c.length);
			if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
		}
		return null;
	}

	private setCookie(name: string, value: string, days = 365) {
		if (!browser) return;
		const date = new Date();
		date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
		const expires = '; expires=' + date.toUTCString();
		document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
	}

	private async loadIgnoredCards() {
		// 1. Try reading localStorage or cookie
		let parsed: string[] | null = null;
		try {
			const localVal = localStorage.getItem('rf_ignored_cards');
			if (localVal) {
				parsed = JSON.parse(localVal);
			}
		} catch {}

		if (!parsed) {
			const cookieVal = this.getCookie('rf_ignored_cards');
			if (cookieVal) {
				try {
					parsed = JSON.parse(cookieVal);
				} catch {}
			}
		}

		if (Array.isArray(parsed)) {
			this.ignoredIds = new Set(parsed);
			this.notify();
		}

		// 2. Fetch from API (syncs with user session if logged in)
		try {
			const res = await fetch('/api/ignored-cards');
			if (res.ok) {
				const data = await res.json();
				if (Array.isArray(data.ignoredCardIds)) {
					this.ignoredIds = new Set(data.ignoredCardIds);
					this.saveToStorage();
					this.notify();
				}
			}
		} catch (e) {
			console.warn('Impossibile sincronizzare le card ignorate via API:', e);
		}
	}

	public isIgnored(cardId: string): boolean {
		return this.ignoredIds.has(cardId);
	}

	public async toggleIgnored(cardId: string): Promise<boolean> {
		if (this.ignoredIds.has(cardId)) {
			this.ignoredIds.delete(cardId);
		} else {
			this.ignoredIds.add(cardId);
		}

		this.saveToStorage();
		this.notify();

		// Sync with server API
		try {
			await fetch('/api/ignored-cards', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ignoredCardIds: Array.from(this.ignoredIds) })
			});
		} catch (e) {
			console.warn('Errore sync API card ignorate:', e);
		}

		return this.isIgnored(cardId);
	}

	public get list(): string[] {
		return Array.from(this.ignoredIds);
	}

	public async clearAll(): Promise<void> {
		this.ignoredIds.clear();
		this.saveToStorage();
		this.notify();

		try {
			await fetch('/api/ignored-cards', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ignoredCardIds: [] })
			});
		} catch (e) {
			console.warn('Errore reset API card ignorate:', e);
		}
	}

	public async setIgnoredIds(ids: string[]): Promise<void> {
		this.ignoredIds = new Set(ids);
		this.saveToStorage();
		this.notify();

		try {
			await fetch('/api/ignored-cards', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ignoredCardIds: Array.from(this.ignoredIds) })
			});
		} catch (e) {
			console.warn('Errore sync API card ignorate:', e);
		}
	}

	private saveToStorage() {
		const arr = Array.from(this.ignoredIds);
		const jsonStr = JSON.stringify(arr);
		this.setCookie('rf_ignored_cards', jsonStr);
		if (browser) {
			try {
				localStorage.setItem('rf_ignored_cards', jsonStr);
			} catch {}
		}
	}

	private notify() {
		for (const listener of this.listeners) {
			listener(new Set(this.ignoredIds));
		}
	}
}

export const ignoredCardsStore = new IgnoredCardsStore();
