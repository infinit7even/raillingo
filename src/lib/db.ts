// Database usage has been removed in favor of static JSON files (/static/data/cards.json).
// This module provides stub fallbacks for backwards compatibility if needed.

export async function initDb() {}

export async function upsertDbUser(discordId: string, email: string, username = '', defaultRole = 'user') {
	return discordId === '691289686093725736' ? 'admin' : 'user';
}

export async function getAllDbUsers() {
	return [];
}

export async function updateDbUserRole(_discordId: string, _role: string) {
	return true;
}

export async function getDbUserRole(discordId: string) {
	return discordId === '691289686093725736' ? 'admin' : 'user';
}

export async function getDbCards() {
	return [];
}

