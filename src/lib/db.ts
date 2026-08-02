import pg from 'pg';
import { env } from '$env/dynamic/private';
import fs from 'fs';
import path from 'path';

const connectionString = env.DATABASE_URL || 'postgresql://raillingo:raillingo@localhost:5239/raillingo';

export const pool = new pg.Pool({
	connectionString,
	max: 10,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 5000
});

let isInitialized = false;

export async function initDb() {
	if (isInitialized) return;
	try {
		const client = await pool.connect();
		try {
			// 1. Create Cards Table
			await client.query(`
				CREATE TABLE IF NOT EXISTS cards (
					id TEXT PRIMARY KEY,
					title TEXT NOT NULL,
					description TEXT NOT NULL,
					category TEXT,
					tags TEXT[],
					images TEXT[],
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				);
			`);

			// 2. Create User Stats Table
			await client.query(`
				CREATE TABLE IF NOT EXISTS user_stats (
					id SERIAL PRIMARY KEY,
					user_id TEXT UNIQUE NOT NULL DEFAULT 'default_user',
					cards_studied INT DEFAULT 0,
					quiz_answered INT DEFAULT 0,
					quiz_correct INT DEFAULT 0,
					streak_days INT DEFAULT 1,
					last_studied_date TEXT DEFAULT '',
					favorites TEXT[] DEFAULT '{}'
				);
			`);

			// Seed default user stats if missing
			await client.query(`
				INSERT INTO user_stats (user_id, cards_studied, quiz_answered, quiz_correct, streak_days)
				VALUES ('default_user', 0, 0, 0, 1)
				ON CONFLICT (user_id) DO NOTHING;
			`);

			// 3. Create Announcements Table
			await client.query(`
				CREATE TABLE IF NOT EXISTS announcements (
					id SERIAL PRIMARY KEY,
					content TEXT NOT NULL,
					author TEXT DEFAULT 'Amministrazione',
					updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				);
			`);

			// 4. Create App Users Table (Discord ID & Email, Role)
			await client.query(`
				CREATE TABLE IF NOT EXISTS users (
					discord_id TEXT PRIMARY KEY,
					email TEXT,
					username TEXT,
					role TEXT DEFAULT 'user',
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				);
			`);

			// Seed main admin user (Discord ID: 691289686093725736)
			await client.query(`
				INSERT INTO users (discord_id, email, username, role)
				VALUES ('691289686093725736', 'admin@raillingo.it', 'Admin Iniziale', 'admin')
				ON CONFLICT (discord_id) DO NOTHING;
			`);

			// 5. Seed default cards from static/data/cards.json if table is empty
			const cardsCountRes = await client.query('SELECT COUNT(*) FROM cards');
			const count = parseInt(cardsCountRes.rows[0].count, 10);

			if (count === 0) {
				const jsonPath = path.join(process.cwd(), 'static', 'data', 'cards.json');
				if (fs.existsSync(jsonPath)) {
					const rawData = fs.readFileSync(jsonPath, 'utf-8');
					const initialCards = JSON.parse(rawData);

					for (const card of initialCards) {
						await client.query(
							`INSERT INTO cards (id, title, description, category, tags, images, created_at, updated_at)
							 VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
							 ON CONFLICT (id) DO NOTHING;`,
							[
								card.id,
								card.title,
								card.description,
								card.category || null,
								card.tags || [],
								card.images || []
							]
						);
					}
				}
			}

			isInitialized = true;
		} finally {
			client.release();
		}
	} catch (err) {
		console.warn('PostgreSQL Database connection or initialization note:', err);
	}
}

export async function getDbAnnouncement() {
	await initDb();
	try {
		const res = await pool.query('SELECT * FROM announcements ORDER BY id DESC LIMIT 1');
		if (res.rows.length > 0) {
			return res.rows[0].content;
		}
	} catch (e) {
		// Fallback
	}
	return '';
}

export async function setDbAnnouncement(content: string, author = 'Amministrazione') {
	await initDb();
	try {
		await pool.query('INSERT INTO announcements (content, author, updated_at) VALUES ($1, $2, NOW())', [
			content,
			author
		]);
		return true;
	} catch (e) {
		return false;
	}
}

export async function upsertDbUser(discordId: string, email: string, username = '', defaultRole = 'user') {
	await initDb();
	try {
		// Hardcoded admin ID fallback
		const initialRole = discordId === '691289686093725736' ? 'admin' : defaultRole;
		await pool.query(
			`INSERT INTO users (discord_id, email, username, role)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (discord_id) DO UPDATE SET
				email = EXCLUDED.email,
				username = COALESCE(NULLIF(EXCLUDED.username, ''), users.username);`,
			[discordId, email, username, initialRole]
		);
		const res = await pool.query('SELECT role FROM users WHERE discord_id = $1', [discordId]);
		return res.rows[0]?.role || initialRole;
	} catch (e) {
		return discordId === '691289686093725736' ? 'admin' : 'user';
	}
}

export async function getAllDbUsers() {
	await initDb();
	try {
		const res = await pool.query('SELECT discord_id, email, username, role, created_at FROM users ORDER BY created_at DESC');
		return res.rows.map((r) => ({
			discordId: r.discord_id,
			email: r.email || 'N/D',
			username: r.username || r.discord_id,
			role: r.role || 'user',
			createdAt: r.created_at
		}));
	} catch (e) {
		return [];
	}
}

export async function updateDbUserRole(discordId: string, role: string) {
	await initDb();
	try {
		await pool.query('UPDATE users SET role = $1 WHERE discord_id = $2', [role, discordId]);
		return true;
	} catch (e) {
		return false;
	}
}

export async function getDbUserRole(discordId: string) {
	await initDb();
	try {
		const res = await pool.query('SELECT role FROM users WHERE discord_id = $1', [discordId]);
		if (res.rows.length > 0) return res.rows[0].role;
	} catch (e) {}
	return discordId === '691289686093725736' ? 'admin' : 'user';
}

export async function getDbCards() {
	await initDb();
	try {
		const res = await pool.query('SELECT * FROM cards ORDER BY title ASC');
		return res.rows.map((row) => ({
			id: row.id,
			title: row.title,
			description: row.description,
			category: row.category,
			tags: row.tags || [],
			images: row.images || [],
			createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
			updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
		}));
	} catch (e) {
		return [];
	}
}

export async function getDbUserStats(userId = 'default_user') {
	await initDb();
	try {
		const res = await pool.query('SELECT * FROM user_stats WHERE user_id = $1', [userId]);
		if (res.rows.length > 0) {
			const row = res.rows[0];
			return {
				cardsStudied: row.cards_studied || 0,
				quizAnswered: row.quiz_answered || 0,
				quizCorrect: row.quiz_correct || 0,
				streakDays: row.streak_days || 1,
				lastStudiedDate: row.last_studied_date || '',
				favorites: row.favorites || []
			};
		}
	} catch (e) {
		// Fallback
	}
	return {
		cardsStudied: 0,
		quizAnswered: 0,
		quizCorrect: 0,
		streakDays: 1,
		lastStudiedDate: '',
		favorites: []
	};
}

export async function updateDbUserStats(stats: any, userId = 'default_user') {
	await initDb();
	try {
		await pool.query(
			`INSERT INTO user_stats (user_id, cards_studied, quiz_answered, quiz_correct, streak_days, last_studied_date, favorites)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)
			 ON CONFLICT (user_id) DO UPDATE SET
				cards_studied = EXCLUDED.cards_studied,
				quiz_answered = EXCLUDED.quiz_answered,
				quiz_correct = EXCLUDED.quiz_correct,
				streak_days = EXCLUDED.streak_days,
				last_studied_date = EXCLUDED.last_studied_date,
				favorites = EXCLUDED.favorites;`,
			[
				userId,
				stats.cardsStudied || 0,
				stats.quizAnswered || 0,
				stats.quizCorrect || 0,
				stats.streakDays || 1,
				stats.lastStudiedDate || '',
				stats.favorites || []
			]
		);
	} catch (e) {
		// Ignore if DB unreachable
	}
}
