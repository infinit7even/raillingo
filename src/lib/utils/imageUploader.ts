import { compressImage } from "$lib/utils/imageCompressor";

export interface ImageUploadOptions {
	context?: "card";
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
 * Funzione unificata per la compressione e il caricamento di immagini delle schede.
 */
export async function uploadImage(
	fileOrBlob: File | Blob,
	options: ImageUploadOptions = { context: "card" }
): Promise<ImageUploadResult> {
	// 1. Comprime l'immagine client-side in WebP ad alte prestazioni
	const compressedFile = await compressImage(fileOrBlob, {
		maxSizeMB: options.maxSizeMB ?? 3,
		maxWidth: options.maxWidth ?? 1920,
		maxHeight: options.maxHeight ?? 1920,
		quality: options.quality ?? 0.85
	});

	// Se il browser è offline, ritorna subito il blob locale con Object URL
	if (typeof navigator !== "undefined" && !navigator.onLine) {
		const localUrl = URL.createObjectURL(compressedFile);
		return {
			url: localUrl,
			filename: compressedFile.name,
			size: compressedFile.size,
			isOffline: true,
			blob: compressedFile
		};
	}

	const endpoint = "/api/upload";
	const formData = new FormData();
	formData.append("file", compressedFile, compressedFile.name || "image.webp");

	try {
		const res = await fetch(endpoint, {
			method: "POST",
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
		throw err;
	}
}
