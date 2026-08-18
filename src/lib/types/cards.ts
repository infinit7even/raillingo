export interface Card {
	id: string;
	title: string; // Titolo principale / termine obbligatorio
	hasAcronym?: boolean; // Se la scheda ha una sigla/acronimo associato
	acronym?: string; // Sigla/acronimo opzionale
	description: string; // Definizione e spiegazione d'uso dettagliata
	category?: string; // Categoria principale
	categories?: string[]; // Categorie multiple
	tags?: string[]; // Etichette secondarie
	images?: string[]; // Lista URL o percorsi immagini
	showInWiki?: boolean; // Se visibile nella Wiki (default: true)
	gameModes?: string[]; // Mini giochi abilitati: ['flashcard', 'flashcard:text', 'flashcard:photo', 'flashcard:reverse', 'quiz', 'reels', 'scrittura']
	isDeleted?: boolean; // Se la card si trova nel cestino
	deletedAt?: string; // Data di spostamento nel cestino
	createdAt: string;
	updatedAt: string;
}

export type WritingSubMode = 'title-to-desc' | 'desc-to-title' | 'photo-to-title';

export const ALL_GAME_MODES = [
	'flashcard',
	'flashcard:text',
	'flashcard:photo',
	'flashcard:reverse',
	'quiz',
	'reels',
	'scrittura'
] as const;

export function isCardVisibleInGame(
	card: Card,
	game: 'wiki' | 'flashcard' | 'flashcard:text' | 'flashcard:photo' | 'flashcard:reverse' | 'quiz' | 'reels' | 'scrittura'
): boolean {
	if (game === 'wiki') {
		return card.showInWiki !== false;
	}

	const hasImages = Array.isArray(card.images) && card.images.length > 0;

	// Reels richiede sempre almeno una foto
	if (game === 'reels' && !hasImages) {
		return false;
	}

	// Flashcard foto richiede sempre almeno una foto
	if (game === 'flashcard:photo' && !hasImages) {
		return false;
	}

	if (!card.gameModes || !Array.isArray(card.gameModes) || card.gameModes.length === 0) {
		// Retrocompatibilità: visibile ovunque compatibile
		return true;
	}

	// Controllo diretto
	if (card.gameModes.includes(game)) {
		return true;
	}

	// Se richiesto 'flashcard' generico o una sottocategoria, supporta la presenza di 'flashcard'
	if (game.startsWith('flashcard')) {
		if (card.gameModes.includes('flashcard')) {
			return true;
		}
		if (game === 'flashcard') {
			return card.gameModes.some((m) => m.startsWith('flashcard'));
		}
	}

	return false;
}
