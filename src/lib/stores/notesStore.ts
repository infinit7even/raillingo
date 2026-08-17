import { browser } from '$app/environment';
import type { Note } from '$lib/types/notes';
import { toastStore } from '$lib/stores/toastStore';

const BASE_STORAGE_KEY = 'rf_notes_vault';
const PENDING_KEY = 'rf_notes_pending_sync';

class NotesStore {
	private notes: Note[] = [];
	private listeners = new Set<(notes: Note[]) => void>();
	private currentUserId: string | null = null;
	private hydrated = false;

	private getStorageKey(): string {
		return `${BASE_STORAGE_KEY}_${this.currentUserId || 'guest'}`;
	}

	private handleOnline = () => {
		this.syncPending();
	};

	public hydrate(initialNotes: Note[] | null | undefined, userId?: string | null) {
		const newUserId = userId || 'guest';
		const userChanged = this.currentUserId !== newUserId;

		if (userChanged) {
			this.currentUserId = newUserId;
			this.hydrated = false;
		}

		if (!this.hydrated || userChanged) {
			this.hydrated = true;

			if (initialNotes && Array.isArray(initialNotes)) {
				this.notes = initialNotes.filter((n) => !n.isDeleted);
				this.saveToStorage();
				this.notify();
			} else {
				this.loadFromStorage();
			}
		}

		if (browser) {
			this.syncPending();
			window.removeEventListener('online', this.handleOnline);
			window.addEventListener('online', this.handleOnline);
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

	private loadFromStorage() {
		if (!browser) return;
		try {
			const raw = localStorage.getItem(this.getStorageKey());
			if (raw) {
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed)) {
					this.notes = parsed.filter((n) => !n.isDeleted);
					this.notify();
					return;
				}
			}
			this.notes = [];
			this.notify();
		} catch (e) {
			console.warn('Errore lettura note locali:', e);
		}
	}

	private saveToStorage() {
		if (browser) {
			try {
				localStorage.setItem(this.getStorageKey(), JSON.stringify(this.notes));
			} catch (e) {
				console.warn('Errore salvataggio note locali:', e);
			}
		}
	}

	private notify() {
		for (const listener of this.listeners) {
			listener(this.notes);
		}
	}

	public async loadNotes(): Promise<Note[]> {
		if (!browser) return this.notes;

		try {
			const res = await fetch('/api/notes');
			if (res.ok) {
				const fresh: Note[] = await res.json();
				if (Array.isArray(fresh)) {
					this.notes = fresh.filter((n) => !n.isDeleted);
					this.saveToStorage();
					this.notify();
					return this.notes;
				}
			}
		} catch (e) {
			console.warn('Caricamento note da API non riuscito (offline):', e);
		}

		return this.notes;
	}

	public async fetchTrash(): Promise<Note[]> {
		try {
			const res = await fetch('/api/notes?trash=true');
			if (res.ok) {
				const list = await res.json();
				return Array.isArray(list) ? list : [];
			}
			return [];
		} catch (err) {
			console.error('Errore caricamento cestino note:', err);
			return [];
		}
	}

	public async createNote(noteData: Partial<Note>): Promise<Note> {
		const now = new Date().toISOString();
		const localId =
			noteData.id ||
			(typeof crypto !== 'undefined' && crypto.randomUUID
				? crypto.randomUUID()
				: 'note-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7));

		const newNote: Note = {
			id: localId,
			userId: noteData.userId || 'local-user',
			title: noteData.title?.trim() || 'Nuovo Appunto',
			content: noteData.content || '',
			category: noteData.category?.trim() || 'Normativa RFI',
			tags: noteData.tags || [],
			images: noteData.images || [],
			isPinned: Boolean(noteData.isPinned),
			isPublic: Boolean(noteData.isPublic),
			shareId: noteData.shareId || localId,
			order: typeof noteData.order === 'number' ? noteData.order : this.notes.length + 1,
			isDeleted: false,
			createdAt: noteData.createdAt || now,
			updatedAt: now
		};

		// Aggiornamento locale istantaneo
		this.notes = [newNote, ...this.notes.filter((n) => n.id !== localId)];
		this.saveToStorage();
		this.notify();

		if (browser) {
			try {
				const res = await fetch('/api/notes', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(newNote)
				});

				if (res.ok) {
					const created: Note = await res.json();
					this.notes = this.notes.map((n) => (n.id === localId ? created : n));
					this.saveToStorage();
					this.notify();
					return created;
				} else {
					this.addPending(newNote, 'save');
				}
			} catch {
				this.addPending(newNote, 'save');
			}
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

		// Aggiornamento locale istantaneo
		this.notes = this.notes.map((n) => (n.id === updated.id ? updated : n));
		this.saveToStorage();
		this.notify();

		if (browser) {
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
				} else {
					this.addPending(updated, 'save');
				}
			} catch {
				this.addPending(updated, 'save');
			}
		}

		return updated;
	}

	/** Sposta l'appunto nel cestino (soft delete) */
	public async deleteNote(id: string): Promise<boolean> {
		this.notes = this.notes.filter((n) => n.id !== id);
		this.saveToStorage();
		this.notify();

		if (browser) {
			try {
				const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, {
					method: 'DELETE'
				});

				if (!res.ok) {
					this.addPending({ id } as Note, 'delete');
				}
			} catch {
				this.addPending({ id } as Note, 'delete');
			}
		}

		toastStore.show({ message: '🗑️ Appunto spostato nel cestino' });
		return true;
	}

	/** Ripristina l'appunto dal cestino */
	public async restoreNote(id: string): Promise<boolean> {
		if (browser) {
			try {
				const res = await fetch('/api/notes', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'restore', id })
				});

				if (res.ok) {
					await this.loadNotes();
					toastStore.show({ message: '♻️ Appunto ripristinato con successo!' });
					return true;
				}
			} catch (e) {
				console.error('Errore ripristino appunto:', e);
			}
		}
		return false;
	}

	/** Elimina definitivamente l'appunto e le sue immagini */
	public async permanentDeleteNote(id: string): Promise<boolean> {
		if (browser) {
			try {
				const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}&permanent=true`, {
					method: 'DELETE'
				});

				if (res.ok) {
					toastStore.show({ message: '✕ Appunto eliminato definitivamente' });
					return true;
				}
			} catch (e) {
				console.error('Errore eliminazione definitiva appunto:', e);
			}
		}
		return false;
	}

	public async togglePin(id: string): Promise<void> {
		const note = this.notes.find((n) => n.id === id);
		if (!note) return;
		await this.updateNote({ id, isPinned: !note.isPinned });
	}

	public async togglePublicShare(id: string): Promise<string | null> {
		const note = this.notes.find((n) => n.id === id);
		if (!note) return null;

		const isPublic = !note.isPublic;
		const shareId = note.shareId || id;
		await this.updateNote({ id, isPublic, shareId });

		return isPublic ? shareId : null;
	}

	// ─── SINCRONIZZAZIONE AUTOMATICA SILENZIOSA QUANDO ONLINE ───────────────

	private addPending(note: Note, action: 'save' | 'delete') {
		if (!browser) return;
		try {
			const current = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
			const filtered = current.filter((item: any) => item.note.id !== note.id);
			filtered.push({ note, action, time: Date.now() });
			localStorage.setItem(PENDING_KEY, JSON.stringify(filtered));
		} catch (e) {
			console.warn('Errore salvataggio coda offline:', e);
		}
	}

	public async syncPending(): Promise<void> {
		if (!browser || !navigator.onLine) return;

		try {
			const raw = localStorage.getItem(PENDING_KEY);
			if (!raw) return;
			const pending: { note: Note; action: 'save' | 'delete' }[] = JSON.parse(raw);
			if (!Array.isArray(pending) || pending.length === 0) return;

			let synced = 0;
			const remaining: typeof pending = [];

			for (const item of pending) {
				try {
					if (item.action === 'delete') {
						await fetch(`/api/notes?id=${encodeURIComponent(item.note.id)}`, {
							method: 'DELETE'
						});
						synced++;
					} else {
						const res = await fetch('/api/notes', {
							method: 'PUT',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(item.note)
						});
						if (res.ok) {
							synced++;
						} else {
							const postRes = await fetch('/api/notes', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(item.note)
							});
							if (postRes.ok) synced++;
							else remaining.push(item);
						}
					}
				} catch {
					remaining.push(item);
				}
			}

			localStorage.setItem(PENDING_KEY, JSON.stringify(remaining));

			if (synced > 0) {
				console.log(`[Auto-Sync] Sincronizzati ${synced} appunti con PostgreSQL.`);
				await this.loadNotes();
			}
		} catch (e) {
			console.warn('Errore durante sync automatico note:', e);
		}
	}
}

export const notesStore = new NotesStore();
