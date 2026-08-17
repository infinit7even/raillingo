import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let databaseUrl = process.env.DATABASE_URL;
try {
	const { env } = await import('$env/dynamic/private');
	if (env?.DATABASE_URL) {
		databaseUrl = env.DATABASE_URL;
	}
} catch {
	// Esecuzione fuori dal runtime di SvelteKit (script o migrazioni)
}

const connectionString =
	databaseUrl ||
	process.env.DATABASE_URL ||
	'postgres://raillingo:raillingo@localhost:5237/raillingo';

const client = postgres(connectionString, {
	max: 10,
	idle_timeout: 30,
	connect_timeout: 10,
	onnotice: () => {}
});

export const db = drizzle(client, { schema });
