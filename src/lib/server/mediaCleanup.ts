import fs from 'node:fs/promises';
import path from 'node:path';
import { db } from '$lib/server/db';
import { cards, notes } from '$lib/server/db/schema';
import type { Card } from '$lib/types/cards';
import type { Note } from '$lib/types/notes';

/**
 * Estrae tutti i nomi dei file immagine (es. "img-12345.webp") presenti in stringhe, array o contenuti Markdown/HTML.
 */
export function extractMediaFilenames(sources: (string | string[] | undefined | null)[]): Set<string> {
	const filenames = new Set<string>();
	const regex = /(?:\/uploads\/|\/api\/uploads\/)([a-zA-Z0-9_.-]+\.(?:webp|jpg|jpeg|png|gif|svg))/gi;

	for (const src of sources) {
		if (!src) continue;

		if (Array.isArray(src)) {
			for (const item of src) {
				if (typeof item === 'string' && item.trim()) {
					const clean = path.basename(item.split('?')[0].trim());
					if (clean && !clean.includes('..') && clean.includes('.')) {
						filenames.add(clean);
					}
				}
			}
			continue;
		}

		if (typeof src === 'string') {
			let match;
			regex.lastIndex = 0;
			while ((match = regex.exec(src)) !== null) {
				const filename = path.basename(match[1].split('?')[0].trim());
				if (filename && !filename.includes('..') && filename.includes('.')) {
					filenames.add(filename);
				}
			}
		}
	}

	return filenames;
}

/**
 * Verifica se un file immagine è ancora referenziato da altre card o altre note nel database.
 */
export async function isImageReferencedElsewhere(
	filename: string,
	options?: { excludeCardId?: string; excludeNoteId?: string }
): Promise<boolean> {
	if (!filename || filename.includes('..')) return false;

	const cleanFilename = path.basename(filename.split('?')[0].trim());
	if (!cleanFilename) return false;

	try {
		const [allCards, allNotes] = await Promise.all([
			db.select().from(cards),
			db.select().from(notes)
		]);

		for (const c of allCards) {
			if (options?.excludeCardId && c.id === options.excludeCardId) continue;
			const cardFiles = extractMediaFilenames([
				(c.images as string[]) || [],
				c.description,
				c.title,
				c.fullName
			]);
			if (cardFiles.has(cleanFilename)) return true;
		}

		for (const n of allNotes) {
			if (options?.excludeNoteId && n.id === options.excludeNoteId) continue;
			const noteFiles = extractMediaFilenames([
				(n.images as string[]) || [],
				n.content,
				n.title
			]);
			if (noteFiles.has(cleanFilename)) return true;
		}
	} catch (e) {
		console.error('Errore verifica referenze immagine:', e);
		return true; // Per sicurezza, non cancellare se c'è un errore di query
	}

	return false;
}

/**
 * Elimina fisicamente il file dal disco se non è referenziato altrove.
 */
export async function deleteMediaFileIfUnused(
	imgUrlOrFilename: string,
	options?: { excludeCardId?: string; excludeNoteId?: string }
): Promise<boolean> {
	if (!imgUrlOrFilename || typeof imgUrlOrFilename !== 'string') return false;

	const filename = path.basename(imgUrlOrFilename.split('?')[0].trim());
	if (!filename || filename.includes('..')) return false;

	const isUsed = await isImageReferencedElsewhere(filename, options);
	if (isUsed) {
		return false;
	}

	const dataPath = path.resolve('data/uploads', filename);
	const staticPath = path.resolve('static/uploads', filename);

	await Promise.allSettled([
		fs.unlink(dataPath).catch(() => {}),
		fs.unlink(staticPath).catch(() => {})
	]);

	return true;
}

/**
 * Elimina tutti i file immagine associati a una Card eliminata.
 */
export async function deleteImagesForCard(card: Card): Promise<number> {
	const filenames = extractMediaFilenames([card.images, card.description]);
	let count = 0;

	for (const filename of filenames) {
		const deleted = await deleteMediaFileIfUnused(filename, { excludeCardId: card.id });
		if (deleted) count++;
	}

	return count;
}

/**
 * Elimina tutti i file immagine associati a una Note eliminata.
 */
export async function deleteImagesForNote(note: Note): Promise<number> {
	const filenames = extractMediaFilenames([note.images, note.content]);
	let count = 0;

	for (const filename of filenames) {
		const deleted = await deleteMediaFileIfUnused(filename, { excludeNoteId: note.id });
		if (deleted) count++;
	}

	return count;
}

/**
 * Pulisce i file immagine rimossi durante l'aggiornamento di una Card.
 */
export async function cleanupUnusedImagesOnCardUpdate(oldCard: Card, newCard: Card): Promise<void> {
	const oldFiles = extractMediaFilenames([oldCard.images, oldCard.description]);
	const newFiles = extractMediaFilenames([newCard.images, newCard.description]);

	for (const filename of oldFiles) {
		if (!newFiles.has(filename)) {
			await deleteMediaFileIfUnused(filename, { excludeCardId: oldCard.id });
		}
	}
}

/**
 * Pulisce i file immagine rimossi durante l'aggiornamento di una Note.
 */
export async function cleanupUnusedImagesOnNoteUpdate(oldNote: Note, newNote: Note): Promise<void> {
	const oldFiles = extractMediaFilenames([oldNote.images, oldNote.content]);
	const newFiles = extractMediaFilenames([newNote.images, newNote.content]);

	for (const filename of oldFiles) {
		if (!newFiles.has(filename)) {
			await deleteMediaFileIfUnused(filename, { excludeNoteId: oldNote.id });
		}
	}
}
