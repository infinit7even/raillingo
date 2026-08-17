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
	const regex = /(?:\/uploads\/|\/uploads\/trash\/|\/api\/uploads\/)([a-zA-Z0-9_.-]+\.(?:webp|jpg|jpeg|png|gif|svg))/gi;

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

export interface MediaItem {
	id?: string;
	images?: string[] | null | unknown;
	description?: string | null;
	content?: string | null;
	title?: string | null;
	fullName?: string | null;
}

/**
 * Assicura l'esistenza della cartella trash
 */
async function ensureTrashDirExists(): Promise<string> {
	const trashDir = path.resolve('static/uploads/trash');
	try {
		await fs.mkdir(trashDir, { recursive: true });
	} catch {}
	return trashDir;
}

/**
 * Sposta le immagini associate a una card/nota nella cartella trash
 */
export async function moveImagesToTrash(item: MediaItem): Promise<void> {
	const filenames = extractMediaFilenames([item.images as any, item.description || item.content]);
	if (filenames.size === 0) return;

	const trashDir = await ensureTrashDirExists();
	const staticUploadDir = path.resolve('static/uploads');

	for (const fn of filenames) {
		const srcPath = path.join(staticUploadDir, fn);
		const destPath = path.join(trashDir, fn);
		try {
			const stat = await fs.stat(srcPath);
			if (stat.isFile()) {
				await fs.rename(srcPath, destPath);
			}
		} catch {
			// File potrebbe non essere presente sul disco o già spostato
		}
	}
}

/**
 * Ripristina le immagini dalla cartella trash alla cartella uploads
 */
export async function restoreImagesFromTrash(item: MediaItem): Promise<void> {
	const filenames = extractMediaFilenames([item.images as any, item.description || item.content]);
	if (filenames.size === 0) return;

	const trashDir = path.resolve('static/uploads/trash');
	const staticUploadDir = path.resolve('static/uploads');

	for (const fn of filenames) {
		const srcPath = path.join(trashDir, fn);
		const destPath = path.join(staticUploadDir, fn);
		try {
			const stat = await fs.stat(srcPath);
			if (stat.isFile()) {
				await fs.rename(srcPath, destPath);
			}
		} catch {
			// Ignora
		}
	}
}

/**
 * Elimina definitivamente i file immagine di una scheda o nota dal disco
 */
export async function permanentlyDeleteImages(item: MediaItem): Promise<void> {
	const filenames = extractMediaFilenames([item.images as any, item.description || item.content]);
	if (filenames.size === 0) return;

	const staticUploadDir = path.resolve('static/uploads');
	const trashDir = path.resolve('static/uploads/trash');

	for (const fn of filenames) {
		const normalPath = path.join(staticUploadDir, fn);
		const trashPath = path.join(trashDir, fn);
		await Promise.allSettled([
			fs.unlink(normalPath).catch(() => {}),
			fs.unlink(trashPath).catch(() => {})
		]);
	}
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
		return true;
	}

	return false;
}

/**
 * Pulisce i file immagine rimossi durante l'aggiornamento di una Card.
 */
export async function cleanupUnusedImagesOnCardUpdate(oldCard: Card, newCard: Card): Promise<void> {
	const oldFiles = extractMediaFilenames([oldCard.images, oldCard.description]);
	const newFiles = extractMediaFilenames([newCard.images, newCard.description]);

	for (const filename of oldFiles) {
		if (!newFiles.has(filename)) {
			const isUsed = await isImageReferencedElsewhere(filename, { excludeCardId: oldCard.id });
			if (!isUsed) {
				const staticPath = path.resolve('static/uploads', filename);
				await fs.unlink(staticPath).catch(() => {});
			}
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
			const isUsed = await isImageReferencedElsewhere(filename, { excludeNoteId: oldNote.id });
			if (!isUsed) {
				const staticPath = path.resolve('static/uploads', filename);
				await fs.unlink(staticPath).catch(() => {});
			}
		}
	}
}
