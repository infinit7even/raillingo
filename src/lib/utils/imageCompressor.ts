/**
 * Utility per la compressione client-side di immagini prima dell'upload.
 * Supporta formati PNG, JPG, WebP e converte in WebP ottimizzato con fallback sicuro.
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
	const maxSizeMB = Math.max(0.1, options.maxSizeMB ?? 1);
	const maxWidth = Math.max(100, options.maxWidth ?? 1920);
	const maxHeight = Math.max(100, options.maxHeight ?? 1920);
	const initialQuality = Math.min(1, Math.max(0.1, options.quality ?? 0.82));

	return new Promise((resolve) => {
		let objectUrl = '';
		try {
			objectUrl = URL.createObjectURL(file);
		} catch {
			const safeFile =
				file instanceof File
					? file
					: new File([file], `img-${Date.now()}.png`, { type: file.type || 'image/png' });
			resolve(safeFile);
			return;
		}

		const img = new Image();

		img.onload = () => {
			URL.revokeObjectURL(objectUrl);

			let width = img.naturalWidth || img.width;
			let height = img.naturalHeight || img.height;

			if (!width || !height || width <= 0 || height <= 0) {
				const safeFile =
					file instanceof File
						? file
						: new File([file], `img-${Date.now()}.png`, { type: file.type || 'image/png' });
				resolve(safeFile);
				return;
			}

			// Scala mantenendo le proporzioni se supera le dimensioni massime
			if (width > maxWidth || height > maxHeight) {
				const ratio = Math.min(maxWidth / width, maxHeight / height);
				width = Math.max(1, Math.round(width * ratio));
				height = Math.max(1, Math.round(height * ratio));
			}

			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;

			const ctx = canvas.getContext('2d');
			if (!ctx) {
				const safeFile =
					file instanceof File
						? file
						: new File([file], `img-${Date.now()}.png`, { type: file.type || 'image/png' });
				resolve(safeFile);
				return;
			}

			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = 'high';
			ctx.drawImage(img, 0, 0, width, height);

			function attemptBlob(quality: number) {
				canvas.toBlob(
					(blob) => {
						if (!blob) {
							// Se toBlob 'image/webp' non produce blob, prova con toDataURL o fallback
							try {
								const dataUrl = canvas.toDataURL('image/webp', quality);
								if (dataUrl && dataUrl.startsWith('data:image/')) {
									const arr = dataUrl.split(',');
									const mimeMatch = arr[0].match(/:(.*?);/);
									const mime = mimeMatch ? mimeMatch[1] : 'image/webp';
									const bstr = atob(arr[1]);
									let n = bstr.length;
									const u8arr = new Uint8Array(n);
									while (n--) {
										u8arr[n] = bstr.charCodeAt(n);
									}
									const fallbackBlob = new Blob([u8arr], { type: mime });
									const fallbackFile = new File([fallbackBlob], `img-${Date.now()}.webp`, {
										type: 'image/webp'
									});
									resolve(fallbackFile);
									return;
								}
							} catch {
								// Ignora
							}
							const safeFile =
								file instanceof File
									? file
									: new File([file], `img-${Date.now()}.png`, { type: file.type || 'image/png' });
							resolve(safeFile);
							return;
						}

						const maxSizeBytes = maxSizeMB * 1024 * 1024;
						if (blob.size > maxSizeBytes && quality > 0.3) {
							// Se supera ancora il limite, riduci progressivamente la qualità
							const nextQuality = Math.max(0.15, quality - 0.15);
							attemptBlob(nextQuality);
							return;
						}

						const filename = `img-${Date.now()}.webp`;
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
			// In caso di errore di rendering immagine, ritorna il file originale per non bloccare l'upload
			const safeFile =
				file instanceof File
					? file
					: new File([file], `img-${Date.now()}.png`, { type: file.type || 'image/png' });
			resolve(safeFile);
		};

		img.src = objectUrl;
	});
}
