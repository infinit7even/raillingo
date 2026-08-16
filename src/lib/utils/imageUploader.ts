import { compressImage } from '$lib/utils/imageCompressor';

export interface ImageUploadOptions {
	context: 'card' | 'note';
	maxSizeMB?: number;
	maxWidth?: number;
	maxHeight?: number;
	quality?: number;
}

export interface ImageUploadResult {
	url: string;
	filename?: string;
	size: number;
	isOffline?: boolean;
	blob?: Blob;
}

/**
 * Funzione unificata per la compressione e il caricamento di immagini
 * utilizzata sia per le schede (Admin) che per gli appunti (Note).
 */
export async function uploadImage(
	fileOrBlob: File | Blob,
	options: ImageUploadOptions = { context: 'note' }
): Promise<ImageUploadResult> {
	// 1. Comprime l'immagine client-side in WebP ad alte prestazioni
	const compressedFile = await compressImage(fileOrBlob, {
		maxSizeMB: options.maxSizeMB ?? (options.context === 'card' ? 3 : 2),
		maxWidth: options.maxWidth ?? 1920,
		maxHeight: options.maxHeight ?? 1920,
		quality: options.quality ?? 0.85
	});

	// Se il browser è offline, ritorna subito il blob locale con Object URL
	if (typeof navigator !== 'undefined' && !navigator.onLine) {
		const localUrl = URL.createObjectURL(compressedFile);
		return {
			url: localUrl,
			filename: compressedFile.name,
			size: compressedFile.size,
			isOffline: true,
			blob: compressedFile
		};
	}

	const endpoint = options.context === 'card' ? '/api/upload' : '/api/notes/upload';
	const formData = new FormData();
	formData.append('file', compressedFile, compressedFile.name || 'image.webp');

	try {
		const res = await fetch(endpoint, {
			method: 'POST',
			body: formData
		});

		if (!res.ok) {
			let errorMsg = `Errore di caricamento (${res.status})`;
			try {
				const data = await res.json();
				if (data.error) errorMsg = data.error;
			} catch {
				// Fallback
			}
			throw new Error(errorMsg);
		}

		const data = await res.json();
		return {
			url: data.url,
			filename: data.filename,
			size: data.size || compressedFile.size,
			isOffline: false
		};
	} catch (err: any) {
		// Se la chiamata fallisce per problemi di rete, consenti fallback offline per le note
		if (options.context === 'note') {
			console.warn('Rete non disponibile, fallback a memorizzazione offline per immagine nota:', err);
			const localUrl = URL.createObjectURL(compressedFile);
			return {
				url: localUrl,
				filename: compressedFile.name,
				size: compressedFile.size,
				isOffline: true,
				blob: compressedFile
			};
		}
		throw err;
	}
}
