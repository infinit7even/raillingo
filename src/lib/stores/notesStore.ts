import { browser } from '$app/environment';
import type { Note } from '$lib/types/notes';
import { toastStore } from '$lib/stores/toastStore';

class NotesStore {
	private notes: Note[] = [];
	private loading = false;
	private listeners = new Set<(notes: Note[]) => void>();
	private hydrated = false;

	public hydrate(initialNotes: Note[] | null | undefined) {
		if (this.hydrated) return;
		this.hydrated = true;

		if (initialNotes && Array.isArray(initialNotes)) {
			this.notes = initialNotes;
			this.notify();
			return;
		}

		this.loadNotes();
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

	public async loadNotes(): Promise<Note[]> {
		if (!browser) return this.notes;
		this.loading = true;

		try {
			const res = await fetch('/api/notes');
			if (res.ok) {
				const freshNotes: Note[] = await res.json();
				this.notes = freshNotes;
				this.notify();
				return freshNotes;
			}
		} catch (e) {
			console.error('Errore caricamento appunti:', e);
		} finally {
			this.loading = false;
		}

		return this.notes;
	}

	public async createNote(noteData: Partial<Note>): Promise<Note | null> {
		try {
			const res = await fetch('/api/notes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(noteData)
			});

			if (res.ok) {
				const created: Note = await res.json();
				this.notes = [created, ...this.notes];
				this.notify();
				toastStore.show({ message: '📝 Appunto salvato con successo!' });
				return created;
			} else {
				const err = await res.json();
				toastStore.show({ message: `⚠️ ${err.error || 'Errore salvataggio'}` });
			}
		} catch (e) {
			console.error('Errore creazione appunto:', e);
			toastStore.show({ message: '⚠️ Errore di connessione' });
		}
		return null;
	}

	public async updateNote(noteData: Partial<Note> & { id: string }): Promise<Note | null> {
		try {
			const res = await fetch('/api/notes', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(noteData)
			});

			if (res.ok) {
				const updated: Note = await res.json();
				this.notes = this.notes.map((n) => (n.id === updated.id ? updated : n));
				this.notify();
				toastStore.show({ message: '✅ Appunto aggiornato!' });
				return updated;
			} else {
				const err = await res.json();
				toastStore.show({ message: `⚠️ ${err.error || 'Errore modifica'}` });
			}
		} catch (e) {
			console.error('Errore aggiornamento appunto:', e);
			toastStore.show({ message: '⚠️ Errore durante il salvataggio' });
		}
		return null;
	}

	public async deleteNote(id: string): Promise<boolean> {
		const backup = [...this.notes];
		this.notes = this.notes.filter((n) => n.id !== id);
		this.notify();

		try {
			const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, {
				method: 'DELETE'
			});

			if (res.ok) {
				toastStore.show({ message: '🗑️ Appunto eliminato' });
				return true;
			} else {
				this.notes = backup;
				this.notify();
				toastStore.show({ message: '⚠️ Impossibile eliminare la nota' });
			}
		} catch (e) {
			this.notes = backup;
			this.notify();
			toastStore.show({ message: '⚠️ Errore di rete' });
		}
		return false;
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
			console.error('Errore sincronizzazione ordine appunti:', e);
		}
	}

	private notify() {
		for (const listener of this.listeners) {
			listener(this.notes);
		}
	}
}

export const notesStore = new NotesStore();
