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

	const dataFilePath = path.resolve('data/uploads', filename);
	const staticFilePath = path.resolve('static/uploads', filename);

	let fileData: Buffer | null = null;
	try {
		fileData = await fs.readFile(dataFilePath);
	} catch (err) {
		try {
			fileData = await fs.readFile(staticFilePath);
		} catch (e) {
			throw error(404, 'Immagine non trovata');
		}
	}

	const ext = path.extname(filename).toLowerCase();
	const contentType = MIME_TYPES[ext] || 'application/octet-stream';

	return new Response(new Uint8Array(fileData), {
		headers: {
			'Content-Type': contentType,
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
