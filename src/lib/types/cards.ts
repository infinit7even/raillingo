export interface Card {
	id: string;
	title: string; // Titolo principale / termine obbligatorio
	fullName?: string; // Significato esteso o testo descrittivo
	hasAcronym?: boolean; // Se la scheda ha una sigla/acronimo associato
	acronym?: string; // Sigla/acronimo opzionale
	description: string; // Definizione e spiegazione d'uso dettagliata
	category?: string; // Categoria principale
	categories?: string[]; // Categorie multiple
	tags?: string[]; // Etichette secondarie
	images?: string[]; // Lista URL o percorsi immagini
	showInWiki?: boolean; // Se visibile nella Wiki (default: true)
	gameModes?: string[]; // Mini giochi abilitati: ['flashcard', 'quiz', 'reels', 'scrittura'] (default: tutti)
	isDeleted?: boolean; // Se la card si trova nel cestino
	deletedAt?: string; // Data di spostamento nel cestino
	createdAt: string;
	updatedAt: string;
}

export type WritingSubMode = 'title-to-desc' | 'desc-to-title' | 'photo-to-title';

export const ALL_GAME_MODES = ['flashcard', 'quiz', 'reels', 'scrittura'] as const;

export function isCardVisibleInGame(
	card: Card,
	game: 'wiki' | 'flashcard' | 'quiz' | 'reels' | 'scrittura'
): boolean {
	if (game === 'wiki') {
		return card.showInWiki !== false;
	}
	if (!card.gameModes || !Array.isArray(card.gameModes) || card.gameModes.length === 0) {
		return true; // Retrocompatibilità: se non specificato, visibile ovunque
	}
	return card.gameModes.includes(game);
}
