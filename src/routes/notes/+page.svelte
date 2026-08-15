<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { notesStore } from '$lib/stores/notesStore';
	import { getMarkdownStats, extractHeadings, type HeadingItem } from '$lib/utils/markdown';
	import { DEFAULT_NOTE_CATEGORIES, type Note, type NoteSortOption } from '$lib/types/notes';
	import { toastStore } from '$lib/stores/toastStore';
	import { fade } from 'svelte/transition';
	import { compressImage } from '$lib/utils/imageCompressor';
	import {
		markdownToDocHtml,
		docHtmlToMarkdown,
		createInlineImageFigureHtml
	} from '$lib/utils/docConverter';

	import { globalCategoryStore } from '$lib/stores/globalCategoryStore';

	let { data } = $props();

	const seed = (() => {
		const list: Note[] = data.initialNotes ?? [];
		return { list };
	})();

	let notes = $state<Note[]>(seed.list);
	let selectedNoteId = $state<string | null>(null);
	let searchQuery = $state('');
	let selectedCategory = $state<string>('ALL');
	let sortOption = $state<NoteSortOption>('custom');

	// Workspace UI states
	let isOutlineOpen = $state(false);
	let isSidebarOpenMobile = $state(true);
	let isVaultCollapsed = $state(false);
	let isAutoSaving = $state(false);
	let isUploadingImage = $state(false);
	let lastSavedTime = $state<string>('');

	// Active note local editor state
	let currentTitle = $state('');
	let currentContent = $state('');
	let currentCategory = $state('Normativa RFI');
	let currentImages = $state<string[]>([]);
	let currentIsPinned = $state(false);

	let editorEl = $state<HTMLDivElement | null>(null);
	let fileInputEl = $state<HTMLInputElement | null>(null);
	let savedRange: Range | null = null;

	let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		notesStore.hydrate(data.initialNotes);

		if (typeof window !== 'undefined') {
			if (window.innerWidth >= 1024) {
				isSidebarOpenMobile = false;
			}
			const savedCollapsed = localStorage.getItem('rf_vault_collapsed');
			if (savedCollapsed === 'true') {
				isVaultCollapsed = true;
			}

			// Intercetta paste globale
			window.addEventListener('paste', handleGlobalPaste);
		}

		const unsubGlobalCat = globalCategoryStore.subscribe((cat) => {
			if (cat) {
				selectedCategory = cat;
			}
		});

		const unsub = notesStore.subscribe((n) => {
			notes = n;
			if (!selectedNoteId && n.length > 0) {
				const lastOpenedId = typeof localStorage !== 'undefined' ? localStorage.getItem('rf_last_opened_note_id') : null;
				const targetNote = (lastOpenedId && n.find((x) => x.id === lastOpenedId)) || n[0];
				selectNote(targetNote);
			}
		});

		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('paste', handleGlobalPaste);
			}
			unsub();
			unsubGlobalCat();
			if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
		};
	});

	function toggleVaultCollapse() {
		isVaultCollapsed = !isVaultCollapsed;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('rf_vault_collapsed', String(isVaultCollapsed));
		}
	}

	async function selectNote(note: Note) {
		selectedNoteId = note.id;
		currentTitle = note.title;
		currentContent = note.content || '';
		currentCategory = note.category || 'Normativa RFI';
		currentImages = note.images ? [...note.images] : [];
		currentIsPinned = Boolean(note.isPinned);
		isSidebarOpenMobile = false;

		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('rf_last_opened_note_id', note.id);
		}

		await tick();
		if (editorEl) {
			editorEl.innerHTML = markdownToDocHtml(currentContent);
		}
	}

	let activeNote = $derived(notes.find((n) => n.id === selectedNoteId) || null);

	$effect(() => {
		if (activeNote && activeNote.id !== selectedNoteId) {
			selectNote(activeNote);
		}
	});

	let availableCategories = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const n of notes) {
			const cat = n.category?.trim() || 'Generale & Varie';
			counts.set(cat, (counts.get(cat) || 0) + 1);
		}
		return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], 'it'));
	});

	let filteredNotes = $derived.by(() => {
		let list = [...notes];

		if (selectedCategory !== 'ALL') {
			list = list.filter((n) => (n.category?.trim() || 'Generale & Varie') === selectedCategory);
		}

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
				return (
					new Date(b.updatedAt || b.createdAt).getTime() -
					new Date(a.updatedAt || a.createdAt).getTime()
				);
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

	let docStats = $derived(getMarkdownStats(currentContent));
	let headingsOutline = $derived<HeadingItem[]>(extractHeadings(currentContent));

	function syncContentFromEditor() {
		if (!editorEl) return;
		currentContent = docHtmlToMarkdown(editorEl);

		// Estrai tutte le immagini presenti nel documento
		const imgEls = editorEl.querySelectorAll('figure.doc-inline-image, img.doc-img-element');
		const foundUrls: string[] = [];
		imgEls.forEach((el) => {
			const u = el.getAttribute('data-url') || el.getAttribute('src');
			if (u && !foundUrls.includes(u)) foundUrls.push(u);
		});
		currentImages = foundUrls;
	}

	function triggerAutoSave() {
		if (!selectedNoteId) return;
		isAutoSaving = true;

		if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
		saveDebounceTimer = setTimeout(async () => {
			if (!selectedNoteId) return;
			syncContentFromEditor();
			await notesStore.updateNote({
				id: selectedNoteId,
				title: currentTitle.trim() || 'Appunto senza titolo',
				content: currentContent,
				category: currentCategory,
				images: currentImages,
				isPinned: currentIsPinned
			});
			isAutoSaving = false;
			const now = new Date();
			lastSavedTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
		}, 500);
	}

	function handleEditorInput() {
		syncContentFromEditor();
		triggerAutoSave();
	}

	async function handleCreateNewNote() {
		const newNote = await notesStore.createNote({
			title: 'Nuovo Appunto',
			content: '',
			category: selectedCategory !== 'ALL' ? selectedCategory : 'Normativa RFI',
			images: [],
			isPinned: false
		});

		if (newNote) {
			selectNote(newNote);
			isSidebarOpenMobile = false;
			await tick();
			if (editorEl) {
				editorEl.focus();
			}
		}
	}

	async function handleDeleteActiveNote() {
		if (!selectedNoteId || !activeNote) return;
		if (confirm(`Sei sicuro di voler eliminare "${activeNote.title}" e le sue immagini allegate?`)) {
			const idToDelete = selectedNoteId;
			await notesStore.deleteNote(idToDelete);
			const remaining = notes.filter((n) => n.id !== idToDelete);
			if (remaining.length > 0) {
				selectNote(remaining[0]);
			} else {
				selectedNoteId = null;
				currentTitle = '';
				currentContent = '';
				currentImages = [];
				if (editorEl) editorEl.innerHTML = '';
			}
		}
	}

	async function handleTogglePin() {
		currentIsPinned = !currentIsPinned;
		triggerAutoSave();
	}

	function saveCurrentSelection() {
		const sel = window.getSelection();
		if (sel && sel.rangeCount > 0) {
			savedRange = sel.getRangeAt(0).cloneRange();
		}
	}

	function applyFormat(command: string, value: string | undefined = undefined) {
		if (!editorEl) return;
		editorEl.focus();
		document.execCommand(command, false, value);
		handleEditorInput();
	}

	function applyBlockFormat(tag: string) {
		if (!editorEl) return;
		editorEl.focus();
		document.execCommand('formatBlock', false, `<${tag}>`);
		handleEditorInput();
	}

	// Funzione unificata per caricare e inserire immagini visivamente nel flusso del testo (Word-style)
	async function uploadAndInsertImage(rawFile: File | Blob) {
		if (!selectedNoteId) {
			toastStore.show({ message: '⚠️ Seleziona prima un appunto in cui incollare l\'immagine.' });
			return;
		}

		if (isUploadingImage) return;
		isUploadingImage = true;
		toastStore.show({ message: '⏳ Compressione e inserimento immagine nel testo...' });

		try {
			// Comprimi e converti in WebP ottimizzato (massimo 1MB)
			const compressedFile = await compressImage(rawFile, {
				maxSizeMB: 1,
				maxWidth: 1920,
				maxHeight: 1920,
				quality: 0.82
			});

			const formData = new FormData();
			formData.append('file', compressedFile, 'pasted-image.webp');

			const res = await fetch('/api/notes/upload', {
				method: 'POST',
				body: formData
			});

			if (!res.ok) {
				const err = await res.json();
				toastStore.show({ message: `⚠️ ${err.error || 'Errore caricamento immagine'}` });
				return;
			}

			const data = await res.json();
			const imageUrl = data.url;

			// Inserisci il blocco immagine direttamente nel documento visuale (Word-style)
			insertImageBlockAtCursor(imageUrl, '400');
			toastStore.show({ message: '🖼️ Immagine inserita nel testo!' });
		} catch (err) {
			console.error('Errore compressione/upload immagine:', err);
			toastStore.show({ message: '⚠️ Impossibile caricare l\'immagine' });
		} finally {
			isUploadingImage = false;
		}
	}

	function insertImageBlockAtCursor(imageUrl: string, defaultWidth = '400') {
		if (!editorEl) return;
		editorEl.focus();

		const figureHtml = createInlineImageFigureHtml(imageUrl, defaultWidth);
		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = figureHtml;
		const figureNode = tempDiv.firstElementChild as HTMLElement;

		const trailingParagraph = document.createElement('p');
		trailingParagraph.innerHTML = '<br>';

		const sel = window.getSelection();
		let inserted = false;

		if (sel && sel.rangeCount > 0) {
			let range = sel.getRangeAt(0);
			// Verifica che la selezione sia dentro l'editor
			if (editorEl.contains(range.commonAncestorContainer)) {
				range.deleteContents();
				range.insertNode(trailingParagraph);
				range.insertNode(figureNode);

				// Sposta il cursore nel paragrafo successivo per continuare a scrivere
				const newRange = document.createRange();
				newRange.setStart(trailingParagraph, 0);
				newRange.collapse(true);
				sel.removeAllRanges();
				sel.addRange(newRange);
				inserted = true;
			}
		}

		if (!inserted) {
			editorEl.appendChild(figureNode);
			editorEl.appendChild(trailingParagraph);
		}

		handleEditorInput();
	}

	// Gestione dei click sui controlli di ridimensionamento / cancellazione dell'immagine inline
	function handleEditorClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target) return;

		// 1. Click pulsante ridimensionamento
		if (target.classList.contains('img-btn-size')) {
			e.preventDefault();
			e.stopPropagation();
			const newSize = target.getAttribute('data-size') || '400';
			const figure = target.closest('figure.doc-inline-image') as HTMLElement;
			if (figure) {
				const wrapper = figure.querySelector('.doc-image-wrapper') as HTMLElement;
				const rawW = newSize.replace(/px/g, '').trim();
				const cssW = rawW.includes('%') ? rawW : `${rawW}px`;

				figure.setAttribute('data-width', rawW);
				if (wrapper) wrapper.style.maxWidth = cssW;

				// Aggiorna classe active sui pulsanti del gruppo
				figure.querySelectorAll('.img-btn-size').forEach((btn) => {
					if (btn.getAttribute('data-size') === newSize) {
						btn.classList.add('active');
					} else {
						btn.classList.remove('active');
					}
				});

				handleEditorInput();
				toastStore.show({ message: `📏 Dimensione immagine: ${newSize}` });
			}
			return;
		}

		// 2. Click pulsante eliminazione immagine
		if (target.classList.contains('img-btn-del')) {
			e.preventDefault();
			e.stopPropagation();
			const figure = target.closest('figure.doc-inline-image');
			if (figure) {
				figure.remove();
				handleEditorInput();
				toastStore.show({ message: '🗑️ Immagine rimossa dal testo' });
			}
			return;
		}
	}

	// Gestione globale dell'evento Incolla (Ctrl+V)
	function handleGlobalPaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items || isUploadingImage) return;

		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item.type.startsWith('image/')) {
				e.preventDefault();
				e.stopPropagation();
				saveCurrentSelection();
				const file = item.getAsFile();
				if (file && file.size > 0) {
					uploadAndInsertImage(file);
				}
				break;
			}
		}
	}

	// Gestione evento Drag & Drop
	function handleDrop(e: DragEvent) {
		const files = e.dataTransfer?.files;
		if (!files || files.length === 0) return;

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			if (file.type.startsWith('image/')) {
				e.preventDefault();
				saveCurrentSelection();
				uploadAndInsertImage(file);
				break;
			}
		}
	}

	function handleFileInputChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			uploadAndInsertImage(target.files[0]);
			target.value = '';
		}
	}

	function copyMarkdown() {
		syncContentFromEditor();
		if (!currentContent) return;
		navigator.clipboard.writeText(`# ${currentTitle}\n\n${currentContent}`);
		toastStore.show({ message: '📋 Testo copiato negli appunti!' });
	}

	function downloadFile() {
		syncContentFromEditor();
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

<div
	class="obsidian-workspace"
	class:vault-collapsed={isVaultCollapsed}
	onkeydown={handleKeyDown}
	role="presentation"
>
	<!-- 🗂️ 1. LEFT VAULT EXPLORER -->
	{#if !isVaultCollapsed}
		<aside
			class="vault-sidebar duo-card"
			class:mobile-hidden={!isSidebarOpenMobile && selectedNoteId !== null}
			transition:fade={{ duration: 120 }}
		>
			<!-- Vault Explorer Header -->
			<div class="vault-header">
				<div class="vault-title-group">
					<span class="vault-icon">📓</span>
					<span class="vault-name">VAULT APPUNTI</span>
					<span class="vault-badge">{notes.length}</span>
				</div>

				<div class="vault-header-actions">
					<button
						type="button"
						class="duo-btn duo-btn-green new-note-btn"
						onclick={handleCreateNewNote}
						title="Crea nuova nota"
					>
						➕ Nuova
					</button>

					<button
						type="button"
						class="collapse-vault-btn"
						onclick={toggleVaultCollapse}
						title="Comprimi Vault"
					>
						◀
					</button>
				</div>
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

			<!-- Folders Chips -->
			<div class="vault-folders-bar">
				<button
					type="button"
					class="folder-chip"
					class:active={selectedCategory === 'ALL'}
					onclick={() => {
						selectedCategory = 'ALL';
						globalCategoryStore.setCategory('ALL');
					}}
				>
					📁 Tutti ({notes.length})
				</button>
				{#each availableCategories as [catName, count]}
					<button
						type="button"
						class="folder-chip"
						class:active={selectedCategory === catName}
						onclick={() => {
							selectedCategory = catName;
							globalCategoryStore.setCategory(catName);
						}}
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
	{/if}

	<!-- 📝 2. CENTER MAIN WORKSPACE (EDITOR VISUALE WORD-STYLE CON IMMAGINI INTEGRATE NEL TESTO) -->
	<main
		class="note-workspace-pane duo-card"
		class:mobile-hidden={isSidebarOpenMobile && selectedNoteId !== null}
	>
		{#if selectedNoteId && activeNote}
			<!-- Workspace Top Header Bar -->
			<div class="workspace-header">
				<div class="workspace-header-left">
					{#if isVaultCollapsed}
						<button
							type="button"
							class="expand-vault-btn"
							onclick={toggleVaultCollapse}
							title="Espandi Vault"
						>
							▶ Vault ({notes.length})
						</button>
					{/if}

					<button
						type="button"
						class="mobile-back-btn"
						onclick={() => (isSidebarOpenMobile = true)}
						title="Torna all'elenco appunti"
					>
						← Vault
					</button>

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
				</div>

				<div class="save-status-pill">
					{#if isAutoSaving}
						<span class="saving-txt">⏳ Salvataggio...</span>
					{:else}
						<span class="saved-txt">💾 {lastSavedTime ? `Salvato ${lastSavedTime}` : 'Salvato'}</span>
					{/if}
				</div>

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

			<!-- Word/Notion Formatting Toolbar -->
			<div class="obsidian-ribbon-bar">
				<button
					type="button"
					class="ribbon-btn"
					onclick={() => applyFormat('bold')}
					title="Grassetto (Ctrl+B)"
				>
					<strong>B</strong>
				</button>
				<button
					type="button"
					class="ribbon-btn"
					onclick={() => applyFormat('italic')}
					title="Corsivo (Ctrl+I)"
				>
					<em>I</em>
				</button>
				<button
					type="button"
					class="ribbon-btn"
					onclick={() => applyBlockFormat('h1')}
					title="Titolo Principale (H1)"
				>
					<strong>H1</strong>
				</button>
				<button
					type="button"
					class="ribbon-btn"
					onclick={() => applyBlockFormat('h2')}
					title="Titolo Sezione (H2)"
				>
					<strong>H2</strong>
				</button>
				<button
					type="button"
					class="ribbon-btn"
					onclick={() => applyBlockFormat('h3')}
					title="Sotto-titolo (H3)"
				>
					<strong>H3</strong>
				</button>
				<span class="ribbon-sep"></span>
				<button
					type="button"
					class="ribbon-btn"
					onclick={() => applyFormat('insertUnorderedList')}
					title="Elenco puntato"
				>
					• Lista
				</button>
				<button
					type="button"
					class="ribbon-btn"
					onclick={() => applyFormat('insertOrderedList')}
					title="Elenco numerato"
				>
					1. Num
				</button>
				<button
					type="button"
					class="ribbon-btn"
					onclick={() => applyBlockFormat('blockquote')}
					title="Citazione / Box Evidenza"
				>
					💡 Box
				</button>
				<span class="ribbon-sep"></span>
				<button
					type="button"
					class="ribbon-btn image-ribbon-btn"
					onclick={() => fileInputEl?.click()}
					disabled={isUploadingImage}
					title="Incolla (Ctrl+V) o allega immagine (PNG, JPG, WebP - max 1MB)"
				>
					{isUploadingImage ? '⏳ Caricamento...' : '🖼️ Inserisci Immagine'}
				</button>
				<input
					bind:this={fileInputEl}
					type="file"
					accept="image/png,image/jpeg,image/webp"
					onchange={handleFileInputChange}
					style="display: none;"
				/>
			</div>

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

			<!-- Word-style Live Document Canvas with Inline Images -->
			<div
				class="document-canvas-container"
				ondrop={handleDrop}
				ondragover={(e) => e.preventDefault()}
				role="region"
				aria-label="Area di scrittura stile Word"
			>
				<div
					bind:this={editorEl}
					contenteditable="true"
					class="word-document-editor"
					oninput={handleEditorInput}
					onclick={handleEditorClick}
					onkeyup={saveCurrentSelection}
					onmouseup={saveCurrentSelection}
					role="textbox"
					aria-multiline="true"
					tabindex="0"
				></div>
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
					<span>Incolla con <strong>Ctrl+V</strong> per inserire immagini nel testo</span>
				</div>
			</div>
		{:else}
			<!-- Empty State when no note is open -->
			<div class="workspace-empty-canvas">
				{#if isVaultCollapsed}
					<button
						type="button"
						class="expand-vault-btn"
						onclick={toggleVaultCollapse}
						style="margin-bottom: 1rem;"
					>
						▶ Mostra Vault Appunti
					</button>
				{/if}
				<img src="/emoji/owl_3d.png" alt="" class="empty-owl" />
				<h2>Seleziona una nota dal Vault o creane una nuova</h2>
				<p>Spazio di scrittura per memorizzare concetti e normative ferroviarie.</p>
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
		min-height: 560px;
		max-height: 880px;
		width: 100%;
		max-width: 1300px;
		margin: 0 auto;
		box-sizing: border-box;
		transition: all 0.2s ease;
	}

	@media (min-width: 1024px) {
		.obsidian-workspace {
			grid-template-columns: 300px 1fr;
		}

		.obsidian-workspace.vault-collapsed {
			grid-template-columns: 1fr;
		}
	}

	/* 🗂️ Vault Left Sidebar */
	.vault-sidebar {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
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
		padding-bottom: 0.45rem;
		border-bottom: 2px solid var(--border-color);
		flex-shrink: 0;
	}

	.vault-title-group {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.vault-icon {
		font-size: 1.1rem;
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

	.vault-header-actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.new-note-btn {
		font-size: 0.75rem;
		padding: 0.35rem 0.7rem;
		border-radius: 10px;
	}

	.collapse-vault-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 8px;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 900;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.collapse-vault-btn:hover {
		color: var(--text-color);
		border-color: var(--accent-color);
		background: var(--hover-bg);
	}

	.expand-vault-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 8px;
		padding: 0.3rem 0.65rem;
		font-size: 0.78rem;
		font-weight: 800;
		color: var(--accent-color);
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		transition: all 0.15s ease;
	}

	.expand-vault-btn:hover {
		background: var(--hover-bg);
		border-color: var(--accent-color);
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
		gap: 0.35rem;
		padding-right: 0.2rem;
	}

	.vault-file-item {
		background: var(--card-bg-subtle);
		border: 1.5px solid transparent;
		border-left: 3px solid transparent;
		border-radius: 10px;
		padding: 0.55rem 0.7rem;
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
		gap: 0.55rem;
	}

	.workspace-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		padding-bottom: 0.45rem;
		border-bottom: 2px solid var(--border-color);
		flex-shrink: 0;
		flex-wrap: wrap;
	}

	.workspace-header-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
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

	.image-ribbon-btn {
		color: var(--accent-color);
		font-weight: 800;
	}

	.image-ribbon-btn:disabled {
		opacity: 0.6;
		cursor: wait;
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

	/* 📄 Word-Style Document Canvas */
	.document-canvas-container {
		flex: 1;
		min-height: 200px;
		display: flex;
		overflow-y: auto;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 12px;
		padding: 1.25rem;
		box-sizing: border-box;
	}

	.word-document-editor {
		width: 100%;
		min-height: 100%;
		outline: none;
		color: var(--text-color);
		font-family: 'Outfit', 'Plus Jakarta Sans', sans-serif;
		font-size: 1rem;
		line-height: 1.7;
		word-break: break-word;
	}

	.word-document-editor :global(p) {
		margin: 0.4rem 0;
		min-height: 1.4em;
	}

	.word-document-editor :global(h1) {
		font-size: 1.55rem;
		font-weight: 900;
		color: var(--accent-color);
		margin: 1.1rem 0 0.4rem 0;
	}

	.word-document-editor :global(h2) {
		font-size: 1.35rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0.9rem 0 0.35rem 0;
	}

	.word-document-editor :global(h3) {
		font-size: 1.15rem;
		font-weight: 800;
		color: var(--text-color);
		margin: 0.75rem 0 0.3rem 0;
	}

	.word-document-editor :global(ul),
	.word-document-editor :global(ol) {
		margin: 0.4rem 0;
		padding-left: 1.5rem;
	}

	.word-document-editor :global(li) {
		margin: 0.2rem 0;
	}

	.word-document-editor :global(blockquote) {
		margin: 0.6rem 0;
		padding: 0.6rem 1rem;
		border-left: 4px solid var(--accent-color);
		background: var(--accent-light-bg);
		border-radius: 0 10px 10px 0;
		font-style: italic;
	}

	.word-document-editor :global(code) {
		background: var(--card-bg);
		padding: 0.15rem 0.35rem;
		border-radius: 4px;
		font-family: monospace;
		font-size: 0.9em;
	}

	.word-document-editor :global(mark) {
		background: rgba(255, 230, 0, 0.3);
		padding: 0 0.2rem;
		border-radius: 3px;
	}

	/* 🖼️ INLINE IMAGE FIGURE IN MEZZO AL TESTO (Word-Style) */
	.word-document-editor :global(figure.doc-inline-image) {
		margin: 0.85rem auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		user-select: none;
	}

	.word-document-editor :global(.doc-image-wrapper) {
		position: relative;
		display: inline-block;
		width: 100%;
		border-radius: 12px;
		overflow: hidden;
		border: 2px solid var(--border-color);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
		background: #000;
		transition: all 0.2s ease;
	}

	.word-document-editor :global(.doc-img-element) {
		display: block;
		width: 100%;
		height: auto;
		object-fit: contain;
	}

	.word-document-editor :global(.doc-image-toolbar) {
		position: absolute;
		bottom: 8px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(20, 20, 25, 0.88);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 8px;
		padding: 0.25rem 0.45rem;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
		z-index: 10;
		opacity: 0.92;
		transition: opacity 0.15s ease;
	}

	.word-document-editor :global(.doc-image-wrapper:hover .doc-image-toolbar) {
		opacity: 1;
	}

	.word-document-editor :global(.img-btn-size) {
		background: transparent;
		border: 1px solid transparent;
		border-radius: 4px;
		padding: 0.15rem 0.35rem;
		font-size: 0.65rem;
		font-weight: 800;
		color: #e5e7eb;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.word-document-editor :global(.img-btn-size:hover) {
		background: rgba(255, 255, 255, 0.15);
		color: #fff;
	}

	.word-document-editor :global(.img-btn-size.active) {
		background: var(--accent-color);
		color: #fff;
		border-color: var(--accent-color);
	}

	.word-document-editor :global(.img-btn-view) {
		font-size: 0.75rem;
		text-decoration: none;
		color: #e5e7eb;
		padding: 0 0.2rem;
	}

	.word-document-editor :global(.img-btn-del) {
		background: transparent;
		border: none;
		color: #ff5e5b;
		font-size: 0.8rem;
		font-weight: 900;
		cursor: pointer;
		padding: 0 0.2rem;
	}

	.word-document-editor :global(.img-btn-del:hover) {
		transform: scale(1.25);
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
