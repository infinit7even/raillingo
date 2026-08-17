import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/lib/server/db/schema';

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
				has_acronym boolean DEFAULT false,
				acronym text,
				description text NOT NULL DEFAULT '',
				category text NOT NULL DEFAULT 'Generale',
				images jsonb DEFAULT '[]'::jsonb,
				tags jsonb DEFAULT '[]'::jsonb,
				show_in_wiki boolean DEFAULT true,
				game_modes jsonb DEFAULT '["flashcard", "quiz", "reels", "scrittura"]'::jsonb,
				is_deleted boolean DEFAULT false,
				deleted_at timestamptz,
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
				is_deleted boolean DEFAULT false,
				deleted_at timestamptz,
				created_at timestamptz NOT NULL DEFAULT now(),
				updated_at timestamptz NOT NULL DEFAULT now()
			);

			ALTER TABLE "notes" DROP CONSTRAINT IF EXISTS "notes_user_id_fkey";
			ALTER TABLE "notes" DROP CONSTRAINT IF EXISTS "notes_user_id_user_id_fk";

			-- Aggiornamenti colonne esistenti
			ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS has_acronym boolean DEFAULT false;
			ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS acronym text;
			ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS show_in_wiki boolean DEFAULT true;
			ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS game_modes jsonb DEFAULT '["flashcard", "quiz", "reels", "scrittura"]'::jsonb;
			ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
			ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

			ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
			ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

			UPDATE "cards" SET show_in_wiki = true WHERE show_in_wiki IS NULL;
			UPDATE "cards" SET game_modes = '["flashcard", "quiz", "reels", "scrittura"]'::jsonb WHERE game_modes IS NULL;
			UPDATE "cards" SET is_deleted = false WHERE is_deleted IS NULL;
			UPDATE "notes" SET is_deleted = false WHERE is_deleted IS NULL;
		`);

		console.log('✅ Tables created/verified/updated successfully in PostgreSQL.');

		const existingCards = await client`SELECT count(*)::int as count FROM "cards"`;
		console.log(`ℹ️ La tabella "cards" contiene ${existingCards[0]?.count} record.`);

		const existingNotes = await client`SELECT count(*)::int as count FROM "notes"`;
		console.log(`ℹ️ La tabella "notes" contiene ${existingNotes[0]?.count} record.`);

		console.log('🎉 Migrazione e inizializzazione database completata con successo!');
	} catch (err) {
		console.error('❌ Errore durante la migrazione del database:', err);
		process.exit(1);
	} finally {
		await client.end();
	}
}

runMigration();
