import { json, type RequestHandler } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';

const ANNOUNCEMENT_FILE_PATH = path.resolve('static/data/announcement.json');

async function readAnnouncement(): Promise<string> {
	try {
		const data = await fs.readFile(ANNOUNCEMENT_FILE_PATH, 'utf-8');
		const parsed = JSON.parse(data);
		return parsed.content || '';
	} catch {
		return '';
	}
}

async function writeAnnouncement(content: string): Promise<boolean> {
	try {
		const dir = path.dirname(ANNOUNCEMENT_FILE_PATH);
		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(ANNOUNCEMENT_FILE_PATH, JSON.stringify({ content, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');
		return true;
	} catch {
		return false;
	}
}

export const GET: RequestHandler = async () => {
	const announcement = await readAnnouncement();
	return json({ announcement });
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	const sessionCookie = cookies.get('admin_session');
	if (!sessionCookie) {
		return json({ error: 'Non autorizzato' }, { status: 401 });
	}

	const { content } = await request.json();
	if (typeof content !== 'string') {
		return json({ error: 'Contenuto non valido' }, { status: 400 });
	}

	const success = await writeAnnouncement(content);
	return json({ success, announcement: content });
};
