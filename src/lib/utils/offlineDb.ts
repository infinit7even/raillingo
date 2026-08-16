import { browser } from '$app/environment';
import type { Note } from '$lib/types/notes';

const DB_NAME = 'rf_offline_db';
const DB_VERSION = 1;

export interface OfflineNote extends Note {
	syncStatus: 'synced' | 'pending' | 'deleted';
	localUpdatedAt?: number;
}

export interface PendingMedia {
	id: string;
	blob: Blob;
	filename: string;
	mimeType: string;
	noteId?: string;
	createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function getOfflineDb(): Promise<IDBDatabase> {
	if (!browser) {
		return Promise.reject(new Error('IndexedDB non disponibile lato server'));
	}

	if (dbPromise) return dbPromise;

	dbPromise = new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;

			// Store per gli appunti
			if (!db.objectStoreNames.contains('notes')) {
				const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
				notesStore.createIndex('syncStatus', 'syncStatus', { unique: false });
				notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
			}

			// Store per i media / immagini in attesa di upload
			if (!db.objectStoreNames.contains('pendingMedia')) {
				const mediaStore = db.createObjectStore('pendingMedia', { keyPath: 'id' });
				mediaStore.createIndex('createdAt', 'createdAt', { unique: false });
			}
		};

		request.onsuccess = () => {
			resolve(request.result);
		};

		request.onerror = () => {
			console.error('Errore apertura IndexedDB rf_offline_db:', request.error);
			reject(request.error);
		};
	});

	return dbPromise;
}

// ─── OPERAZIONI SUGLI APPUNTI LOCALI ──────────────────────────────────────

export async function getAllLocalNotes(): Promise<OfflineNote[]> {
	if (!browser) return [];
	try {
		const db = await getOfflineDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction('notes', 'readonly');
			const store = tx.objectStore('notes');
			const request = store.getAll();

			request.onsuccess = () => {
				const results: OfflineNote[] = request.result || [];
				// Non restituire le note contrassegnate per l'eliminazione
				const active = results.filter((n) => n.syncStatus !== 'deleted');
				resolve(active);
			};
			request.onerror = () => reject(request.error);
		});
	} catch (e) {
		console.warn('Errore lettura note locali da IndexedDB:', e);
		return [];
	}
}

export async function getPendingNotes(): Promise<OfflineNote[]> {
	if (!browser) return [];
	try {
		const db = await getOfflineDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction('notes', 'readonly');
			const store = tx.objectStore('notes');
			const request = store.getAll();

			request.onsuccess = () => {
				const results: OfflineNote[] = request.result || [];
				resolve(results.filter((n) => n.syncStatus === 'pending' || n.syncStatus === 'deleted'));
			};
			request.onerror = () => reject(request.error);
		});
	} catch (e) {
		console.warn('Errore lettura note pendenti da IndexedDB:', e);
		return [];
	}
}

export async function putLocalNote(
	note: Note,
	syncStatus: 'synced' | 'pending' | 'deleted' = 'pending'
): Promise<void> {
	if (!browser) return;
	try {
		const db = await getOfflineDb();
		const offlineNote: OfflineNote = {
			...note,
			syncStatus,
			localUpdatedAt: Date.now()
		};

		return new Promise((resolve, reject) => {
			const tx = db.transaction('notes', 'readwrite');
			const store = tx.objectStore('notes');
			const request = store.put(offlineNote);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	} catch (e) {
		console.warn('Errore salvataggio nota locale in IndexedDB:', e);
	}
}

export async function putLocalNotesBatch(
	notes: Note[],
	syncStatus: 'synced' | 'pending' = 'synced'
): Promise<void> {
	if (!browser || notes.length === 0) return;
	try {
		const db = await getOfflineDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction('notes', 'readwrite');
			const store = tx.objectStore('notes');

			for (const note of notes) {
				const offlineNote: OfflineNote = {
					...note,
					syncStatus,
					localUpdatedAt: Date.now()
				};
				store.put(offlineNote);
			}

			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	} catch (e) {
		console.warn('Errore salvataggio batch note in IndexedDB:', e);
	}
}

export async function markLocalNoteDeleted(id: string): Promise<void> {
	if (!browser) return;
	try {
		const db = await getOfflineDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction('notes', 'readwrite');
			const store = tx.objectStore('notes');
			const getReq = store.get(id);

			getReq.onsuccess = () => {
				const note: OfflineNote | undefined = getReq.result;
				if (note) {
					note.syncStatus = 'deleted';
					note.localUpdatedAt = Date.now();
					store.put(note);
				}
				resolve();
			};
			getReq.onerror = () => reject(getReq.error);
		});
	} catch (e) {
		console.warn('Errore marcatura eliminazione nota in IndexedDB:', e);
	}
}

export async function deleteLocalNotePermanently(id: string): Promise<void> {
	if (!browser) return;
	try {
		const db = await getOfflineDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction('notes', 'readwrite');
			const store = tx.objectStore('notes');
			const request = store.delete(id);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	} catch (e) {
		console.warn('Errore eliminazione fisica nota in IndexedDB:', e);
	}
}

// ─── OPERAZIONI SU MEDIA PENDENTI OFFLINE ──────────────────────────────────

export async function savePendingMediaLocal(
	id: string,
	blob: Blob,
	filename: string,
	mimeType: string,
	noteId?: string
): Promise<void> {
	if (!browser) return;
	try {
		const db = await getOfflineDb();
		const record: PendingMedia = {
			id,
			blob,
			filename,
			mimeType,
			noteId,
			createdAt: Date.now()
		};

		return new Promise((resolve, reject) => {
			const tx = db.transaction('pendingMedia', 'readwrite');
			const store = tx.objectStore('pendingMedia');
			const request = store.put(record);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	} catch (e) {
		console.warn('Errore salvataggio media pendente in IndexedDB:', e);
	}
}

export async function getAllPendingMedia(): Promise<PendingMedia[]> {
	if (!browser) return [];
	try {
		const db = await getOfflineDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction('pendingMedia', 'readonly');
			const store = tx.objectStore('pendingMedia');
			const request = store.getAll();

			request.onsuccess = () => resolve(request.result || []);
			request.onerror = () => reject(request.error);
		});
	} catch (e) {
		console.warn('Errore lettura media pendenti da IndexedDB:', e);
		return [];
	}
}

export async function removePendingMediaLocal(id: string): Promise<void> {
	if (!browser) return;
	try {
		const db = await getOfflineDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction('pendingMedia', 'readwrite');
			const store = tx.objectStore('pendingMedia');
			const request = store.delete(id);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	} catch (e) {
		console.warn('Errore rimozione media pendente da IndexedDB:', e);
	}
}
