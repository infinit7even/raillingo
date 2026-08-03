import { error, type RequestHandler } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';

const MIME_TYPES: Record<string, string> = {
	'.webp': 'image/webp',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml'
};

export const GET: RequestHandler = async ({ params }) => {
	const filename = params.filename;

	if (!filename || filename.includes('..')) {
		throw error(400, 'Nome file non valido');
	}

	const filePath = path.resolve('static/uploads', filename);

	try {
		const data = await fs.readFile(filePath);
		const ext = path.extname(filename).toLowerCase();
		const contentType = MIME_TYPES[ext] || 'application/octet-stream';

		return new Response(data, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		});
	} catch (err) {
		throw error(404, 'Immagine non trovata');
	}
};
