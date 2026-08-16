import { browser } from '$app/environment';
import type { Note } from '$lib/types/notes';
import { toastStore } from '$lib/stores/toastStore';
import {
	getAllLocalNotes,
	putLocalNote,
	putLocalNotesBatch,
	markLocalNoteDeleted,
	savePendingMediaLocal,
	type OfflineNote
} from '$lib/utils/offlineDb';
import { offlineNotesSync, type SyncState } from '$lib/utils/offlineNotesSync';

const STORAGE_KEY = 'rf_notes_cache';

class NotesStore {
	private notes: Note[] = [];
	private loading = false;
	private listeners = new Set<(notes: Note[]) => void>();
	private hydrated = false;

	public async hydrate(initialNotes: Note[] | null | undefined) {
		if (this.hydrated) return;
		this.hydrated = true;

		// Inizializza il sync engine se siamo nel browser
		if (browser) {
			offlineNotesSync.init();
		}

		// 1. Dati SSR ricevuti dal server
		if (initialNotes && Array.isArray(initialNotes) && initialNotes.length > 0) {
			this.notes = initialNotes;
			this.saveToStorage();
			this.notify();
			// Salva anche in IndexedDB in background
			if (browser) {
				putLocalNotesBatch(initialNotes, 'synced');
			}
			return;
		}

		// 2. Fallback offline: carica prima da IndexedDB, poi da localStorage
		if (browser) {
			const localDbNotes = await getAllLocalNotes();
			if (localDbNotes && localDbNotes.length > 0) {
				this.notes = localDbNotes;
				this.notify();
			} else {
				this.loadFromLocalStorage();
			}

			// 3. Tenta sincronizzazione con il server in background
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
				if (Array.isArray(parsed) && parsed.length > 0) {
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
					await putLocalNotesBatch(freshNotes, 'synced');
					this.notify();
					return freshNotes;
				}
			}
		} catch (e) {
			console.warn('Modalità offline o errore durante il caricamento note da API:', e);
			if (this.notes.length === 0) {
				const local = await getAllLocalNotes();
				if (local.length > 0) {
					this.notes = local;
					this.notify();
				} else {
					this.loadFromLocalStorage();
				}
			}
		} finally {
			this.loading = false;
		}

		return this.notes;
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
			order: typeof noteData.order === 'number' ? noteData.order : this.notes.length + 1,
			createdAt: noteData.createdAt || now,
			updatedAt: now
		};

		// 1. Salvataggio locale immediato in memoria e IndexedDB
		this.notes = [newNote, ...this.notes.filter((n) => n.id !== localId)];
		this.saveToStorage();
		this.notify();

		if (browser) {
			const isOnline = navigator.onLine;
			await putLocalNote(newNote, isOnline ? 'synced' : 'pending');

			// 2. Se online, sincronizza subito con il server
			if (isOnline) {
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
						await putLocalNote(serverCreated, 'synced');
						this.notify();
						toastStore.show({ message: '📝 Appunto salvato sul server!' });
						return serverCreated;
					} else {
						await putLocalNote(newNote, 'pending');
						toastStore.show({ message: '📝 Appunto salvato in locale (in attesa di sync)' });
					}
				} catch {
					await putLocalNote(newNote, 'pending');
					toastStore.show({ message: '📝 Appunto salvato in locale (offline)' });
				}
			} else {
				toastStore.show({ message: '📝 Appunto salvato in locale (modalità offline)' });
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

		// 1. Salvataggio locale immediato (UI non aspetta la rete)
		this.notes = this.notes.map((n) => (n.id === updated.id ? updated : n));
		this.saveToStorage();
		this.notify();

		if (browser) {
			const isOnline = navigator.onLine;
			await putLocalNote(updated, isOnline ? 'synced' : 'pending');

			// 2. Se online, invia aggiornamento al server
			if (isOnline) {
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
						await putLocalNote(saved, 'synced');
						this.notify();
						return saved;
					} else {
						await putLocalNote(updated, 'pending');
					}
				} catch {
					await putLocalNote(updated, 'pending');
				}
			}
		}

		return updated;
	}

	public async deleteNote(id: string): Promise<boolean> {
		this.notes = this.notes.filter((n) => n.id !== id);
		this.saveToStorage();
		this.notify();

		if (browser) {
			const isOnline = navigator.onLine;

			if (isOnline) {
				try {
					const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, {
						method: 'DELETE'
					});

					if (res.ok) {
						await markLocalNoteDeleted(id);
						toastStore.show({ message: '🗑️ Appunto eliminato dal server' });
						return true;
					}
				} catch {
					// Fallback
				}
			}

			// Se offline o errore rete, contrassegna come eliminato localmente per il sync
			await markLocalNoteDeleted(id);
			toastStore.show({ message: '🗑️ Appunto eliminato in locale (offline)' });
		}
		return true;
	}

	public async saveOfflineImageBlob(
		blob: Blob,
		filename: string,
		noteId?: string
	): Promise<string> {
		const tempId = `local-media-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
		if (browser) {
			await savePendingMediaLocal(tempId, blob, filename, blob.type || 'image/webp', noteId);
			offlineNotesSync.checkPendingAndSync();
		}
		return tempId;
	}

	public async syncNow(): Promise<void> {
		if (browser) {
			toastStore.show({ message: '🔄 Sincronizzazione in corso...' });
			const result = await offlineNotesSync.syncAll(true);
			await this.loadNotes();
			if (result.errors === 0) {
				toastStore.show({ message: '🟢 Tutti gli appunti sono sincronizzati!' });
			} else {
				toastStore.show({ message: `⚠️ Sincronizzati ${result.syncedCount} elementi, ${result.errors} errori.` });
			}
		}
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

		if (browser) {
			await putLocalNotesBatch(updatedItems, navigator.onLine ? 'synced' : 'pending');
		}

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
