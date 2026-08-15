/**
 * Utility per la compressione client-side di immagini prima dell'upload.
 * Supporta formati PNG, JPG, WebP e comprime in WebP ottimizzato (o JPEG di fallback).
 */

export interface CompressionOptions {
	maxSizeMB?: number;
	maxWidth?: number;
	maxHeight?: number;
	quality?: number;
}

export async function compressImage(
	file: File | Blob,
	options: CompressionOptions = {}
): Promise<File> {
	const maxSizeMB = options.maxSizeMB ?? 1;
	const maxWidth = options.maxWidth ?? 1920;
	const maxHeight = options.maxHeight ?? 1920;
	const initialQuality = options.quality ?? 0.82;

	return new Promise((resolve, reject) => {
		const img = new Image();
		const objectUrl = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(objectUrl);

			let width = img.naturalWidth || img.width;
			let height = img.naturalHeight || img.height;

			// Scala mantenendo le proporzioni se supera le dimensioni massime
			if (width > maxWidth || height > maxHeight) {
				const ratio = Math.min(maxWidth / width, maxHeight / height);
				width = Math.round(width * ratio);
				height = Math.round(height * ratio);
			}

			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;

			const ctx = canvas.getContext('2d');
			if (!ctx) {
				reject(new Error('Impossibile ottenere il contesto 2D del canvas'));
				return;
			}

			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = 'high';
			ctx.drawImage(img, 0, 0, width, height);

			function attemptBlob(quality: number) {
				canvas.toBlob(
					(blob) => {
						if (!blob) {
							reject(new Error('Compressione immagine fallita'));
							return;
						}

						const maxSizeBytes = maxSizeMB * 1024 * 1024;
						if (blob.size > maxSizeBytes && quality > 0.4) {
							// Se supera ancora 1MB, riduci progressivamente la qualità
							attemptBlob(quality - 0.15);
							return;
						}

						const filename = `pasted-img-${Date.now()}.webp`;
						const compressedFile = new File([blob], filename, { type: 'image/webp' });
						resolve(compressedFile);
					},
					'image/webp',
					quality
				);
			}

			attemptBlob(initialQuality);
		};

		img.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			reject(new Error('Formato immagine non valido'));
		};

		img.src = objectUrl;
	});
}
