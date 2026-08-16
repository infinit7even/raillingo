import { browser } from '$app/environment';
import type { Note } from '$lib/types/notes';
import { toastStore } from '$lib/stores/toastStore';
import { uploadImage } from '$lib/utils/imageUploader';
import {
	getAllLocalNotes,
	getAllPendingMedia,
	getPendingNotes,
	putLocalNote,
	putLocalNotesBatch,
	removePendingMediaLocal,
	deleteLocalNotePermanently,
	type OfflineNote,
	type PendingMedia
} from '$lib/utils/offlineDb';

export type SyncState = 'synced' | 'syncing' | 'pending' | 'offline';

type SyncListener = (state: SyncState, pendingCount: number) => void;

class OfflineNotesSyncManager {
	private syncState: SyncState = 'synced';
	private pendingCount = 0;
	private listeners = new Set<SyncListener>();
	private isSyncing = false;
	private initDone = false;

	public init() {
		if (!browser || this.initDone) return;
		this.initDone = true;

		// Aggiorna lo stato iniziale
		this.updateState(navigator.onLine ? 'synced' : 'offline');

		// Ascolta eventi di rete del browser
		window.addEventListener('online', () => {
			console.log('📡 Rete ripristinata: avvio sincronizzazione automatica...');
			this.updateState('syncing');
			this.syncAll(true);
		});

		window.addEventListener('offline', () => {
			console.log('📡 Rete assente: passaggio a modalità offline...');
			this.updateState('offline');
		});

		// Esegui controllo periodico ogni 30 secondi
		setInterval(() => {
			if (navigator.onLine && !this.isSyncing) {
				this.checkPendingAndSync();
			}
		}, 30000);
	}

	public subscribe(listener: SyncListener): () => void {
		this.listeners.add(listener);
		listener(this.syncState, this.pendingCount);
		return () => {
			this.listeners.delete(listener);
		};
	}

	public getState(): { state: SyncState; pendingCount: number } {
		return { state: this.syncState, pendingCount: this.pendingCount };
	}

	private updateState(state: SyncState, pendingCount?: number) {
		this.syncState = state;
		if (pendingCount !== undefined) {
			this.pendingCount = pendingCount;
		}
		for (const listener of this.listeners) {
			listener(this.syncState, this.pendingCount);
		}
	}

	/**
	 * Controlla se vi sono elementi in sospeso e avvia la sincronizzazione.
	 */
	public async checkPendingAndSync(): Promise<void> {
		if (!browser || this.isSyncing) return;
		const [pendingNotes, pendingMedia] = await Promise.all([
			getPendingNotes(),
			getAllPendingMedia()
		]);

		const totalPending = pendingNotes.length + pendingMedia.length;
		this.pendingCount = totalPending;

		if (!navigator.onLine) {
			this.updateState('offline', totalPending);
			return;
		}

		if (totalPending > 0) {
			await this.syncAll(false);
		} else {
			this.updateState('synced', 0);
		}
	}

	/**
	 * Esegue la sincronizzazione completa di media e note.
	 */
	public async syncAll(notifyUser = false): Promise<{ syncedCount: number; errors: number }> {
		if (!browser || this.isSyncing) return { syncedCount: 0, errors: 0 };
		if (!navigator.onLine) {
			this.updateState('offline');
			return { syncedCount: 0, errors: 0 };
		}

		this.isSyncing = true;
		this.updateState('syncing');

		let syncedCount = 0;
		let errors = 0;

		try {
			// 1. Sincronizzazione Immagini Pendenti
			const pendingMedia = await getAllPendingMedia();
			const mediaUrlReplacements = new Map<string, string>();

			for (const media of pendingMedia) {
				try {
					const uploadRes = await uploadImage(media.blob, { context: 'note' });
					if (uploadRes.url && !uploadRes.isOffline) {
						mediaUrlReplacements.set(media.id, uploadRes.url);
						await removePendingMediaLocal(media.id);
						syncedCount++;
					}
				} catch (e) {
					console.warn(`Errore upload media pendente ${media.id}:`, e);
					errors++;
				}
			}

			// 2. Sostituzione URL media nelle note locali se presenti
			if (mediaUrlReplacements.size > 0) {
				const allLocal = await getAllLocalNotes();
				for (const note of allLocal) {
					let contentChanged = false;
					let newContent = note.content || '';
					let newImages = [...(note.images || [])];

					for (const [tempId, realUrl] of mediaUrlReplacements.entries()) {
						if (newContent.includes(tempId)) {
							newContent = newContent.replaceAll(tempId, realUrl);
							contentChanged = true;
						}
						// Sostituisci anche nei percorsi images
						const imgIdx = newImages.findIndex((img) => img.includes(tempId));
						if (imgIdx >= 0) {
							newImages[imgIdx] = realUrl;
							contentChanged = true;
						}
					}

					if (contentChanged) {
						const updatedNote: Note = {
							...note,
							content: newContent,
							images: newImages,
							updatedAt: new Date().toISOString()
						};
						await putLocalNote(updatedNote, 'pending');
					}
				}
			}

			// 3. Sincronizzazione Note Pendenti
			const pendingNotes = await getPendingNotes();

			for (const note of pendingNotes) {
				try {
					if (note.syncStatus === 'deleted') {
						// Chiamata DELETE al server
						const res = await fetch(`/api/notes?id=${encodeURIComponent(note.id)}`, {
							method: 'DELETE'
						});
						if (res.ok || res.status === 404) {
							await deleteLocalNotePermanently(note.id);
							syncedCount++;
						} else {
							errors++;
						}
					} else {
						// Tentativo PUT
						const putRes = await fetch('/api/notes', {
							method: 'PUT',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(note)
						});

						if (putRes.ok) {
							const saved: Note = await putRes.json();
							await putLocalNote(saved, 'synced');
							syncedCount++;
						} else if (putRes.status === 404) {
							// Se non esiste sul server, POST
							const postRes = await fetch('/api/notes', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(note)
							});
							if (postRes.ok) {
								const created: Note = await postRes.json();
								await putLocalNote(created, 'synced');
								syncedCount++;
							} else {
								errors++;
							}
						} else {
							errors++;
						}
					}
				} catch (e) {
					console.warn(`Errore sincronizzazione nota ${note.id}:`, e);
					errors++;
				}
			}

			// 4. Se tutto è andato a buon fine, scarica le note aggiornate dal server
			try {
				const freshRes = await fetch('/api/notes');
				if (freshRes.ok) {
					const serverNotes: Note[] = await freshRes.json();
					if (Array.isArray(serverNotes)) {
						await putLocalNotesBatch(serverNotes, 'synced');
					}
				}
			} catch {
				// Ignora se non riesce il fetch finale
			}

			// 5. Aggiorna stato finale
			const remainingPending = (await getPendingNotes()).length + (await getAllPendingMedia()).length;
			this.pendingCount = remainingPending;

			if (remainingPending === 0) {
				this.updateState('synced', 0);
				if (notifyUser && syncedCount > 0) {
					toastStore.show({
						message: `🟢 Sincronizzazione completata: ${syncedCount} ${syncedCount === 1 ? 'elemento sincronizzato' : 'elementi sincronizzati'} sul server!`
					});
				}
			} else {
				this.updateState('pending', remainingPending);
			}
		} catch (err) {
			console.error('Errore durante la procedura di sincronizzazione globale:', err);
			this.updateState(navigator.onLine ? 'pending' : 'offline');
		} finally {
			this.isSyncing = false;
		}

		return { syncedCount, errors };
	}
}

export const offlineNotesSync = new OfflineNotesSyncManager();
