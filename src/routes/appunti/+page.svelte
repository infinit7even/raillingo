<script lang="ts">
	import { onMount } from 'svelte';
	import { notesStore } from '$lib/stores/notesStore';
	import { parseMarkdown, getMarkdownStats } from '$lib/utils/markdown';
	import type { Note, NoteSortOption } from '$lib/types/notes';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import NoteEditorModal from '$lib/components/NoteEditorModal.svelte';
	import NoteFocusModal from '$lib/components/NoteFocusModal.svelte';
	import { toastStore } from '$lib/stores/toastStore';

	let { data } = $props();

	const seed = (() => {
		const list: Note[] = data.initialNotes ?? [];
		return { list };
	})();

	let notes = $state<Note[]>(seed.list);
	let searchQuery = $state('');
	let selectedCategory = $state<string>('ALL');
	let sortOption = $state<NoteSortOption>('custom');
	let isReorderMode = $state(false);

	// Modal states
	let isEditorOpen = $state(false);
	let editingNote = $state<Note | null>(null);
	let isFocusOpen = $state(false);
	let focusingNote = $state<Note | null>(null);

	onMount(() => {
		notesStore.hydrate(data.initialNotes);
		const unsub = notesStore.subscribe((n) => {
			notes = n;
		});
		return unsub;
	});

	// Tutte le categorie disponibili con conteggio
	let availableCategories = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const n of notes) {
			const cat = n.category?.trim() || 'Varie';
			counts.set(cat, (counts.get(cat) || 0) + 1);
		}
		return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], 'it'));
	});

	// Statistiche complessive
	let totalWords = $derived(
		notes.reduce((acc, n) => acc + getMarkdownStats(n.content).wordCount, 0)
	);
	let pinnedCount = $derived(notes.filter((n) => n.isPinned).length);

	// Note filtrate e ordinate
	let filteredNotes = $derived.by(() => {
		let list = [...notes];

		// 1. Filtro Categoria
		if (selectedCategory !== 'ALL') {
			list = list.filter((n) => (n.category?.trim() || 'Varie') === selectedCategory);
		}

		// 2. Ricerca
		const q = searchQuery.toLowerCase().trim();
		if (q) {
			list = list.filter(
				(n) =>
					n.title.toLowerCase().includes(q) ||
					n.content.toLowerCase().includes(q) ||
					n.category.toLowerCase().includes(q) ||
					(n.tags && n.tags.some((t) => t.toLowerCase().includes(q)))
			);
		}

		// 3. Ordinamento
		if (sortOption === 'custom') {
			// Ordine manuale (le note con isPinned rimangono sempre per prime)
			list.sort((a, b) => {
				if (a.isPinned && !b.isPinned) return -1;
				if (!a.isPinned && b.isPinned) return 1;
				return (b.order ?? 0) - (a.order ?? 0);
			});
		} else if (sortOption === 'date-desc') {
			list.sort((a, b) => {
				if (a.isPinned && !b.isPinned) return -1;
				if (!a.isPinned && b.isPinned) return 1;
				return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
			});
		} else if (sortOption === 'date-asc') {
			list.sort((a, b) => {
				if (a.isPinned && !b.isPinned) return -1;
				if (!a.isPinned && b.isPinned) return 1;
				return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
			});
		} else if (sortOption === 'title-asc') {
			list.sort((a, b) => {
				if (a.isPinned && !b.isPinned) return -1;
				if (!a.isPinned && b.isPinned) return 1;
				return a.title.localeCompare(b.title, 'it');
			});
		} else if (sortOption === 'category') {
			list.sort((a, b) => {
				if (a.isPinned && !b.isPinned) return -1;
				if (!a.isPinned && b.isPinned) return 1;
				return (a.category || '').localeCompare(b.category || '', 'it');
			});
		}

		return list;
	});

	function handleNewNote() {
		editingNote = null;
		isEditorOpen = true;
	}

	function handleEditNote(note: Note) {
		editingNote = note;
		isEditorOpen = true;
	}

	function handleOpenFocus(note: Note) {
		focusingNote = note;
		isFocusOpen = true;
	}

	async function handleDelete(note: Note) {
		if (confirm(`Sei sicuro di voler eliminare l'appunto "${note.title}"?`)) {
			await notesStore.deleteNote(note.id);
		}
	}

	async function handleTogglePin(note: Note) {
		await notesStore.togglePin(note.id);
	}

	async function handleMove(noteId: string, direction: 'up' | 'down') {
		await notesStore.moveNote(noteId, direction);
	}

	function countChecklist(content: string) {
		const matches = content.match(/[\*\-]\s+\[([ xX])\]/g);
		if (!matches) return null;
		const total = matches.length;
		const completed = matches.filter((m) => m.toLowerCase().includes('[x]')).length;
		return { total, completed };
	}
</script>

<div class="notes-page-container">
	<!-- Page Header Banner Desktop -->
	<PageHeader
		title="Appunti di Studio"
		subtitle="Quaderno digitale, sintesi normative e schede di ripasso"
		badge="AREA STUDIO"
		icon="/emoji/clipboard_3d.png"
		variant="orange"
	>
		<button type="button" class="duo-btn duo-btn-green new-note-header-btn" onclick={handleNewNote}>
			➕ NUOVO APPUNTO
		</button>
	</PageHeader>

	<!-- Statistiche e Sintesi Rapida -->
	<div class="notes-stats-row duo-card">
		<div class="stat-box">
			<span class="stat-number">{notes.length}</span>
			<span class="stat-label">Appunti Totali</span>
		</div>
		<div class="stat-box">
			<span class="stat-number">{pinnedCount}</span>
			<span class="stat-label">In Evidenza 📌</span>
		</div>
		<div class="stat-box">
			<span class="stat-number">{availableCategories.length}</span>
			<span class="stat-label">Categorie</span>
		</div>
		<div class="stat-box">
			<span class="stat-number">{totalWords}</span>
			<span class="stat-label">Parole Scritte</span>
		</div>
	</div>

	<!-- Mobile CTA Button -->
	<div class="mobile-cta-box">
		<button type="button" class="duo-btn duo-btn-green mobile-new-btn" onclick={handleNewNote}>
			<img src="/emoji/writing_hand_3d_default.png" alt="" class="btn-emoji-img" />
			NUOVO APPUNTO
		</button>
	</div>

	<!-- Search & Sort Controls Toolbar -->
	<div class="controls-toolbar duo-card">
		<div class="search-box">
			<span class="search-icon">🔍</span>
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Cerca negli appunti, per titolo, testo o tag..."
				class="search-input"
			/>
			{#if searchQuery}
				<button type="button" class="clear-search-btn" onclick={() => (searchQuery = '')}>✕</button>
			{/if}
		</div>

		<div class="sort-actions">
			<div class="sort-select-wrapper">
				<span class="sort-lbl">Ordina per:</span>
				<select bind:value={sortOption} class="sort-select">
					<option value="custom">📌 Personalizzato</option>
					<option value="date-desc">🕒 Più Recenti</option>
					<option value="date-asc">📅 Meno Recenti</option>
					<option value="title-asc">🔤 Alfabetico (A-Z)</option>
					<option value="category">🏷️ Per Categoria</option>
				</select>
			</div>

			<button
				type="button"
				class="reorder-mode-btn"
				class:active={isReorderMode}
				onclick={() => {
					isReorderMode = !isReorderMode;
					if (isReorderMode) sortOption = 'custom';
				}}
				title="Attiva pulsanti per riordinare manualmente gli appunti"
			>
				↕️ {isReorderMode ? 'Fine Riordino' : 'Riordina'}
			</button>
		</div>
	</div>

	<!-- Category Filter Bar -->
	<div class="categories-filter-bar">
		<button
			type="button"
			class="cat-chip"
			class:active={selectedCategory === 'ALL'}
			onclick={() => (selectedCategory = 'ALL')}
		>
			TUTTI ({notes.length})
		</button>

		{#each availableCategories as [catName, count]}
			<button
				type="button"
				class="cat-chip"
				class:active={selectedCategory === catName}
				onclick={() => (selectedCategory = catName)}
			>
				{catName} ({count})
			</button>
		{/each}
	</div>

	<!-- Notes Grid -->
	{#if filteredNotes.length === 0}
		<div class="empty-state duo-card">
			<img src="/emoji/owl_3d.png" alt="Gufo di studio" class="empty-owl-img" />
			<h3 class="empty-title">
				{#if searchQuery}
					Nessun appunto trovato per "{searchQuery}"
				{:else if selectedCategory !== 'ALL'}
					Nessun appunto nella categoria "{selectedCategory}"
				{:else}
					Nessun appunto presente nel tuo quaderno
				{/if}
			</h3>
			<p class="empty-subtitle">
				Inizia subito a prendere appunti in Markdown per fissare i concetti delle lezioni ferroviarie!
			</p>
			<button type="button" class="duo-btn duo-btn-green" onclick={handleNewNote}>
				➕ PRENDI IL TUO PRIMO APPUNTO
			</button>
		</div>
	{:else}
		<div class="notes-grid">
			{#each filteredNotes as note, i (note.id)}
				{@const stats = getMarkdownStats(note.content)}
				{@const checklist = countChecklist(note.content)}
				<div class="note-card duo-card" class:pinned-card={note.isPinned}>
					<!-- Top Card Row -->
					<div class="card-top-row">
						<span class="note-cat-badge">{note.category}</span>

						<div class="card-badges-right">
							{#if note.isPinned}
								<span class="pinned-badge" title="Fissato in evidenza">📌 Fissato</span>
							{/if}

							<button
								type="button"
								class="pin-action-btn"
								class:pinned={note.isPinned}
								onclick={() => handleTogglePin(note)}
								title={note.isPinned ? 'Rimuovi pin' : 'Fissa in cima'}
							>
								📌
							</button>
						</div>
					</div>

					<!-- Note Title -->
					<h2 class="note-card-title">
						<button
							type="button"
							class="note-card-title-btn"
							onclick={() => handleOpenFocus(note)}
						>
							{note.title}
						</button>
					</h2>

					<!-- Note Excerpt -->
					<p class="note-card-excerpt">
						{note.content.replace(/[#*`_~>[\]()|\\-]/g, ' ').slice(0, 140)}
						{note.content.length > 140 ? '...' : ''}
					</p>

					<!-- Tags Row -->
					{#if note.tags && note.tags.length > 0}
						<div class="card-tags-row">
							{#each note.tags as tag}
								<span class="card-tag">#{tag}</span>
							{/each}
						</div>
					{/if}

					<!-- Checklist / Meta Bar -->
					<div class="card-meta-bar">
						{#if checklist}
							<span class="checklist-pill" class:completed={checklist.completed === checklist.total}>
								☑️ {checklist.completed}/{checklist.total} completati
							</span>
						{/if}
						<span class="meta-item">⏱️ ~{stats.readingTimeMinutes} min</span>
						<span class="meta-item">📝 {stats.wordCount} parole</span>
					</div>

					<!-- Bottom Action Buttons -->
					<div class="card-actions-row">
						{#if isReorderMode}
							<div class="reorder-btns-group">
								<button
									type="button"
									class="reorder-step-btn"
									onclick={() => handleMove(note.id, 'up')}
									disabled={i === 0}
									title="Sposta su"
								>
									⬆️
								</button>
								<button
									type="button"
									class="reorder-step-btn"
									onclick={() => handleMove(note.id, 'down')}
									disabled={i === filteredNotes.length - 1}
									title="Sposta giù"
								>
									⬇️
								</button>
							</div>
						{/if}

						<button
							type="button"
							class="card-action-btn focus-mode-btn"
							onclick={() => handleOpenFocus(note)}
							title="Modalità Studio a Schermo Intero"
						>
							📖 Studio
						</button>

						<button
							type="button"
							class="card-action-btn edit-action-btn"
							onclick={() => handleEditNote(note)}
							title="Modifica appunto"
						>
							✏️ Modifica
						</button>

						<button
							type="button"
							class="card-action-btn delete-action-btn"
							onclick={() => handleDelete(note)}
							title="Elimina appunto"
						>
							🗑️
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Modal di Modifica / Creazione -->
<NoteEditorModal
	isOpen={isEditorOpen}
	initialNote={editingNote}
	onClose={() => {
		isEditorOpen = false;
		editingNote = null;
	}}
/>

<!-- Modal di Studio & Lettura Focus -->
<NoteFocusModal
	isOpen={isFocusOpen}
	note={focusingNote}
	onClose={() => {
		isFocusOpen = false;
		focusingNote = null;
	}}
	onEdit={(note) => {
		isFocusOpen = false;
		handleEditNote(note);
	}}
/>

<style>
	.notes-page-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		max-width: 1100px;
		margin: 0 auto;
	}

	.new-note-header-btn {
		font-size: 0.85rem;
		padding: 0.65rem 1.1rem;
	}

	/* Stats Row */
	.notes-stats-row {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
		padding: 1rem;
	}

	@media (min-width: 640px) {
		.notes-stats-row {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	.stat-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.15rem;
		padding: 0.35rem 0.5rem;
		border-radius: 12px;
		background: var(--card-bg-subtle);
	}

	.stat-number {
		font-family: 'Outfit', sans-serif;
		font-size: 1.5rem;
		font-weight: 900;
		color: var(--accent-color);
		line-height: 1;
	}

	.stat-label {
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Mobile CTA */
	.mobile-cta-box {
		display: flex;
	}

	@media (min-width: 1024px) {
		.mobile-cta-box {
			display: none;
		}
	}

	.mobile-new-btn {
		width: 100%;
		padding: 0.85rem;
		font-size: 0.95rem;
	}

	.btn-emoji-img {
		width: 22px;
		height: 22px;
		object-fit: contain;
	}

	/* Controls Toolbar */
	.controls-toolbar {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.85rem 1.15rem;
	}

	@media (min-width: 768px) {
		.controls-toolbar {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
		}
	}

	.search-box {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 12px;
		padding: 0.45rem 0.75rem;
	}

	.search-icon {
		font-size: 0.95rem;
		color: var(--text-muted);
	}

	.search-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-color);
		font-family: inherit;
		font-size: 0.88rem;
		font-weight: 700;
	}

	.clear-search-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		font-size: 0.9rem;
		font-weight: 800;
		cursor: pointer;
	}

	.sort-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.sort-select-wrapper {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.sort-lbl {
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.sort-select {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 10px;
		padding: 0.35rem 0.65rem;
		color: var(--text-color);
		font-family: inherit;
		font-size: 0.8rem;
		font-weight: 800;
		outline: none;
	}

	.reorder-mode-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 10px;
		padding: 0.35rem 0.65rem;
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--text-color);
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s ease;
	}

	.reorder-mode-btn.active {
		background: rgba(255, 150, 0, 0.18);
		border-color: var(--orange-color);
		color: var(--orange-color);
	}

	/* Category Filter Bar */
	.categories-filter-bar {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		overflow-x: auto;
		padding-bottom: 0.3rem;
		scrollbar-width: none;
	}

	.categories-filter-bar::-webkit-scrollbar {
		display: none;
	}

	.cat-chip {
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		border-bottom: 3.5px solid var(--border-depth-color);
		border-radius: 9999px;
		padding: 0.4rem 0.85rem;
		font-size: 0.76rem;
		font-weight: 800;
		color: var(--text-muted);
		cursor: pointer;
		white-space: nowrap;
		user-select: none;
		transition: all 0.15s ease;
	}

	.cat-chip.active {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		border-bottom-color: var(--accent-depth);
		color: var(--accent-color);
		font-weight: 900;
	}

	/* Notes Grid */
	.notes-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.85rem;
	}

	@media (min-width: 640px) {
		.notes-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.notes-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.note-card {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.65rem;
		padding: 1rem 1.15rem;
		background: var(--card-bg);
		border-radius: 18px;
		transition:
			transform 0.15s ease,
			border-color 0.2s ease;
	}

	.note-card:hover {
		transform: translateY(-2px);
		border-color: var(--accent-color);
	}

	.pinned-card {
		border-color: rgba(255, 150, 0, 0.45);
		background: linear-gradient(180deg, var(--card-bg) 0%, rgba(255, 150, 0, 0.04) 100%);
	}

	.card-top-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
	}

	.note-cat-badge {
		font-size: 0.68rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: var(--accent-light-bg);
		color: var(--accent-color);
		border: 1px solid var(--accent-color);
		border-radius: 6px;
		padding: 0.15rem 0.45rem;
	}

	.card-badges-right {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.pinned-badge {
		font-size: 0.68rem;
		font-weight: 800;
		color: var(--orange-color);
		background: rgba(255, 150, 0, 0.15);
		border-radius: 6px;
		padding: 0.15rem 0.4rem;
	}

	.pin-action-btn {
		background: transparent;
		border: none;
		cursor: pointer;
		font-size: 0.85rem;
		opacity: 0.4;
		transition: opacity 0.15s ease;
	}

	.pin-action-btn.pinned,
	.pin-action-btn:hover {
		opacity: 1;
	}

	.note-card-title {
		font-family: 'Outfit', sans-serif;
		font-size: 1.15rem;
		font-weight: 900;
		color: var(--text-color);
		line-height: 1.25;
		margin: 0;
	}

	.note-card-title-btn {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: inherit;
		text-align: left;
		cursor: pointer;
		display: inline;
		transition: color 0.15s ease;
	}

	.note-card-title-btn:hover {
		color: var(--accent-color);
	}

	.note-card-excerpt {
		font-size: 0.85rem;
		line-height: 1.45;
		color: var(--text-muted);
		margin: 0;
		flex: 1;
	}

	.card-tags-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.card-tag {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--text-muted);
		background: var(--card-bg-subtle);
		border-radius: 4px;
		padding: 0.1rem 0.35rem;
	}

	.card-meta-bar {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--text-muted);
		flex-wrap: wrap;
		padding-top: 0.4rem;
		border-top: 1px dashed var(--border-color);
	}

	.checklist-pill {
		background: rgba(28, 176, 246, 0.12);
		color: var(--accent-color);
		padding: 0.1rem 0.4rem;
		border-radius: 6px;
		font-weight: 800;
	}

	.checklist-pill.completed {
		background: rgba(88, 204, 2, 0.15);
		color: var(--green-color);
	}

	.card-actions-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding-top: 0.35rem;
	}

	.reorder-btns-group {
		display: flex;
		gap: 0.2rem;
		margin-right: 0.2rem;
	}

	.reorder-step-btn {
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		padding: 0.25rem 0.4rem;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.reorder-step-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.card-action-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 10px;
		padding: 0.4rem 0.65rem;
		font-size: 0.78rem;
		font-weight: 800;
		color: var(--text-color);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.focus-mode-btn {
		flex: 1;
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.edit-action-btn:hover {
		background: var(--hover-bg);
	}

	.delete-action-btn {
		color: #ff5e5b;
		padding: 0.4rem 0.55rem;
	}

	.delete-action-btn:hover {
		background: rgba(255, 75, 75, 0.15);
		border-color: #ff5e5b;
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 3rem 1.5rem;
		gap: 0.85rem;
	}

	.empty-owl-img {
		width: 80px;
		height: 80px;
		object-fit: contain;
		animation: gentleWobble 2s infinite ease-in-out;
	}

	.empty-title {
		font-size: 1.25rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.empty-subtitle {
		font-size: 0.9rem;
		color: var(--text-muted);
		max-width: 420px;
		line-height: 1.5;
		margin: 0;
	}
</style>
