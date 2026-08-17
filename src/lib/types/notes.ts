export interface Note {
	id: string;
	userId?: string;
	title: string;
	content: string; // Testo formattato in Markdown
	category: string; // es. "Segnalamento", "Normativa RFI", "Trazione", "Esercizio", "Varie"
	tags?: string[]; // Etichette secondarie opzionali
	images?: string[]; // Lista URL delle immagini associate e incollate nella nota
	isPinned?: boolean; // Se fissato in cima
	isArchived?: boolean; // Se la nota è archiviata
	archivedAt?: string; // Data di archiviazione
	isPublic?: boolean; // Se la nota è condivisa pubblicamente
	shareId?: string; // ID / token di condivisione link
	order: number; // Posizione numerica per riordinamento personalizzato
	isDeleted?: boolean; // Se la nota si trova nel cestino
	deletedAt?: string; // Data di cancellazione / spostamento nel cestino
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
