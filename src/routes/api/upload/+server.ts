import { json, type RequestHandler } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;

		if (!file) {
			return json({ error: 'Nessun file caricato' }, { status: 400 });
		}

		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);

		// Sanitizza nome file
		const extension = path.extname(file.name) || '.jpg';
		const filename = `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${extension}`;
		const uploadDir = path.resolve('static/uploads');

		await fs.mkdir(uploadDir, { recursive: true });
		await fs.writeFile(path.join(uploadDir, filename), buffer);

		const publicUrl = `/uploads/${filename}`;
		return json({ url: publicUrl });
	} catch (err) {
		console.error("Errore durante l'upload dell'immagine:", err);
		return json({ error: "Errore durante il salvataggio dell'immagine" }, { status: 500 });
	}
};
