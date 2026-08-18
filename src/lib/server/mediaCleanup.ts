import fs from "node:fs/promises";
import path from "node:path";
import { db } from "$lib/server/db";
import { cards } from "$lib/server/db/schema";
import type { Card } from "$lib/types/cards";

/**
 * Estrae tutti i nomi file dei media referenziati in testi o array di immagini
 */
export function extractMediaFilenames(sources: any): Set<string> {
	const filenames = new Set<string>();
	if (!sources) return filenames;

	let items: any[] = [];
	if (Array.isArray(sources)) {
		items = sources;
	} else if (typeof sources === "object") {
		items = [sources.images, sources.description, sources.content, sources.title, ];
	} else {
		items = [sources];
	}

	for (const src of items) {
		if (!src) continue;

		if (Array.isArray(src)) {
			for (const item of src) {
				if (typeof item === "string") {
					const match = item.match(/\/uploads\/([^"\s?#]+)/);
					if (match && match[1]) filenames.add(path.basename(match[1]));
					else if (item.startsWith("/uploads/")) filenames.add(path.basename(item));
				}
			}
		} else if (typeof src === "string") {
			const matches = src.matchAll(/\/uploads\/([^"\s?#)]+)/g);
			for (const match of matches) {
				if (match[1]) filenames.add(path.basename(match[1]));
			}
		}
	}

	return filenames;
}

/**
 * Verifica se un file immagine è ancora referenziato da altre card nel database.
 */
export async function isImageReferencedElsewhere(
	filename: string,
	options?: { excludeCardId?: string }
): Promise<boolean> {
	if (!filename || filename.includes("..")) return false;

	const cleanFilename = path.basename(filename.split("?")[0].trim());
	if (!cleanFilename) return false;

	try {
		const allCards = await db.select().from(cards);

		for (const c of allCards) {
			if (options?.excludeCardId && c.id === options.excludeCardId) continue;
			const cardFiles = extractMediaFilenames([
				(c.images as string[]) || [],
				c.description,
				c.title,
				
			]);
			if (cardFiles.has(cleanFilename)) return true;
		}
	} catch (e) {
		console.error("Errore verifica referenze immagine:", e);
		return true;
	}

	return false;
}

/**
 * Sposta le immagini associate ad una risorsa cestinata nella cartella trash
 */
export async function moveImagesToTrash(imageSources: any): Promise<void> {
	const filenames = extractMediaFilenames(imageSources);
	const staticUploadDir = path.resolve("static/uploads");
	const trashDir = path.join(staticUploadDir, "trash");

	await fs.mkdir(trashDir, { recursive: true }).catch(() => {});

	for (const filename of filenames) {
		const isUsed = await isImageReferencedElsewhere(filename);
		if (!isUsed) {
			const src = path.join(staticUploadDir, filename);
			const dest = path.join(trashDir, filename);
			await fs.rename(src, dest).catch(() => {});
		}
	}
}

/**
 * Ripristina le immagini dal cestino alla cartella uploads
 */
export async function restoreImagesFromTrash(imageSources: any): Promise<void> {
	const filenames = extractMediaFilenames(imageSources);
	const staticUploadDir = path.resolve("static/uploads");
	const trashDir = path.join(staticUploadDir, "trash");

	for (const filename of filenames) {
		const src = path.join(trashDir, filename);
		const dest = path.join(staticUploadDir, filename);
		await fs.rename(src, dest).catch(() => {});
	}
}

/**
 * Elimina definitivamente i file immagine
 */
export async function permanentlyDeleteImages(imageSources: any): Promise<void> {
	const filenames = extractMediaFilenames(imageSources);
	const staticUploadDir = path.resolve("static/uploads");
	const trashDir = path.join(staticUploadDir, "trash");

	for (const filename of filenames) {
		const isUsed = await isImageReferencedElsewhere(filename);
		if (!isUsed) {
			await fs.unlink(path.join(trashDir, filename)).catch(() => {});
			await fs.unlink(path.join(staticUploadDir, filename)).catch(() => {});
		}
	}
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
				const staticPath = path.resolve("static/uploads", filename);
				await fs.unlink(staticPath).catch(() => {});
			}
		}
	}
}
