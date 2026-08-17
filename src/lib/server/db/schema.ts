import { pgTable, text, boolean, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';

// ─── BETTER AUTH SCHEMA ───────────────────────────────────────────────────

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	role: text('role').notNull().default('user'), // 'user' | 'admin'
	ignoredCardIds: jsonb('ignored_card_ids').$type<string[]>().default([]),
	favorites: jsonb('favorites').$type<string[]>().default([]),
	stats: jsonb('stats').$type<{
		cardsStudied?: number;
		quizAnswered?: number;
		quizCorrect?: number;
		streakDays?: number;
		lastStudiedDate?: string;
	}>().default({})
});

export const session = pgTable('session', {
	id: text('id').primaryKey(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' })
});

export const account = pgTable('account', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const verification = pgTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }),
	updatedAt: timestamp('updated_at', { withTimezone: true })
});

// ─── CARDS SCHEMA (Acronimi & Schede Ferroviarie) ──────────────────────────

export const cards = pgTable('cards', {
	id: text('id').primaryKey(),
	title: text('title').notNull(),
	fullName: text('full_name'),
	hasAcronym: boolean('has_acronym').default(false),
	acronym: text('acronym'),
	description: text('description').notNull().default(''),
	category: text('category').notNull().default('Generale'),
	images: jsonb('images').$type<string[]>().default([]),
	tags: jsonb('tags').$type<string[]>().default([]),
	showInWiki: boolean('show_in_wiki').default(true),
	gameModes: jsonb('game_modes').$type<string[]>().default(['flashcard', 'quiz', 'reels', 'scrittura']),
	isDeleted: boolean('is_deleted').default(false),
	deletedAt: timestamp('deleted_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

// ─── NOTES SCHEMA (Appunti, Vault & Cestino) ─────────────────────────

export const notes = pgTable('notes', {
	id: text('id').primaryKey(),
	userId: text('user_id'),
	title: text('title').notNull().default('Nuovo Appunto'),
	content: text('content').notNull().default(''),
	category: text('category').notNull().default('Normativa RFI'),
	tags: jsonb('tags').$type<string[]>().default([]),
	images: jsonb('images').$type<string[]>().default([]),
	isPinned: boolean('is_pinned').notNull().default(false),
	isArchived: boolean('is_archived').default(false),
	archivedAt: timestamp('archived_at', { withTimezone: true }),
	isPublic: boolean('is_public').notNull().default(false),
	shareId: text('share_id').unique(),
	order: integer('order').notNull().default(0),
	isDeleted: boolean('is_deleted').default(false),
	deletedAt: timestamp('deleted_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

// ─── ADMIN LOGS SCHEMA (Tracciamento Azioni Amministratori) ──────────────

export const adminLogs = pgTable('admin_logs', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull(),
	userName: text('user_name').notNull().default('Admin'),
	userAvatar: text('user_avatar'),
	action: text('action').notNull(),
	targetType: text('target_type').notNull().default('card'),
	targetId: text('target_id'),
	targetTitle: text('target_title'),
	details: jsonb('details').$type<Record<string, any>>().default({}),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
export type DbCard = typeof cards.$inferSelect;
export type DbNote = typeof notes.$inferSelect;
export type DbAdminLog = typeof adminLogs.$inferSelect;
