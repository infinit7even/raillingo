import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import fs from 'node:fs/promises';
import path from 'node:path';
import { readSession } from '$lib/server/auth';
import { isSameOriginRequest } from '$lib/server/csrf';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function getMaxImageSize(): number {
	const raw = env.MAX_IMAGE_SIZE_MB || process.env.MAX_IMAGE_SIZE_MB || '1';
	const parsed = parseFloat(raw);
	if (isNaN(parsed) || parsed <= 0) return 1 * 1024 * 1024;
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
		buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
		buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
	) return true;
	// GIF: GIF8
	if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true;
	return false;
}

export const POST: RequestHandler = async (event) => {
	const { request, cookies } = event;

	if (!isSameOriginRequest(event)) {
		return json({ error: 'Origine non consentita' }, { status: 403 });
	}

	const user = readSession(cookies);
	if (!user) {
		return json({ error: 'Non autorizzato: effettua il login.' }, { status: 401 });
	}

	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;

		if (!file) {
			return json({ error: 'Nessun file immagine caricato.' }, { status: 400 });
		}

		const maxSizeBytes = getMaxImageSize();
		const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(1);

		if (file.size > maxSizeBytes) {
			return json(
				{ error: `File troppo grande. La dimensione massima consentita è di ${maxMb}MB.` },
				{ status: 400 }
			);
		}

		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);

		const extension = path.extname(file.name || '').toLowerCase();
		const mime = (file.type || '').toLowerCase();

		const isAllowedExt = ALLOWED_EXTENSIONS.has(extension);
		const isAllowedMime = ALLOWED_MIME_TYPES.has(mime) || mime.startsWith('image/');
		const isImage = isImageBuffer(buffer);

		if (!isAllowedExt && !isAllowedMime && !isImage) {
			return json(
				{ error: 'Formato non consentito. Sono supportati solo file PNG, JPG e WebP.' },
				{ status: 400 }
			);
		}

		// Salva sempre con estensione .webp
		const filename = `note-img-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.webp`;
		const uploadDir = path.resolve('data/uploads');

		await fs.mkdir(uploadDir, { recursive: true });
		await fs.writeFile(path.join(uploadDir, filename), buffer);

		const publicUrl = `/uploads/${filename}`;
		return json({ url: publicUrl, filename, size: file.size }, { status: 201 });
	} catch (err) {
		console.error("Errore durante l'upload dell'immagine appunto:", err);
		return json({ error: "Errore durante il salvataggio dell'immagine." }, { status: 500 });
	}
};
