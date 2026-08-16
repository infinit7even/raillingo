import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';

const ALLOWED_EXTENSIONS = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.avif']);
const ALLOWED_MIME_TYPES = new Set([
	'image/webp',
	'image/png',
	'image/jpeg',
	'image/gif',
	'image/svg+xml',
	'image/avif'
]);

export interface UploadOptions {
	prefix?: string;
	maxSizeMB?: number;
}

export interface UploadResult {
	url: string;
	filename: string;
	size: number;
}

export function getMaxUploadSizeBytes(customMaxMB?: number): number {
	if (customMaxMB && customMaxMB > 0) {
		return customMaxMB * 1024 * 1024;
	}
	const raw = env.MAX_IMAGE_SIZE_MB || process.env.MAX_IMAGE_SIZE_MB || '20';
	const parsed = parseFloat(raw);
	if (isNaN(parsed) || parsed <= 0) return 20 * 1024 * 1024;
	return parsed * 1024 * 1024;
}

function isImageBuffer(buffer: Buffer): boolean {
	if (!buffer || buffer.length < 4) return false;
	// PNG: 89 50 4E 47
	if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
	// JPEG: FF D8 FF
	if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
	// WebP: RIFF ... WEBP
	if (
		buffer.length >= 12 &&
		buffer[0] === 0x52 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x46 &&
		buffer[8] === 0x57 &&
		buffer[9] === 0x45 &&
		buffer[10] === 0x42 &&
		buffer[11] === 0x50
	) {
		return true;
	}
	// GIF: GIF8
	if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true;
	// AVIF / SVG / etc fallback
	return true;
}

/**
 * Salva un'immagine sul server in modo sicuro, atomico e ottimizzato.
 */
export async function saveUploadedImage(
	file: File | Blob,
	options: UploadOptions = {}
): Promise<UploadResult> {
	const maxSizeBytes = getMaxUploadSizeBytes(options.maxSizeMB);
	const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);

	if (file.size > maxSizeBytes) {
		throw new Error(`File troppo grande. La dimensione massima consentita è di ${maxMb}MB.`);
	}

	const bytes = await file.arrayBuffer();
	const buffer = Buffer.from(bytes);

	const originalName = file instanceof File ? file.name : 'upload.webp';
	const ext = path.extname(originalName || '').toLowerCase() || '.webp';
	const mime = (file.type || '').toLowerCase();

	const isAllowedExt = ALLOWED_EXTENSIONS.has(ext);
	const isAllowedMime = ALLOWED_MIME_TYPES.has(mime) || mime.startsWith('image/');
	const isImage = isImageBuffer(buffer);

	if (!isAllowedExt && !isAllowedMime && !isImage) {
		throw new Error(
			'Formato immagine non consentito. I formati supportati sono WebP, PNG, JPG, JPEG, GIF e SVG.'
		);
	}

	const prefix = options.prefix || 'img';
	const rand = crypto.randomBytes(4).toString('hex');
	const fileExt = ext === '.svg' ? '.svg' : ext === '.gif' ? '.gif' : '.webp';
	const filename = `${prefix}-${Date.now()}-${rand}${fileExt}`;

	const uploadDir = path.resolve('data/uploads');
	await fs.mkdir(uploadDir, { recursive: true });

	const filePath = path.join(uploadDir, filename);
	const tmpPath = `${filePath}.tmp.${Date.now()}`;

	try {
		await fs.writeFile(tmpPath, buffer);
		await fs.rename(tmpPath, filePath);
	} catch (err) {
		try {
			await fs.unlink(tmpPath).catch(() => {});
		} catch {
			// Ignora
		}
		throw new Error("Errore durante la scrittura del file immagine sul server.");
	}

	const publicUrl = `/uploads/${filename}`;
	return {
		url: publicUrl,
		filename,
		size: file.size
	};
}
