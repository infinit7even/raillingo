import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/lib/server/db/schema';
import fs from 'node:fs/promises';
import path from 'node:path';

const connectionString =
	process.env.DATABASE_URL ||
	'postgres://raillingo:raillingo@localhost:5237/raillingo';

console.log('Connecting to PostgreSQL database at:', connectionString);
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema });

async function runMigration() {
	try {
		console.log('--- Step 1: Creating database schema if not exists ---');

		await client.unsafe(`
			CREATE TABLE IF NOT EXISTS "user" (
				id text PRIMARY KEY,
				name text NOT NULL,
				email text NOT NULL UNIQUE,
				email_verified boolean NOT NULL DEFAULT false,
				image text,
				created_at timestamptz NOT NULL DEFAULT now(),
				updated_at timestamptz NOT NULL DEFAULT now(),
				role text NOT NULL DEFAULT 'user',
				ignored_card_ids jsonb DEFAULT '[]'::jsonb,
				favorites jsonb DEFAULT '[]'::jsonb,
				stats jsonb DEFAULT '{}'::jsonb
			);

			CREATE TABLE IF NOT EXISTS "session" (
				id text PRIMARY KEY,
				expires_at timestamptz NOT NULL,
				token text NOT NULL UNIQUE,
				created_at timestamptz NOT NULL DEFAULT now(),
				updated_at timestamptz NOT NULL DEFAULT now(),
				ip_address text,
				user_agent text,
				user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS "account" (
				id text PRIMARY KEY,
				account_id text NOT NULL,
				provider_id text NOT NULL,
				user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
				access_token text,
				refresh_token text,
				id_token text,
				access_token_expires_at timestamptz,
				refresh_token_expires_at timestamptz,
				scope text,
				password text,
				created_at timestamptz NOT NULL DEFAULT now(),
				updated_at timestamptz NOT NULL DEFAULT now()
			);

			CREATE TABLE IF NOT EXISTS "verification" (
				id text PRIMARY KEY,
				identifier text NOT NULL,
				value text NOT NULL,
				expires_at timestamptz NOT NULL,
				created_at timestamptz,
				updated_at timestamptz
			);

			CREATE TABLE IF NOT EXISTS "cards" (
				id text PRIMARY KEY,
				title text NOT NULL,
				full_name text,
				description text NOT NULL DEFAULT '',
				category text NOT NULL DEFAULT 'Generale',
				images jsonb DEFAULT '[]'::jsonb,
				tags jsonb DEFAULT '[]'::jsonb,
				created_at timestamptz NOT NULL DEFAULT now(),
				updated_at timestamptz NOT NULL DEFAULT now()
			);

			CREATE TABLE IF NOT EXISTS "notes" (
				id text PRIMARY KEY,
				user_id text,
				title text NOT NULL DEFAULT 'Nuovo Appunto',
				content text NOT NULL DEFAULT '',
				category text NOT NULL DEFAULT 'Normativa RFI',
				tags jsonb DEFAULT '[]'::jsonb,
				images jsonb DEFAULT '[]'::jsonb,
				is_pinned boolean NOT NULL DEFAULT false,
				is_public boolean NOT NULL DEFAULT false,
				share_id text UNIQUE,
				"order" integer NOT NULL DEFAULT 0,
				created_at timestamptz NOT NULL DEFAULT now(),
				updated_at timestamptz NOT NULL DEFAULT now()
			);

			ALTER TABLE "notes" DROP CONSTRAINT IF EXISTS "notes_user_id_fkey";
			ALTER TABLE "notes" DROP CONSTRAINT IF EXISTS "notes_user_id_user_id_fk";
		`);

		console.log('✅ Tables created/verified successfully in PostgreSQL.');

		// --- Step 2: Seed cards from data/cards.json if cards table is empty ---
		const existingCards = await client`SELECT count(*)::int as count FROM "cards"`;
		if (existingCards[0]?.count === 0) {
			const cardsFile = path.resolve('data/cards.json');
			try {
				const raw = await fs.readFile(cardsFile, 'utf-8');
				const cardsList = JSON.parse(raw);
				if (Array.isArray(cardsList) && cardsList.length > 0) {
					console.log(`Importing ${cardsList.length} cards from data/cards.json into PostgreSQL...`);
					for (const c of cardsList) {
						const createdAt = c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString();
						const updatedAt = c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString();
						await client`
							INSERT INTO "cards" (id, title, full_name, description, category, images, tags, created_at, updated_at)
							VALUES (
								${c.id || `card-${Date.now()}`},
								${c.title || c.fullName || 'Scheda'},
								${c.fullName || null},
								${c.description || ''},
								${c.category || 'Generale'},
								${JSON.stringify(c.images || [])}::jsonb,
								${JSON.stringify(c.tags || [])}::jsonb,
								${createdAt}::timestamptz,
								${updatedAt}::timestamptz
							)
							ON CONFLICT (id) DO NOTHING
						`;
					}
					console.log('✅ Cards imported successfully!');
				}
			} catch (e) {
				console.error('Errore import cards:', e);
			}
		} else {
			console.log(`ℹ️ La tabella "cards" contiene già ${existingCards[0]?.count} record.`);
		}

		// --- Step 3: Seed notes from data/notes.json if notes table is empty ---
		const existingNotes = await client`SELECT count(*)::int as count FROM "notes"`;
		if (existingNotes[0]?.count === 0) {
			const notesFile = path.resolve('data/notes.json');
			try {
				const raw = await fs.readFile(notesFile, 'utf-8');
				const notesList = JSON.parse(raw);
				if (Array.isArray(notesList) && notesList.length > 0) {
					console.log(`Importing ${notesList.length} notes from data/notes.json into PostgreSQL...`);
					for (const n of notesList) {
						const createdAt = n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString();
						const updatedAt = n.updatedAt ? new Date(n.updatedAt).toISOString() : new Date().toISOString();
						await client`
							INSERT INTO "notes" (id, user_id, title, content, category, tags, images, is_pinned, is_public, share_id, "order", created_at, updated_at)
							VALUES (
								${n.id || `note-${Date.now()}`},
								${n.userId || null},
								${n.title || 'Nuovo Appunto'},
								${n.content || ''},
								${n.category || 'Normativa RFI'},
								${JSON.stringify(n.tags || [])}::jsonb,
								${JSON.stringify(n.images || [])}::jsonb,
								${Boolean(n.isPinned)},
								${Boolean(n.isPublic)},
								${n.shareId || null},
								${typeof n.order === 'number' ? n.order : 0},
								${createdAt}::timestamptz,
								${updatedAt}::timestamptz
							)
							ON CONFLICT (id) DO NOTHING
						`;
					}
					console.log('✅ Notes imported successfully!');
				}
			} catch (e) {
				console.error('Errore import notes:', e);
			}
		} else {
			console.log(`ℹ️ La tabella "notes" contiene già ${existingNotes[0]?.count} record.`);
		}

		console.log('🎉 Migrazione e inizializzazione database completata con successo!');
	} catch (err) {
		console.error('❌ Errore durante la migrazione del database:', err);
		process.exit(1);
	} finally {
		await client.end();
	}
}

runMigration();
