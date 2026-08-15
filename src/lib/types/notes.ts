export interface Note {
	id: string;
	userId: string;
	title: string;
	content: string; // Testo formattato in Markdown
	category: string; // es. "Segnalamento", "Normativa RFI", "Trazione", "Esercizio", "Varie"
	tags?: string[]; // Etichette secondarie opzionali
	images?: string[]; // Lista URL delle immagini associate e incollate nella nota
	isPinned?: boolean; // Se fissato in cima
	order: number; // Posizione numerica per riordinamento personalizzato
	createdAt: string;
	updatedAt: string;
}

export type NoteSortOption = 'custom' | 'date-desc' | 'date-asc' | 'title-asc' | 'category';

export const DEFAULT_NOTE_CATEGORIES = [
	'Normativa RFI',
	'Segnalamento',
	'Trazione & Materiale',
	'Esercizio & Circolazione',
	'Sicurezza & SCMT',
	'Generale & Varie'
] as const;
