import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Mutex asincrono in-process per percorso file.
 * Garantisce che letture e scritture su cards.json, notes.json e users.json
 * siano serializzate in modo atomico, prevenendo race conditions e corruzione dati.
 */
const fileLocks = new Map<string, Promise<void>>();

export async function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
	const key = path.resolve(filePath);
	const previous = fileLocks.get(key) || Promise.resolve();

	let releaseLock!: () => void;
	const current = new Promise<void>((resolve) => {
		releaseLock = resolve;
	});

	fileLocks.set(key, current);

	try {
		await previous;
		return await fn();
	} finally {
		releaseLock();
		if (fileLocks.get(key) === current) {
			fileLocks.delete(key);
		}
	}
}

/**
 * Scrive dati JSON in modo atomico su disco.
 * Scrive prima su un file temporaneo univoco nella stessa directory,
 * quindi esegue `fs.rename` (operazione atomica a livello di filesystem POSIX).
 */
export async function writeJsonAtomic<T>(filePath: string, data: T): Promise<boolean> {
	const absolutePath = path.resolve(filePath);
	const dir = path.dirname(absolutePath);
	const rand = crypto.randomBytes(6).toString('hex');
	const tmpPath = `${absolutePath}.tmp.${Date.now()}.${rand}`;

	try {
		await fs.mkdir(dir, { recursive: true });
		const jsonString = JSON.stringify(data, null, 2);
		await fs.writeFile(tmpPath, jsonString, 'utf-8');
		await fs.rename(tmpPath, absolutePath);
		return true;
	} catch (err) {
		console.error(`Errore durante la scrittura atomica di ${filePath}:`, err);
		try {
			await fs.unlink(tmpPath).catch(() => {});
		} catch {
			// Ignora errori di pulizia temp
		}
		return false;
	}
}

/**
 * Legge in modo sicuro un file JSON con fallback in caso di file inesistente o corrotto.
 */
export async function readJsonDirect<T>(filePath: string, fallback: T): Promise<T> {
	const absolutePath = path.resolve(filePath);
	try {
		const raw = await fs.readFile(absolutePath, 'utf-8');
		if (!raw.trim()) return fallback;
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

/**
 * Esegue una transazione di mutazione atomica e thread-safe su un file JSON.
 * Acquisisce il lock sul file, legge lo stato più recente, applica la funzione di modifica,
 * scrive atomicamente su disco e rilascia il lock.
 */
export async function mutateJsonSafe<T>(
	filePath: string,
	fallback: T,
	mutator: (currentData: T) => Promise<T> | T
): Promise<{ success: boolean; data: T }> {
	return withFileLock(filePath, async () => {
		const current = await readJsonDirect<T>(filePath, fallback);
		const updated = await mutator(current);
		const ok = await writeJsonAtomic(filePath, updated);
		return { success: ok, data: updated };
	});
}
