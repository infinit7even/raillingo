export interface Card {
	id: string;
	title: string;          // Acronimo o termine (es. "RFI", "SCMT")
	description: string;    // Definizione e spiegazione d'uso
	category?: string;     // Categoria (es. "Normativa", "Segnalamento", "Trazione", "Infrastruttura")
	tags?: string[];        // Etichette secondarie
	images?: string[];      // Lista URL o percorsi immagini
	createdAt: string;
	updatedAt: string;
}

export type StudyMode =
	| 'ripasso'          // Acronimo -> Descrizione + Immagini
	| 'ripasso-foto'     // Immagine -> Acronimo -> Descrizione
	| 'ripasso-inverso'  // Descrizione -> Acronimo
	| 'quiz'             // Quiz a 5 scelte
	| 'scrittura';       // Esercizio digitazione

export type WritingSubMode = 'title-to-desc' | 'desc-to-title' | 'photo-to-title';

export interface UserStats {
	totalStudied: number;
	correctAnswers: number;
	streakDays: number;
	lastStudiedDate: string;
	favorites: string[]; // Card IDs
}
