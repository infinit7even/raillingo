<script lang="ts">
	import { onMount } from 'svelte';
	import { notesStore } from '$lib/stores/notesStore';
	import {
		parseMarkdown,
		getMarkdownStats,
		extractHeadings,
		type HeadingItem
	} from '$lib/utils/markdown';
	import { DEFAULT_NOTE_CATEGORIES, type Note, type NoteSortOption } from '$lib/types/notes';
	import { toastStore } from '$lib/stores/toastStore';
	import { fade } from 'svelte/transition';

	let { data } = $props();

	const seed = (() => {
		const list: Note[] = data.initialNotes ?? [];
		return { list };
	})();

	let notes = $state<Note[]>(seed.list);
	let selectedNoteId = $state<string | null>(seed.list.length > 0 ? seed.list[0].id : null);
	let searchQuery = $state('');
	let selectedCategory = $state<string>('ALL');
	let sortOption = $state<NoteSortOption>('custom');

	// Workspace UI states
	let viewMode = $state<'edit' | 'preview' | 'split'>('edit');
	let isOutlineOpen = $state(false);
	let isSidebarOpenMobile = $state(true); // Su mobile: true = mostra lista file, false = mostra editor
	let isAutoSaving = $state(false);
	let lastSavedTime = $state<string>('');

	// Active note local editor state
	let currentTitle = $state('');
	let currentContent = $state('');
	let currentCategory = $state('Normativa RFI');
	let currentIsPinned = $state(false);
	let textareaEl = $state<HTMLTextAreaElement | null>(null);

	let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		notesStore.hydrate(data.initialNotes);
		const unsub = notesStore.subscribe((n) => {
			notes = n;
			if (!selectedNoteId && n.length > 0) {
				selectNote(n[0]);
			}
		});

		// Su desktop inizializza in modalità split o edit a seconda della larghezza
		if (window.innerWidth >= 1024) {
			viewMode = 'split';
			isSidebarOpenMobile = false;
		}

		return () => {
			unsub();
			if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
		};
	});

	// Seleziona una nota e carica i dati nel workspace editor
	function selectNote(note: Note) {
		selectedNoteId = note.id;
		currentTitle = note.title;
		currentContent = note.content || '';
		currentCategory = note.category || 'Normativa RFI';
		currentIsPinned = Boolean(note.isPinned);
		isSidebarOpenMobile = false; // Su mobile passa alla visualizzazione del file
	}

	// Trova la nota attiva nello store
	let activeNote = $derived(notes.find((n) => n.id === selectedNoteId) || null);

	// Se activeNote cambia dall'esterno e non stiamo modificando
	$effect(() => {
		if (activeNote && activeNote.id !== selectedNoteId) {
			selectNote(activeNote);
		}
	});

	// Tutte le categorie disponibili con conteggio
	let availableCategories = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const n of notes) {
			const cat = n.category?.trim() || 'Generale & Varie';
			counts.set(cat, (counts.get(cat) || 0) + 1);
		}
		return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], 'it'));
	});

	// Note filtrate per cartella/categoria e ricerca
	let filteredNotes = $derived.by(() => {
		let list = [...notes];

		// Filtro Categoria / Cartella
		if (selectedCategory !== 'ALL') {
			list = list.filter((n) => (n.category?.trim() || 'Generale & Varie') === selectedCategory);
		}

		// Ricerca
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

		// Ordinamento Obsidian style
		if (sortOption === 'custom') {
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

	// Markdown render e statistiche della nota attiva
	let renderedMarkdown = $derived(parseMarkdown(currentContent));
	let docStats = $derived(getMarkdownStats(currentContent));
	let headingsOutline = $derived<HeadingItem[]>(extractHeadings(currentContent));

	// Auto-save debounced a 600ms
	function triggerAutoSave() {
		if (!selectedNoteId) return;
		isAutoSaving = true;

		if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
		saveDebounceTimer = setTimeout(async () => {
			if (!selectedNoteId) return;
			await notesStore.updateNote({
				id: selectedNoteId,
				title: currentTitle.trim() || 'Appunto senza titolo',
				content: currentContent,
				category: currentCategory,
				isPinned: currentIsPinned
			});
			isAutoSaving = false;
			const now = new Date();
			lastSavedTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
		}, 600);
	}

	async function handleCreateNewNote() {
		const newNote = await notesStore.createNote({
			title: 'Nuovo Appunto',
			content: '### 📌 Obiettivi di Studio\n- [ ] Concetto chiave 1\n- [ ] Concetto chiave 2\n\n> [!TIP]\n> Inserisci qui le tue note di ripasso.\n',
			category: selectedCategory !== 'ALL' ? selectedCategory : 'Normativa RFI',
			isPinned: false
		});

		if (newNote) {
			selectNote(newNote);
			viewMode = window.innerWidth >= 1024 ? 'split' : 'edit';
			isSidebarOpenMobile = false;
			setTimeout(() => {
				if (textareaEl) textareaEl.focus();
			}, 50);
		}
	}

	async function handleDeleteActiveNote() {
		if (!selectedNoteId || !activeNote) return;
		if (confirm(`Sei sicuro di voler eliminare "${activeNote.title}"?`)) {
			const idToDelete = selectedNoteId;
			await notesStore.deleteNote(idToDelete);
			const remaining = notes.filter((n) => n.id !== idToDelete);
			if (remaining.length > 0) {
				selectNote(remaining[0]);
			} else {
				selectedNoteId = null;
				currentTitle = '';
				currentContent = '';
			}
		}
	}

	async function handleTogglePin() {
		currentIsPinned = !currentIsPinned;
		triggerAutoSave();
	}

	// Toolbar formatting helper
	function insertFormatting(prefix: string, suffix = '', placeholder = '') {
		if (!textareaEl) return;
		const start = textareaEl.selectionStart;
		const end = textareaEl.selectionEnd;
		const selected = currentContent.substring(start, end) || placeholder;
		const replacement = prefix + selected + suffix;

		currentContent =
			currentContent.substring(0, start) + replacement + currentContent.substring(end);

		triggerAutoSave();

		setTimeout(() => {
			if (!textareaEl) return;
			textareaEl.focus();
			textareaEl.setSelectionRange(
				start + prefix.length,
				start + prefix.length + selected.length
			);
		}, 10);
	}

	// Obsidian-style checklist interactive toggle
	function toggleChecklistItem(index: number) {
		const lines = currentContent.split('\n');
		let checkCount = 0;
		for (let i = 0; i < lines.length; i++) {
			const match = lines[i].match(/^([\*\-]\s+\[)([ xX])(\]\s+.+)$/);
			if (match) {
				if (checkCount === index) {
					const isCurrentlyChecked = match[2].toLowerCase() === 'x';
					const newChar = isCurrentlyChecked ? ' ' : 'x';
					lines[i] = `${match[1]}${newChar}${match[3]}`;
					break;
				}
				checkCount++;
			}
		}
		currentContent = lines.join('\n');
		triggerAutoSave();
	}

	function copyMarkdown() {
		if (!currentContent) return;
		navigator.clipboard.writeText(`# ${currentTitle}\n\n${currentContent}`);
		toastStore.show({ message: '📋 Testo Markdown copiato!' });
	}

	function downloadFile() {
		const filename = `${currentTitle.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() || 'appunto'}.md`;
		const fullText = `# ${currentTitle}\n\n**Categoria**: ${currentCategory}\n---\n\n${currentContent}`;
		const blob = new Blob([fullText], { type: 'text/markdown;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
		toastStore.show({ message: `📥 "${filename}" scaricato!` });
	}

	function handleKeyDown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 's') {
			e.preventDefault();
			triggerAutoSave();
			toastStore.show({ message: '💾 Appunto salvato!' });
		}
	}
</script>

<div class="obsidian-workspace" onkeydown={handleKeyDown} role="presentation">
	<!-- 🗂️ 1. LEFT VAULT EXPLORER / SIDEBAR -->
	<aside
		class="vault-sidebar duo-card"
		class:mobile-hidden={!isSidebarOpenMobile && selectedNoteId !== null}
	>
		<!-- Vault Explorer Header -->
		<div class="vault-header">
			<div class="vault-title-group">
				<span class="vault-icon">📓</span>
				<span class="vault-name">VAULT APPUNTI</span>
				<span class="vault-badge">{notes.length}</span>
			</div>

			<button
				type="button"
				class="duo-btn duo-btn-green new-note-btn"
				onclick={handleCreateNewNote}
				title="Crea nuova nota"
			>
				➕ Nuova
			</button>
		</div>

		<!-- Vault Search Bar -->
		<div class="vault-search-box">
			<span class="search-ico">🔍</span>
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Cerca nel vault..."
				class="vault-search-input"
			/>
			{#if searchQuery}
				<button type="button" class="clear-btn" onclick={() => (searchQuery = '')}>✕</button>
			{/if}
		</div>

		<!-- Categories / Folders Chips -->
		<div class="vault-folders-bar">
			<button
				type="button"
				class="folder-chip"
				class:active={selectedCategory === 'ALL'}
				onclick={() => (selectedCategory = 'ALL')}
			>
				📁 Tutti ({notes.length})
			</button>
			{#each availableCategories as [catName, count]}
				<button
					type="button"
					class="folder-chip"
					class:active={selectedCategory === catName}
					onclick={() => (selectedCategory = catName)}
				>
					📁 {catName} ({count})
				</button>
			{/each}
		</div>

		<!-- Notes List Explorer -->
		<div class="vault-files-list">
			{#if filteredNotes.length === 0}
				<div class="vault-empty-state">
					<p>Nessun appunto trovato nel Vault.</p>
					<button type="button" class="create-first-link" onclick={handleCreateNewNote}>
						+ Crea una nuova nota
					</button>
				</div>
			{:else}
				{#each filteredNotes as note (note.id)}
					{@const isSelected = selectedNoteId === note.id}
					<div
						class="vault-file-item"
						class:active={isSelected}
						onclick={() => selectNote(note)}
						role="button"
						tabindex="0"
						onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectNote(note)}
					>
						<div class="file-item-header">
							<span class="file-title">
								{#if note.isPinned}
									<span class="pin-ico" title="Fissato in evidenza">📌</span>
								{/if}
								{note.title || 'Senza titolo'}
							</span>
							<span class="file-cat">{note.category}</span>
						</div>

						<p class="file-snippet">
							{note.content.replace(/[#*`_~>[\]()|\\-]/g, ' ').slice(0, 75)}
						</p>

						<div class="file-item-meta">
							<span class="file-date">
								{new Date(note.updatedAt || note.createdAt).toLocaleDateString('it-IT', {
									day: 'numeric',
									month: 'short'
								})}
							</span>
							<span class="file-words">{getMarkdownStats(note.content).wordCount} parole</span>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</aside>

	<!-- 📝 2. CENTER MAIN WORKSPACE (NOTE CANVAS & EDITOR) -->
	<main
		class="note-workspace-pane duo-card"
		class:mobile-hidden={isSidebarOpenMobile && selectedNoteId !== null}
	>
		{#if selectedNoteId && activeNote}
			<!-- Workspace Top Header Bar -->
			<div class="workspace-header">
				<!-- Mobile Back to Vault button -->
				<button
					type="button"
					class="mobile-back-btn"
					onclick={() => (isSidebarOpenMobile = true)}
					title="Torna all'elenco appunti"
				>
					← Vault
				</button>

				<!-- Breadcrumb & Category selector -->
				<div class="workspace-breadcrumb">
					<span class="folder-ico">📁</span>
					<select
						bind:value={currentCategory}
						onchange={triggerAutoSave}
						class="breadcrumb-category-select"
					>
						{#each DEFAULT_NOTE_CATEGORIES as cat}
							<option value={cat}>{cat}</option>
						{/each}
					</select>
				</div>

				<!-- Save Status Pill -->
				<div class="save-status-pill">
					{#if isAutoSaving}
						<span class="saving-txt">⏳ Salvataggio...</span>
					{:else}
						<span class="saved-txt">💾 {lastSavedTime ? `Salvato ${lastSavedTime}` : 'Salvato'}</span>
					{/if}
				</div>

				<!-- Mode View Switcher: Edit / Read / Split -->
				<div class="view-mode-tabs">
					<button
						type="button"
						class="mode-tab"
						class:active={viewMode === 'edit'}
						onclick={() => (viewMode = 'edit')}
						title="Modalità Modifica"
					>
						✏️ Scrivi
					</button>
					<button
						type="button"
						class="mode-tab"
						class:active={viewMode === 'preview'}
						onclick={() => (viewMode = 'preview')}
						title="Modalità Lettura"
					>
						👁️ Lettura
					</button>
					<button
						type="button"
						class="mode-tab desktop-only"
						class:active={viewMode === 'split'}
						onclick={() => (viewMode = 'split')}
						title="Affiancato Live"
					>
						📑 Split
					</button>
				</div>

				<!-- Header Quick Actions -->
				<div class="workspace-quick-actions">
					<button
						type="button"
						class="action-icon-btn"
						class:pinned={currentIsPinned}
						onclick={handleTogglePin}
						title={currentIsPinned ? 'Rimuovi pin' : 'Fissa in alto'}
					>
						📌
					</button>

					<button
						type="button"
						class="action-icon-btn"
						onclick={() => (isOutlineOpen = !isOutlineOpen)}
						title="Indice contenuti (TOC)"
					>
						📑
					</button>

					<button
						type="button"
						class="action-icon-btn"
						onclick={copyMarkdown}
						title="Copia Markdown"
					>
						📋
					</button>

					<button
						type="button"
						class="action-icon-btn"
						onclick={downloadFile}
						title="Esporta file .md"
					>
						📥
					</button>

					<button
						type="button"
						class="action-icon-btn delete-btn"
						onclick={handleDeleteActiveNote}
						title="Elimina nota"
					>
						🗑️
					</button>
				</div>
			</div>

			<!-- Obsidian Formatting Ribbon Bar (quando in edit o split) -->
			{#if viewMode === 'edit' || viewMode === 'split'}
				<div class="obsidian-ribbon-bar">
					<button
						type="button"
						class="ribbon-btn"
						onclick={() => insertFormatting('**', '**', 'grassetto')}
						title="Grassetto (Ctrl+B)"
					>
						<strong>B</strong>
					</button>
					<button
						type="button"
						class="ribbon-btn"
						onclick={() => insertFormatting('*', '*', 'corsivo')}
						title="Corsivo (Ctrl+I)"
					>
						<em>I</em>
					</button>
					<button
						type="button"
						class="ribbon-btn"
						onclick={() => insertFormatting('### ', '', 'Intestazione')}
						title="Titolo H3"
					>
						<strong>H</strong>
					</button>
					<span class="ribbon-sep"></span>
					<button
						type="button"
						class="ribbon-btn"
						onclick={() => insertFormatting('- ', '', 'Punto')}
						title="Elenco puntato"
					>
						• Lista
					</button>
					<button
						type="button"
						class="ribbon-btn"
						onclick={() => insertFormatting('1. ', '', 'Passo')}
						title="Elenco numerato"
					>
						1. Num
					</button>
					<button
						type="button"
						class="ribbon-btn"
						onclick={() => insertFormatting('- [ ] ', '', 'Checklist')}
						title="Checklist interattiva"
					>
						☑️ Check
					</button>
					<span class="ribbon-sep"></span>
					<button
						type="button"
						class="ribbon-btn"
						onclick={() => insertFormatting('> [!TIP]\n> ', '', 'Suggerimento')}
						title="Callout Tip"
					>
						💡 Tip
					</button>
					<button
						type="button"
						class="ribbon-btn"
						onclick={() => insertFormatting('> [!WARNING]\n> ', '', 'Avviso')}
						title="Callout Warning"
					>
						⚠️ Warning
					</button>
					<button
						type="button"
						class="ribbon-btn"
						onclick={() => insertFormatting('```\n', '\n```', 'codice/schema')}
						title="Blocco di codice"
					>
						💻 Codice
					</button>
				</div>
			{/if}

			<!-- Seamless Note Title Input -->
			<div class="note-document-title-box">
				<input
					type="text"
					bind:value={currentTitle}
					oninput={triggerAutoSave}
					placeholder="Titolo dell'appunto..."
					class="obsidian-title-input"
				/>
			</div>

			<!-- Document Content Area (Edit / Preview / Split) -->
			<div class="document-canvas-container" class:split-active={viewMode === 'split'}>
				<!-- Editor Pane -->
				{#if viewMode === 'edit' || viewMode === 'split'}
					<div class="canvas-pane editor-pane">
						<textarea
							bind:this={textareaEl}
							bind:value={currentContent}
							oninput={triggerAutoSave}
							placeholder="Inizia a scrivere i tuoi appunti in Markdown...
Usa **grassetto**, liste puntate o checklist `- [ ]` per schematizzare le normative."
							class="obsidian-editor-textarea"
						></textarea>
					</div>
				{/if}

				<!-- Reading / Rendered Pane -->
				{#if viewMode === 'preview' || viewMode === 'split'}
					<div class="canvas-pane reading-pane markdown-rendered-box">
						{#if currentContent.trim()}
							{@html renderedMarkdown}
						{:else}
							<div class="empty-doc-placeholder">
								<p>Nessun contenuto. Digita nell'editor per vedere l'anteprima formattata!</p>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Workspace Footer Status Info -->
			<div class="workspace-footer">
				<div class="doc-stats-left">
					<span>📝 {docStats.wordCount} parole</span>
					<span>•</span>
					<span>⏱️ ~{docStats.readingTimeMinutes} min lettura</span>
					<span>•</span>
					<span>🔤 {docStats.charCount} caratteri</span>
				</div>
				<div class="doc-stats-right">
					<span>Ctrl+S per salvare</span>
				</div>
			</div>
		{:else}
			<!-- Empty State when no note is open -->
			<div class="workspace-empty-canvas">
				<img src="/emoji/owl_3d.png" alt="" class="empty-owl" />
				<h2>Seleziona una nota dal Vault o creane una nuova</h2>
				<p>Il tuo spazio di studio per memorizzare concetti e normative ferroviarie.</p>
				<button type="button" class="duo-btn duo-btn-green" onclick={handleCreateNewNote}>
					➕ CREA NUOVA NOTA
				</button>
			</div>
		{/if}
	</main>

	<!-- 📑 3. RIGHT PANEL (OUTLINE / TOC & METADATA) -->
	{#if isOutlineOpen && selectedNoteId}
		<aside class="vault-outline-panel duo-card" transition:fade={{ duration: 150 }}>
			<div class="outline-header">
				<span class="outline-title">📑 INDICE (TOC)</span>
				<button type="button" class="close-outline-btn" onclick={() => (isOutlineOpen = false)}>
					✕
				</button>
			</div>

			<div class="outline-list">
				{#if headingsOutline.length === 0}
					<p class="empty-outline-msg">Nessuna intestazione (# Titolo) trovata nella nota.</p>
				{:else}
					{#each headingsOutline as h}
						<div class="outline-item outline-level-{h.level}">
							<span class="outline-marker">H{h.level}</span>
							<span class="outline-text">{h.text}</span>
						</div>
					{/each}
				{/if}
			</div>

			<div class="outline-meta-box">
				<span class="meta-lbl">METADATI NOTA</span>
				<div class="meta-row">
					<span>Categoria:</span>
					<strong>{currentCategory}</strong>
				</div>
				<div class="meta-row">
					<span>Stato:</span>
					<strong>{currentIsPinned ? '📌 In evidenza' : 'Ordinario'}</strong>
				</div>
			</div>
		</aside>
	{/if}
</div>

<style>
	/* 📐 Main Obsidian Workspace Grid */
	.obsidian-workspace {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.85rem;
		height: calc(100vh - 120px);
		min-height: 600px;
		max-height: 900px;
		width: 100%;
		max-width: 1300px;
		margin: 0 auto;
		box-sizing: border-box;
	}

	@media (min-width: 1024px) {
		.obsidian-workspace {
			grid-template-columns: 320px 1fr;
		}
	}

	/* 🗂️ Vault Left Sidebar */
	.vault-sidebar {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 1rem;
		background: var(--card-bg);
		border-radius: 18px;
		overflow: hidden;
		height: 100%;
		box-sizing: border-box;
	}

	.vault-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.5rem;
		border-bottom: 2px solid var(--border-color);
		flex-shrink: 0;
	}

	.vault-title-group {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.vault-icon {
		font-size: 1.15rem;
	}

	.vault-name {
		font-family: 'Outfit', sans-serif;
		font-size: 0.88rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		color: var(--text-color);
	}

	.vault-badge {
		background: var(--badge-bg);
		border: 1px solid var(--border-color);
		border-radius: 9999px;
		padding: 0.1rem 0.45rem;
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--accent-color);
	}

	.new-note-btn {
		font-size: 0.75rem;
		padding: 0.4rem 0.75rem;
		border-radius: 10px;
	}

	.vault-search-box {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 10px;
		padding: 0.4rem 0.65rem;
		flex-shrink: 0;
	}

	.search-ico {
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.vault-search-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-color);
		font-size: 0.82rem;
		font-weight: 700;
	}

	.clear-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		font-size: 0.85rem;
		cursor: pointer;
	}

	.vault-folders-bar {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		overflow-x: auto;
		padding-bottom: 0.2rem;
		flex-shrink: 0;
		scrollbar-width: none;
	}

	.vault-folders-bar::-webkit-scrollbar {
		display: none;
	}

	.folder-chip {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 8px;
		padding: 0.25rem 0.55rem;
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--text-muted);
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s ease;
	}

	.folder-chip.active {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.vault-files-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding-right: 0.2rem;
	}

	.vault-file-item {
		background: var(--card-bg-subtle);
		border: 1.5px solid transparent;
		border-left: 3px solid transparent;
		border-radius: 10px;
		padding: 0.6rem 0.75rem;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		text-align: left;
		transition: all 0.15s ease;
	}

	.vault-file-item:hover {
		background: var(--hover-bg);
	}

	.vault-file-item.active {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		border-left: 4px solid var(--accent-color);
	}

	.file-item-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.35rem;
	}

	.file-title {
		font-family: 'Outfit', sans-serif;
		font-size: 0.88rem;
		font-weight: 800;
		color: var(--text-color);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.file-cat {
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		color: var(--accent-color);
		background: var(--card-bg);
		border-radius: 4px;
		padding: 0.1rem 0.35rem;
		white-space: nowrap;
	}

	.file-snippet {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.35;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.file-item-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.68rem;
		font-weight: 700;
		color: var(--text-muted);
	}

	.vault-empty-state {
		padding: 2rem 1rem;
		text-align: center;
		color: var(--text-muted);
		font-size: 0.82rem;
	}

	.create-first-link {
		background: none;
		border: none;
		color: var(--accent-color);
		font-weight: 800;
		cursor: pointer;
		margin-top: 0.5rem;
		display: inline-block;
	}

	/* 📝 Center Main Workspace */
	.note-workspace-pane {
		display: flex;
		flex-direction: column;
		background: var(--card-bg);
		border-radius: 18px;
		padding: 1rem 1.25rem;
		overflow: hidden;
		height: 100%;
		box-sizing: border-box;
		gap: 0.6rem;
	}

	.workspace-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		padding-bottom: 0.5rem;
		border-bottom: 2px solid var(--border-color);
		flex-shrink: 0;
		flex-wrap: wrap;
	}

	.mobile-back-btn {
		display: none;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 8px;
		padding: 0.3rem 0.6rem;
		font-size: 0.78rem;
		font-weight: 800;
		color: var(--accent-color);
		cursor: pointer;
	}

	@media (max-width: 1023px) {
		.mobile-back-btn {
			display: block;
		}
	}

	.workspace-breadcrumb {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.breadcrumb-category-select {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 8px;
		padding: 0.25rem 0.55rem;
		color: var(--text-color);
		font-family: inherit;
		font-size: 0.78rem;
		font-weight: 800;
		outline: none;
	}

	.save-status-pill {
		font-size: 0.72rem;
		font-weight: 700;
	}

	.saving-txt {
		color: var(--orange-color);
	}

	.saved-txt {
		color: var(--text-muted);
	}

	.view-mode-tabs {
		display: flex;
		align-items: center;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 10px;
		padding: 0.15rem;
		gap: 0.15rem;
	}

	.mode-tab {
		background: transparent;
		border: none;
		border-radius: 7px;
		padding: 0.25rem 0.55rem;
		font-size: 0.74rem;
		font-weight: 800;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.mode-tab.active {
		background: var(--accent-color);
		color: #ffffff;
	}

	@media (max-width: 1023px) {
		.desktop-only {
			display: none;
		}
	}

	.workspace-quick-actions {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.action-icon-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 8px;
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-color);
		font-size: 0.85rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.action-icon-btn:hover {
		background: var(--hover-bg);
	}

	.action-icon-btn.pinned {
		background: rgba(255, 150, 0, 0.18);
		border-color: var(--orange-color);
	}

	.delete-btn:hover {
		background: rgba(255, 75, 75, 0.18);
		border-color: #ff5e5b;
	}

	/* Ribbon formatting bar */
	.obsidian-ribbon-bar {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 10px;
		padding: 0.25rem 0.45rem;
		overflow-x: auto;
		flex-shrink: 0;
		scrollbar-width: none;
	}

	.obsidian-ribbon-bar::-webkit-scrollbar {
		display: none;
	}

	.ribbon-btn {
		background: transparent;
		border: 1px solid transparent;
		border-radius: 6px;
		padding: 0.2rem 0.45rem;
		font-size: 0.74rem;
		font-weight: 800;
		color: var(--text-color);
		cursor: pointer;
		white-space: nowrap;
	}

	.ribbon-btn:hover {
		background: var(--hover-bg);
		border-color: var(--border-color);
	}

	.ribbon-sep {
		width: 1px;
		height: 16px;
		background: var(--border-color);
		margin: 0 0.1rem;
	}

	/* Seamless Title Input */
	.note-document-title-box {
		padding: 0.25rem 0 0.15rem 0;
		flex-shrink: 0;
	}

	.obsidian-title-input {
		width: 100%;
		background: transparent;
		border: none;
		outline: none;
		font-family: 'Outfit', sans-serif;
		font-size: 1.5rem;
		font-weight: 900;
		color: var(--text-color);
		padding: 0;
		letter-spacing: -0.01em;
	}

	.obsidian-title-input:focus {
		border-bottom: 2px solid var(--accent-color);
	}

	/* Document Canvas */
	.document-canvas-container {
		flex: 1;
		min-height: 200px;
		display: flex;
		gap: 0.85rem;
		overflow: hidden;
	}

	.split-active {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}

	.canvas-pane {
		height: 100%;
		overflow-y: auto;
		box-sizing: border-box;
	}

	.editor-pane {
		display: flex;
	}

	.obsidian-editor-textarea {
		width: 100%;
		height: 100%;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 12px;
		padding: 0.85rem;
		box-sizing: border-box;
		color: var(--text-color);
		font-family: 'Outfit', 'Plus Jakarta Sans', monospace;
		font-size: 0.95rem;
		line-height: 1.6;
		resize: none;
		outline: none;
		transition: border-color 0.2s ease;
	}

	.obsidian-editor-textarea:focus {
		border-color: var(--accent-color);
	}

	.reading-pane {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 12px;
		padding: 1rem 1.15rem;
		font-size: 1rem;
		line-height: 1.7;
	}

	.empty-doc-placeholder {
		color: var(--text-muted);
		text-align: center;
		padding: 3rem 1rem;
		font-style: italic;
	}

	.workspace-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 0.35rem;
		border-top: 1.5px solid var(--border-color);
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.doc-stats-left {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.workspace-empty-canvas {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		text-align: center;
		gap: 0.75rem;
		color: var(--text-muted);
		padding: 2rem;
	}

	.empty-owl {
		width: 70px;
		height: 70px;
		object-fit: contain;
	}

	/* 📑 3. Right Outline Panel */
	.vault-outline-panel {
		position: fixed;
		top: 80px;
		right: 20px;
		width: 280px;
		max-height: 80vh;
		background: var(--card-bg);
		border-radius: 16px;
		padding: 1rem;
		z-index: 400;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.outline-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.4rem;
		border-bottom: 1.5px solid var(--border-color);
	}

	.outline-title {
		font-family: 'Outfit', sans-serif;
		font-size: 0.78rem;
		font-weight: 900;
		color: var(--accent-color);
		letter-spacing: 0.06em;
	}

	.close-outline-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		font-size: 0.9rem;
		cursor: pointer;
	}

	.outline-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		max-height: 250px;
	}

	.empty-outline-msg {
		font-size: 0.75rem;
		color: var(--text-muted);
		font-style: italic;
	}

	.outline-item {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		color: var(--text-color);
		padding: 0.2rem 0;
	}

	.outline-level-1 {
		font-weight: 800;
	}
	.outline-level-2 {
		padding-left: 0.6rem;
	}
	.outline-level-3 {
		padding-left: 1.2rem;
		font-size: 0.74rem;
	}

	.outline-marker {
		font-size: 0.65rem;
		font-weight: 900;
		color: var(--accent-color);
		background: var(--card-bg-subtle);
		padding: 0.05rem 0.3rem;
		border-radius: 4px;
	}

	.outline-meta-box {
		border-top: 1.5px dashed var(--border-color);
		padding-top: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.72rem;
	}

	.meta-lbl {
		font-weight: 900;
		color: var(--text-muted);
		font-size: 0.68rem;
		text-transform: uppercase;
	}

	.meta-row {
		display: flex;
		justify-content: space-between;
		color: var(--text-muted);
	}

	.meta-row strong {
		color: var(--text-color);
	}

	/* Responsive mobile view switching */
	@media (max-width: 1023px) {
		.mobile-hidden {
			display: none !important;
		}

		.obsidian-workspace {
			height: calc(100vh - 100px);
		}
	}
</style>
