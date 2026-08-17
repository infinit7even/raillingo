import { json, type RequestHandler } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isAuthorizedAdmin } from '$lib/server/auth';
import { isSameOriginRequest } from '$lib/server/csrf';
import { db } from '$lib/server/db';
import { cards as cardsTable, notes as notesTable } from '$lib/server/db/schema';
import type { Card } from '$lib/types/cards';
import type { Note } from '$lib/types/notes';

function extractImageFilenamesFromNotes(notes: Note[]): Set<string> {
	const filenames = new Set<string>();
	const regex = /\/uploads\/([^)"'\s]+)/g;

	for (const note of notes) {
		if (note.images && Array.isArray(note.images)) {
			for (const img of note.images) {
				if (typeof img === 'string') {
					filenames.add(path.basename(img.split('?')[0]));
				}
			}
		}
		if (note.content && typeof note.content === 'string') {
			let match;
			while ((match = regex.exec(note.content)) !== null) {
				filenames.add(path.basename(match[1].split('?')[0]));
			}
		}
	}
	return filenames;
}

function extractImageFilenamesFromCards(cards: Card[]): Set<string> {
	const filenames = new Set<string>();
	const regex = /\/uploads\/([^)"'\s]+)/g;

	for (const card of cards) {
		if (card.images && Array.isArray(card.images)) {
			for (const img of card.images) {
				if (typeof img === 'string') {
					filenames.add(path.basename(img.split('?')[0]));
				}
			}
		}
		if (card.description && typeof card.description === 'string') {
			let match;
			while ((match = regex.exec(card.description)) !== null) {
				filenames.add(path.basename(match[1].split('?')[0]));
			}
		}
	}
	return filenames;
}

async function getUploadDirectoryInfo() {
	const dataUploadDir = path.resolve('data/uploads');
	const staticUploadDir = path.resolve('static/uploads');

	const allFiles = new Map<string, { path: string; size: number }>();

	for (const dir of [dataUploadDir, staticUploadDir]) {
		try {
			const files = await fs.readdir(dir);
			for (const file of files) {
				if (file.startsWith('.')) continue;
				const fullPath = path.join(dir, file);
				try {
					const stat = await fs.stat(fullPath);
					if (stat.isFile()) {
						allFiles.set(file, { path: fullPath, size: stat.size });
					}
				} catch {
					// Ignora file non accessibili
				}
			}
		} catch {
			// Directory non esistente
		}
	}

	return allFiles;
}

export const GET: RequestHandler = async (event) => {
	const { locals } = event;

	if (!isAuthorizedAdmin(locals.user)) {
		return json({ error: 'Accesso negato: admin richiesto.' }, { status: 403 });
	}

	try {
		const [dbCards, dbNotes, diskFiles] = await Promise.all([
			db.select().from(cardsTable),
			db.select().from(notesTable),
			getUploadDirectoryInfo()
		]);

		const cards: Card[] = dbCards.map((c) => ({
			id: c.id,
			title: c.title,
			fullName: c.fullName || undefined,
			description: c.description,
			category: c.category,
			images: (c.images as string[]) || [],
			tags: (c.tags as string[]) || [],
			createdAt: c.createdAt.toISOString(),
			updatedAt: c.updatedAt.toISOString()
		}));

		const notes: Note[] = dbNotes.map((n) => ({
			id: n.id,
			userId: n.userId || undefined,
			title: n.title,
			content: n.content,
			category: n.category,
			tags: (n.tags as string[]) || [],
			images: (n.images as string[]) || [],
			isPinned: n.isPinned,
			isPublic: n.isPublic,
			shareId: n.shareId || undefined,
			order: n.order,
			createdAt: n.createdAt.toISOString(),
			updatedAt: n.updatedAt.toISOString()
		}));

		const cardRefs = extractImageFilenamesFromCards(cards);
		const noteRefs = extractImageFilenamesFromNotes(notes);

		const referenced = new Set<string>([...cardRefs, ...noteRefs]);
		const orphaned: { filename: string; size: number }[] = [];

		let totalBytes = 0;
		let orphanedBytes = 0;

		for (const [filename, info] of diskFiles.entries()) {
			totalBytes += info.size;
			if (!referenced.has(filename)) {
				orphaned.push({ filename, size: info.size });
				orphanedBytes += info.size;
			}
		}

		return json({
			totalFiles: diskFiles.size,
			totalBytes,
			referencedFiles: referenced.size,
			orphanedCount: orphaned.length,
			orphanedBytes,
			orphaned
		});
	} catch (err) {
		console.error('Errore durante scansione media orfani:', err);
		return json({ error: 'Errore durante la scansione dei file.' }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	if (!isSameOriginRequest(event)) {
		return json({ error: 'Origine non consentita.' }, { status: 403 });
	}

	if (!isAuthorizedAdmin(locals.user)) {
		return json({ error: 'Accesso negato: admin richiesto.' }, { status: 403 });
	}

	try {
		const [dbCards, dbNotes, diskFiles] = await Promise.all([
			db.select().from(cardsTable),
			db.select().from(notesTable),
			getUploadDirectoryInfo()
		]);

		const cards: Card[] = dbCards.map((c) => ({
			id: c.id,
			title: c.title,
			fullName: c.fullName || undefined,
			description: c.description,
			category: c.category,
			images: (c.images as string[]) || [],
			tags: (c.tags as string[]) || [],
			createdAt: c.createdAt.toISOString(),
			updatedAt: c.updatedAt.toISOString()
		}));

		const notes: Note[] = dbNotes.map((n) => ({
			id: n.id,
			userId: n.userId || undefined,
			title: n.title,
			content: n.content,
			category: n.category,
			tags: (n.tags as string[]) || [],
			images: (n.images as string[]) || [],
			isPinned: n.isPinned,
			isPublic: n.isPublic,
			shareId: n.shareId || undefined,
			order: n.order,
			createdAt: n.createdAt.toISOString(),
			updatedAt: n.updatedAt.toISOString()
		}));

		const cardRefs = extractImageFilenamesFromCards(cards);
		const noteRefs = extractImageFilenamesFromNotes(notes);
		const referenced = new Set<string>([...cardRefs, ...noteRefs]);

		let deletedCount = 0;
		let freedBytes = 0;

		for (const [filename, info] of diskFiles.entries()) {
			if (!referenced.has(filename)) {
				try {
					await fs.unlink(info.path);
					deletedCount++;
					freedBytes += info.size;
				} catch (e) {
					console.warn(`Impossibile eliminare file orfano ${info.path}:`, e);
				}
			}
		}

		const freedFormatted =
			freedBytes > 1024 * 1024
				? `${(freedBytes / (1024 * 1024)).toFixed(2)} MB`
				: `${(freedBytes / 1024).toFixed(1)} KB`;

		return json({
			success: true,
			deletedCount,
			freedBytes,
			freedFormatted
		});
	} catch (err) {
		console.error('Errore durante pulizia media orfani:', err);
		return json({ error: 'Errore durante la pulizia dei file.' }, { status: 500 });
	}
};
