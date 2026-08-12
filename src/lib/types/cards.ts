export interface Card {
	id: string;
	title: string; // Acronimo o sigla breve (es. "IF", "SCMT", "RFI")
	fullName?: string; // Significato esteso / acronimo completo (es. "Impresa Ferroviaria")
	description: string; // Definizione e spiegazione d'uso dettagliata
	category?: string; // Categoria singola (retrocompatibilità)
	categories?: string[]; // Categorie multiple
	tags?: string[]; // Etichette secondarie
	images?: string[]; // Lista URL o percorsi immagini
	createdAt: string;
	updatedAt: string;
}

export type WritingSubMode = 'title-to-desc' | 'desc-to-title' | 'photo-to-title';
