import { json, type RequestHandler } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isAuthorizedAdmin } from '$lib/server/auth';
import { isSameOriginRequest } from '$lib/server/csrf';
import { db } from '$lib/server/db';
import { cards as cardsTable } from '$lib/server/db/schema';
import { extractMediaFilenames } from '$lib/server/mediaCleanup';
import { logAdminAction } from '$lib/server/adminLogger';

async function getUploadDirectoryInfo() {
	const staticUploadDir = path.resolve('static/uploads');
	const allFiles = new Map<string, { path: string; size: number }>();

	try {
		const files = await fs.readdir(staticUploadDir);
		for (const file of files) {
			if (file.startsWith('.') || file === 'trash') continue;
			const fullPath = path.join(staticUploadDir, file);
			try {
				const stat = await fs.stat(fullPath);
				if (stat.isFile()) {
					allFiles.set(file, { path: fullPath, size: stat.size });
				}
			} catch {}
		}
	} catch {}

	return allFiles;
}

export const GET: RequestHandler = async (event) => {
	const { locals } = event;

	if (!isAuthorizedAdmin(locals.user)) {
		return json({ error: 'Accesso negato: admin richiesto.' }, { status: 403 });
	}

	try {
		const [dbCards, diskFiles] = await Promise.all([
			db.select().from(cardsTable),
			getUploadDirectoryInfo()
		]);

		const cardSources = dbCards.map((c) => [c.images, c.description, c.title]);
		
		const referenced = new Set<string>();
		for (const srcList of cardSources) {
			for (const fn of extractMediaFilenames(srcList)) referenced.add(fn);
		}
		

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
		const [dbCards, diskFiles] = await Promise.all([
			db.select().from(cardsTable),
			getUploadDirectoryInfo()
		]);

		const cardSources = dbCards.map((c) => [c.images, c.description, c.title]);
		
		const referenced = new Set<string>();
		for (const srcList of cardSources) {
			for (const fn of extractMediaFilenames(srcList)) referenced.add(fn);
		}
		

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

		await logAdminAction({
			userId: locals.user?.id || 'admin',
			userName: locals.user?.name || locals.user?.username || 'Admin',
			userAvatar: locals.user?.image,
			action: 'clean_media',
			targetType: 'media',
			targetTitle: `Pulizia ${deletedCount} file orfani`,
			details: {
				deletedCount,
				freedBytes,
				freedFormatted
			}
		});

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
