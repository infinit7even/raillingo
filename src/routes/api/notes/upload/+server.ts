import { json, type RequestHandler } from '@sveltejs/kit';
import { readSession } from '$lib/server/auth';
import { isSameOriginRequest } from '$lib/server/csrf';
import { saveUploadedImage } from '$lib/server/uploadService';

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
		const file = formData.get('file') as File | Blob | null;

		if (!file || (file instanceof Blob && file.size === 0)) {
			return json({ error: 'Nessun file immagine caricato.' }, { status: 400 });
		}

		const result = await saveUploadedImage(file, {
			prefix: 'note-img',
			maxSizeMB: 20
		});

		return json({
			url: result.url,
			filename: result.filename,
			size: result.size
		}, { status: 201 });
	} catch (err: any) {
		console.error("Errore durante l'upload dell'immagine appunto:", err);
		return json({ error: err.message || "Errore durante il salvataggio dell'immagine." }, { status: 400 });
	}
};
