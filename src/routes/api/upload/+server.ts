import { json, type RequestHandler } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isAuthorizedAdmin } from '$lib/server/auth';
import { isSameOriginRequest } from '$lib/server/csrf';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const POST: RequestHandler = async (event) => {
	const { request, cookies } = event;

	if (!isSameOriginRequest(event)) {
		return json({ error: 'Origine non consentita' }, { status: 403 });
	}

	// Verifica autorizzazione admin prima dell'upload
	if (!isAuthorizedAdmin(cookies)) {
		return json(
			{ error: 'Accesso negato: soltanto gli admin possono caricare immagini.' },
			{ status: 403 }
		);
	}

	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;

		if (!file) {
			return json({ error: 'Nessun file caricato' }, { status: 400 });
		}

		// Verifica dimensione file
		if (file.size > MAX_FILE_SIZE) {
			return json({ error: 'File troppo grande (max 5MB)' }, { status: 400 });
		}

		// Verifica estensione file (whitelist)
		const extension = path.extname(file.name).toLowerCase();
		if (!ALLOWED_EXTENSIONS.has(extension)) {
			return json(
				{ error: 'Tipo di file non consentito. Usa JPG, PNG, WebP o GIF.' },
				{ status: 400 }
			);
		}

		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);

		// Genera nome file sicuro (senza usare il nome originale)
		const safeExtension = extension || '.jpg';
		const filename = `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${safeExtension}`;
		const uploadDir = path.resolve('data/uploads');

		await fs.mkdir(uploadDir, { recursive: true });
		await fs.writeFile(path.join(uploadDir, filename), buffer);

		const publicUrl = `/uploads/${filename}`;
		return json({ url: publicUrl });
	} catch (err) {
		console.error("Errore durante l'upload dell'immagine:", err);
		return json({ error: "Errore durante il salvataggio dell'immagine" }, { status: 500 });
	}
};
