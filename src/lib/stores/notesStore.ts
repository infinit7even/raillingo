import { browser } from '$app/environment';
import type { Note } from '$lib/types/notes';
import { toastStore } from '$lib/stores/toastStore';

const STORAGE_KEY = 'rf_notes_cache';

class NotesStore {
	private notes: Note[] = [];
	private loading = false;
	private listeners = new Set<(notes: Note[]) => void>();
	private hydrated = false;

	public hydrate(initialNotes: Note[] | null | undefined) {
		if (this.hydrated) return;
		this.hydrated = true;

		// 1. Dati SSR ricevuti dal server
		if (initialNotes && Array.isArray(initialNotes) && initialNotes.length > 0) {
			this.notes = initialNotes;
			this.saveToStorage();
			this.notify();
			return;
		}

		// 2. Fallback offline: carica subito da localStorage
		this.loadFromLocalStorage();

		// 3. Tenta sincronizzazione con il server in background
		if (browser) {
			this.loadNotes();
		}
	}

	public subscribe(run: (notes: Note[]) => void): () => void {
		this.listeners.add(run);
		run(this.notes);
		return () => {
			this.listeners.delete(run);
		};
	}

	public get currentNotes(): Note[] {
		return this.notes;
	}

	private loadFromLocalStorage() {
		if (!browser) return;
		try {
			const cached = localStorage.getItem(STORAGE_KEY);
			if (cached) {
				const parsed = JSON.parse(cached);
				if (Array.isArray(parsed)) {
					this.notes = parsed;
					this.notify();
				}
			}
		} catch (e) {
			console.warn('Errore lettura cache note da localStorage:', e);
		}
	}

	public async loadNotes(): Promise<Note[]> {
		if (!browser) return this.notes;
		this.loading = true;

		try {
			const res = await fetch('/api/notes');
			if (res.ok) {
				const freshNotes: Note[] = await res.json();
				if (Array.isArray(freshNotes)) {
					this.notes = freshNotes;
					this.saveToStorage();
					this.notify();
					return freshNotes;
				}
			}
		} catch (e) {
			console.warn('Modalità offline o errore durante il caricamento note da API:', e);
			// Se siamo offline, assicurati che i dati locali siano caricati
			if (this.notes.length === 0) {
				this.loadFromLocalStorage();
			}
		} finally {
			this.loading = false;
		}

		return this.notes;
	}

	public async createNote(noteData: Partial<Note>): Promise<Note | null> {
		const now = new Date().toISOString();
		const localId = noteData.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'note-' + Date.now());

		const newNote: Note = {
			id: localId,
			userId: noteData.userId || 'local-user',
			title: noteData.title?.trim() || 'Nuovo Appunto',
			content: noteData.content || '',
			category: noteData.category?.trim() || 'Normativa RFI',
			tags: noteData.tags || [],
			images: noteData.images || [],
			isPinned: Boolean(noteData.isPinned),
			order: typeof noteData.order === 'number' ? noteData.order : this.notes.length + 1,
			createdAt: noteData.createdAt || now,
			updatedAt: now
		};

		// 1. Salvataggio locale immediato (optimistic)
		this.notes = [newNote, ...this.notes];
		this.saveToStorage();
		this.notify();

		// 2. Sincronizzazione con il server API
		try {
			const res = await fetch('/api/notes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newNote)
			});

			if (res.ok) {
				const serverCreated: Note = await res.json();
				this.notes = this.notes.map((n) => (n.id === localId ? serverCreated : n));
				this.saveToStorage();
				this.notify();
				toastStore.show({ message: '📝 Appunto salvato con successo!' });
				return serverCreated;
			} else {
				toastStore.show({ message: '📝 Appunto salvato in locale (offline)' });
			}
		} catch {
			toastStore.show({ message: '📝 Appunto salvato in locale (offline)' });
		}

		return newNote;
	}

	public async updateNote(noteData: Partial<Note> & { id: string }): Promise<Note | null> {
		const now = new Date().toISOString();
		const index = this.notes.findIndex((n) => n.id === noteData.id);
		if (index === -1) return null;

		const updated: Note = {
			...this.notes[index],
			...noteData,
			updatedAt: now
		};

		// 1. Salvataggio locale immediato
		this.notes = this.notes.map((n) => (n.id === updated.id ? updated : n));
		this.saveToStorage();
		this.notify();

		// 2. Sincronizzazione con il server API
		try {
			const res = await fetch('/api/notes', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updated)
			});

			if (res.ok) {
				const saved: Note = await res.json();
				this.notes = this.notes.map((n) => (n.id === saved.id ? saved : n));
				this.saveToStorage();
				this.notify();
				return saved;
			}
		} catch {
			// Silenzioso — la nota è già salvata in localStorage
		}

		return updated;
	}

	public async deleteNote(id: string): Promise<boolean> {
		this.notes = this.notes.filter((n) => n.id !== id);
		this.saveToStorage();
		this.notify();

		try {
			const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, {
				method: 'DELETE'
			});

			if (res.ok) {
				toastStore.show({ message: '🗑️ Appunto eliminato' });
				return true;
			} else {
				toastStore.show({ message: '🗑️ Appunto rimosso in locale' });
			}
		} catch {
			toastStore.show({ message: '🗑️ Appunto rimosso in locale (offline)' });
		}
		return true;
	}

	public async togglePin(id: string): Promise<void> {
		const note = this.notes.find((n) => n.id === id);
		if (!note) return;

		const isPinned = !note.isPinned;
		await this.updateNote({ id, isPinned });
	}

	public async moveNote(id: string, direction: 'up' | 'down'): Promise<void> {
		const idx = this.notes.findIndex((n) => n.id === id);
		if (idx === -1) return;

		const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
		if (targetIdx < 0 || targetIdx >= this.notes.length) return;

		const reordered = [...this.notes];
		const temp = reordered[idx];
		reordered[idx] = reordered[targetIdx];
		reordered[targetIdx] = temp;

		// Assegna nuovi valori di order decrescenti
		const updatedItems = reordered.map((item, index) => ({
			...item,
			order: reordered.length - index
		}));

		this.notes = updatedItems;
		this.saveToStorage();
		this.notify();

		await this.syncOrder(updatedItems.map((n) => ({ id: n.id, order: n.order })));
	}

	public async syncOrder(items: { id: string; order: number }[]): Promise<void> {
		try {
			await fetch('/api/notes', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ items })
			});
		} catch (e) {
			console.warn('Errore sync ordine appunti API:', e);
		}
	}

	private saveToStorage() {
		if (browser) {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notes));
			} catch (e) {
				console.warn('Spazio localStorage esaurito o errore salvataggio:', e);
			}
		}
	}

	private notify() {
		for (const listener of this.listeners) {
			listener(this.notes);
		}
	}
}

export const notesStore = new NotesStore();
