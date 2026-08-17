import { json, type RequestHandler } from '@sveltejs/kit';
import { isAuthorizedAdmin } from '$lib/server/auth';
import { isSameOriginRequest } from '$lib/server/csrf';
import { saveUploadedImage } from '$lib/server/uploadService';

export const POST: RequestHandler = async (event) => {
	const { request, locals } = event;

	if (!isSameOriginRequest(event)) {
		return json({ error: 'Origine non consentita' }, { status: 403 });
	}

	if (!isAuthorizedAdmin(locals.user)) {
		return json(
			{ error: 'Accesso negato: soltanto gli amministratori possono caricare immagini per le schede.' },
			{ status: 403 }
		);
	}

	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | Blob | null;

		if (!file || (file instanceof Blob && file.size === 0)) {
			return json({ error: 'Nessun file immagine caricato.' }, { status: 400 });
		}

		const result = await saveUploadedImage(file, {
			prefix: 'img',
			maxSizeMB: 20
		});

		return json({
			url: result.url,
			filename: result.filename,
			size: result.size
		});
	} catch (err: any) {
		console.error("Errore durante l'upload dell'immagine:", err);
		return json({ error: err.message || "Errore durante il salvataggio dell'immagine." }, { status: 400 });
	}
};
