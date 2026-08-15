import fs from 'node:fs/promises';
import path from 'node:path';

const CARDS_FILE_PATH = path.resolve('data/cards.json');
const USERS_FILE_PATH = path.resolve('data/users.json');
const NOTES_FILE_PATH = path.resolve('data/notes.json');

// Rileggi il file al massimo ogni TTL_MS millisecondi (oltre al check mtime).
const TTL_MS = 1000;

interface CacheEntry {
	data: unknown;
	mtimeMs: number;
	checkedAt: number;
}

const cache = new Map<string, CacheEntry>();

async function readJsonCached(filePath: string, fallback: unknown): Promise<unknown> {
	const now = Date.now();
	const entry = cache.get(filePath);

	if (entry && now - entry.checkedAt < TTL_MS) {
		return entry.data;
	}

	try {
		const stat = await fs.stat(filePath);
		if (entry && stat.mtimeMs === entry.mtimeMs) {
			entry.checkedAt = now;
			return entry.data;
		}
		const raw = await fs.readFile(filePath, 'utf-8');
		const data = JSON.parse(raw);
		cache.set(filePath, { data, mtimeMs: stat.mtimeMs, checkedAt: now });
		return data;
	} catch {
		if (entry) {
			entry.checkedAt = now;
			return entry.data;
		}
		return fallback;
	}
}

function invalidate(filePath: string): void {
	cache.delete(filePath);
}

export function readCards<T = unknown>(): Promise<T> {
	return readJsonCached(CARDS_FILE_PATH, []) as Promise<T>;
}

export function readUsers<T = unknown>(): Promise<T> {
	return readJsonCached(USERS_FILE_PATH, []) as Promise<T>;
}

export function readNotes<T = unknown>(): Promise<T> {
	return readJsonCached(NOTES_FILE_PATH, []) as Promise<T>;
}

export function invalidateCards(): void {
	invalidate(CARDS_FILE_PATH);
}

export function invalidateUsers(): void {
	invalidate(USERS_FILE_PATH);
}

export function invalidateNotes(): void {
	invalidate(NOTES_FILE_PATH);
}

