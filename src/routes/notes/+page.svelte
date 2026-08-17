<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { notesStore } from '$lib/stores/notesStore';
	import { parseMarkdown, getMarkdownStats, extractHeadings, type HeadingItem } from '$lib/utils/markdown';
	import type { Note, NoteSortOption } from '$lib/types/notes';
	import { toastStore } from '$lib/stores/toastStore';
	import { confirmModalStore } from '$lib/stores/confirmModalStore';
	import { fade } from 'svelte/transition';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { navStore } from '$lib/stores/navStore';
	import { notesNavStore } from '$lib/stores/notesNavStore';
	import { uploadImage } from '$lib/utils/imageUploader';
	import { loginWithDiscord } from '$lib/auth-client';

	let { data } = $props();
	let user = $derived(data.user);

	const seed = (() => {
		const list: Note[] = data.initialNotes ?? [];
		return { list };
	})();

	let notes = $state<Note[]>(seed.list);
	let selectedNoteId = $state<string | null>(null);
	let searchQuery = $state('');
	let sortOption = $state<NoteSortOption>('custom');
	let selectedTagFilter = $state<string | null>(null);

	// Trash state
	let isViewingTrash = $state(false);
	let trashNotes = $state<Note[]>([]);
	let selectedTrashNote = $state<Note | null>(null);

	async function loadTrash() {
		trashNotes = await notesStore.fetchTrash();
	}

	// Workspace UI states
	let isOutlineOpen = $state(false);
	let isSidebarOpenMobile = $state(true);
	let isVaultCollapsed = $state(false);
	let isAutoSaving = $state(false);
	let isUploadingImage = $state(false);
	let lastSavedTime = $state<string>('');

	// View mode: 'write' (solo editor), 'preview' (solo anteprima), 'split' (affiancato su desktop)
	let viewMode = $state<'write' | 'preview' | 'split'>('write');

	// Active note local editor state (Pure Markdown source of truth)
	let currentTitle = $state('');
	let currentContent = $state('');
	let currentTags = $state<string[]>([]);
	let currentIsPinned = $state(false);

	let newTagInput = $state('');
	let isAddingTag = $state(false);

	let textareaEl = $state<HTMLTextAreaElement | null>(null);
	let fileInputEl = $state<HTMLInputElement | null>(null);
	let saveDebounceTimer = $state<ReturnType<typeof setTimeout> | null>(null);

	// Tutte le etichette create dall'utente
	let allUserTags = $derived.by<string[]>(() => {
		const set = new Set<string>();
		for (const n of notes) {
			if (n.tags && Array.isArray(n.tags)) {
				for (const t of n.tags) {
					if (t && t.trim()) set.add(t.trim());
				}
			}
		}
		return Array.from(set).sort();
	});

	// Fullscreen & Context Menu state
	let isFullscreen = $state(false);
	let isNotesContextMenuOpen = $state(false);
	let contextMenuX = $state(0);
	let contextMenuY = $state(0);

	function toggleFullscreen() {
		if (typeof document === 'undefined') return;
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen().catch(() => {});
			isFullscreen = true;
			toastStore.show({ message: '⛶ Modalità Schermo Intero attivata' });
		} else {
			document.exitFullscreen().catch(() => {});
			isFullscreen = false;
			toastStore.show({ message: 'Modalità Schermo Intero disattivata' });
		}
	}

	function handleNotesContextMenu(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		contextMenuX = Math.min(Math.max(10, e.clientX), window.innerWidth - 240);
		contextMenuY = Math.min(Math.max(10, e.clientY), window.innerHeight - 340);
		isNotesContextMenuOpen = true;
	}

	function closeNotesContextMenu() {
		isNotesContextMenuOpen = false;
	}

	function handleWindowPointerDown(e: PointerEvent) {
		if (isNotesContextMenuOpen) {
			const menuEl = document.querySelector('.notes-floating-context-menu');
			if (menuEl && !menuEl.contains(e.target as Node)) {
				isNotesContextMenuOpen = false;
			}
		}
	}

	onMount(() => {
		notesStore.hydrate(data.initialNotes, user?.id);
		loadTrash();

		const handleExternalNoteSelect = (e: any) => {
			const id = e?.detail?.id;
			if (id) {
				const found = notes.find((n) => n.id === id);
				if (found) selectNote(found);
			}
		};

		const handleCollapseChange = (e: any) => {
			if (typeof e?.detail?.collapsed === 'boolean') {
				isVaultCollapsed = e.detail.collapsed;
				if (typeof localStorage !== 'undefined') {
					localStorage.setItem('rf_vault_collapsed', String(isVaultCollapsed));
				}
				notesNavStore.syncNotes(notes, selectedNoteId, isVaultCollapsed);
			}
		};

		if (typeof window !== 'undefined') {
			if (window.innerWidth >= 1024) {
				isSidebarOpenMobile = false;
				viewMode = 'split'; // Default affiancato su desktop grande
			}
			const savedCollapsed = localStorage.getItem('rf_vault_collapsed');
			if (savedCollapsed === 'true') {
				isVaultCollapsed = true;
			}

			window.addEventListener('rf-select-note', handleExternalNoteSelect);
			window.addEventListener('rf-vault-collapse-changed', handleCollapseChange);
			window.addEventListener('pointerdown', handleWindowPointerDown);
			window.addEventListener('contextmenu', handleNotesContextMenu);
		}

		const unsub = notesStore.subscribe((n) => {
			notes = n;
			notesNavStore.syncNotes(n, selectedNoteId, isVaultCollapsed);

			if (selectedNoteId === null && n.length > 0) {
				const targetId = data.sharedNoteId;
				const matched = targetId ? n.find((note) => note.id === targetId || note.shareId === targetId) : null;
				const activeNote = matched || n[0];
				selectedNoteId = activeNote.id;
				selectNote(activeNote);
			}
		});

		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('rf-select-note', handleExternalNoteSelect);
				window.removeEventListener('rf-vault-collapse-changed', handleCollapseChange);
				window.removeEventListener('pointerdown', handleWindowPointerDown);
				window.removeEventListener('contextmenu', handleNotesContextMenu);
			}
			unsub();
			if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
		};
	});

	function toggleVaultCollapse() {
		isVaultCollapsed = !isVaultCollapsed;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('rf_vault_collapsed', String(isVaultCollapsed));
		}
		notesNavStore.syncNotes(notes, selectedNoteId, isVaultCollapsed);
	}

	async function selectNote(note: Note) {
		selectedNoteId = note.id;
		currentTitle = note.title;
		currentContent = note.content || '';
		currentTags = note.tags ? [...note.tags] : [];
		currentIsPinned = Boolean(note.isPinned);
		isSidebarOpenMobile = false;

		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('rf_last_opened_note_id', note.id);
		}

		notesNavStore.syncNotes(notes, note.id, isVaultCollapsed);
	}

	function handleAddTag() {
		const trimmed = newTagInput.trim();
		if (trimmed && !currentTags.includes(trimmed)) {
			currentTags = [...currentTags, trimmed];
			newTagInput = '';
			isAddingTag = false;
			triggerAutoSave();
			toastStore.show({ message: `🏷️ Etichetta "${trimmed}" aggiunta alla nota!` });
		}
	}

	function handleRemoveTag(tagToRemove: string) {
		currentTags = currentTags.filter((t) => t !== tagToRemove);
		triggerAutoSave();
	}

	let activeNote = $derived(notes.find((n) => n.id === selectedNoteId) || null);
	let headingsOutline = $derived(extractHeadings(currentContent));
	let docStats = $derived(getMarkdownStats(currentContent));

	// Markdown Insertion Helpers
	function insertMarkdownWrap(before: string, after: string, defaultPlaceholder = '') {
		if (!textareaEl) return;
		const start = textareaEl.selectionStart;
		const end = textareaEl.selectionEnd;
		const text = textareaEl.value;
		const selected = text.substring(start, end) || defaultPlaceholder;
		const replacement = before + selected + after;

		textareaEl.value = text.substring(0, start) + replacement + text.substring(end);
		currentContent = textareaEl.value;
		triggerAutoSave();

		const newPos = selected ? start + replacement.length : start + before.length;
		textareaEl.focus();
		textareaEl.setSelectionRange(newPos, newPos);
	}

	function insertMarkdownPrefix(prefix: string) {
		if (!textareaEl) return;
		const start = textareaEl.selectionStart;
		const text = textareaEl.value;
		const lineStart = text.lastIndexOf('\n', start - 1) + 1;

		textareaEl.value = text.substring(0, lineStart) + prefix + text.substring(lineStart);
		currentContent = textareaEl.value;
		triggerAutoSave();

		textareaEl.focus();
		const newPos = start + prefix.length;
		textareaEl.setSelectionRange(newPos, newPos);
	}

	async function uploadAndInsertImage(file: Blob | File) {
		isUploadingImage = true;
		try {
			const res = await uploadImage(file as File);
			if (res && res.url) {
				const imgMd = `\n![${res.filename || 'immagine'}](${res.url})\n`;
				if (textareaEl) {
					const start = textareaEl.selectionStart;
					const end = textareaEl.selectionEnd;
					const text = textareaEl.value;
					textareaEl.value = text.substring(0, start) + imgMd + text.substring(end);
					currentContent = textareaEl.value;
					triggerAutoSave();
				} else {
					currentContent += imgMd;
					triggerAutoSave();
				}
				toastStore.show({ message: '📷 Immagine caricata e inserita!' });
			}
		} catch (err: any) {
			console.error('Errore upload immagine:', err);
			toastStore.show({ message: `⚠️ ${err.message || 'Errore caricamento immagine'}` });
		} finally {
			isUploadingImage = false;
		}
	}

	function handleFileInputChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			uploadAndInsertImage(target.files[0]);
			target.value = '';
		}
	}

	function handleTextareaPaste(e: ClipboardEvent) {
		if (e.clipboardData && e.clipboardData.items) {
			for (const item of Array.from(e.clipboardData.items)) {
				if (item.type.startsWith('image/')) {
					e.preventDefault();
					const file = item.getAsFile();
					if (file) {
						uploadAndInsertImage(file);
						return;
					}
				}
			}
		}
		triggerAutoSave();
	}

	function handleTextareaDrop(e: DragEvent) {
		if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			const file = e.dataTransfer.files[0];
			if (file.type.startsWith('image/')) {
				e.preventDefault();
				uploadAndInsertImage(file);
			}
		}
	}

	function handleTextareaKeyDown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 's') {
			e.preventDefault();
			triggerAutoSave();
			toastStore.show({ message: '💾 Appunto salvato!' });
			return;
		}
		if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
			e.preventDefault();
			insertMarkdownWrap('**', '**', 'testo in grassetto');
			return;
		}
		if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
			e.preventDefault();
			insertMarkdownWrap('*', '*', 'testo in corsivo');
			return;
		}
		if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
			e.preventDefault();
			insertMarkdownWrap('==', '==', 'testo evidenziato');
			return;
		}
		if (e.key === 'Tab') {
			e.preventDefault();
			insertMarkdownWrap('  ', '');
			return;
		}
	}

	function triggerAutoSave() {
		if (!selectedNoteId) return;
		isAutoSaving = true;

		if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
		saveDebounceTimer = setTimeout(async () => {
			if (!selectedNoteId) return;
			try {
				await notesStore.updateNote({
					id: selectedNoteId,
					title: currentTitle.trim() || 'Nuovo Appunto',
					content: currentContent,
					tags: currentTags,
					isPinned: currentIsPinned
				});
				const now = new Date();
				lastSavedTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
			} catch (err) {
				console.error('Errore durante salvataggio automatico nota:', err);
			} finally {
				isAutoSaving = false;
			}
		}, 400);
	}

	async function handleCreateNewNote() {
		isViewingTrash = false;
		selectedTrashNote = null;
		try {
			const newNote = await notesStore.createNote({
				title: 'Nuovo Appunto',
				content: '',
				tags: selectedTagFilter ? [selectedTagFilter] : []
			});
			selectedNoteId = newNote.id;
			currentTitle = newNote.title;
			currentContent = '';
			currentTags = newNote.tags || [];
			currentIsPinned = false;
			isSidebarOpenMobile = false;
			toastStore.show({ message: '✨ Nuovo appunto creato nel Vault!' });
			await tick();
			if (textareaEl) textareaEl.focus();
		} catch (err: any) {
			console.error('Errore creazione appunto:', err);
			toastStore.show({ message: `⚠️ ${err.message || 'Errore creazione appunto'}` });
		}
	}

	async function handleDeleteActiveNote() {
		if (!selectedNoteId) return;
		const idToDelete = selectedNoteId;
		try {
			await notesStore.deleteNote(idToDelete);
			toastStore.show({ message: '🗑️ Appunto spostato nel cestino!' });
			selectedNoteId = null;
			currentTitle = '';
			currentContent = '';
			currentTags = [];
			const remaining = notes.filter((n) => n.id !== idToDelete);
			if (remaining.length > 0) {
				selectNote(remaining[0]);
			}
		} catch (err: any) {
			console.error('Errore eliminazione appunto:', err);
			toastStore.show({ message: `⚠️ ${err.message || 'Errore eliminazione'}` });
		}
	}

	async function handleTogglePin() {
		if (!selectedNoteId) return;
		currentIsPinned = !currentIsPinned;
		triggerAutoSave();
		toastStore.show({ message: currentIsPinned ? '📌 Nota fissata in evidenza' : '📌 Pin rimosso' });
	}

	async function selectTrashNote(note: Note) {
		selectedTrashNote = note;
		selectedNoteId = null;
	}

	async function handleRestoreTrashNote(id: string) {
		try {
			await notesStore.restoreNote(id);
			await loadTrash();
			selectedTrashNote = null;
			isViewingTrash = false;
			const restored = notes.find((n) => n.id === id);
			if (restored) selectNote(restored);
			toastStore.show({ message: '♻️ Appunto ripristinato dal cestino!' });
		} catch (err: any) {
			console.error('Errore ripristino appunto:', err);
			toastStore.show({ message: `⚠️ ${err.message || 'Errore ripristino'}` });
		}
	}

	async function handlePermanentDeleteNote(id: string) {
		if (confirm('Vuoi eliminare DEFINITIVAMENTE questo appunto? L\'azione è irreversibile.')) {
			try {
				await notesStore.permanentDeleteNote(id);
				trashNotes = trashNotes.filter((n) => n.id !== id);
				selectedTrashNote = null;
				toastStore.show({ message: '✕ Appunto eliminato definitivamente' });
			} catch (err: any) {
				console.error('Errore eliminazione definitiva appunto:', err);
				toastStore.show({ message: `⚠️ ${err.message || 'Errore eliminazione'}` });
			}
		}
	}

	function copyMarkdown() {
		if (!currentContent && !currentTitle) return;
		navigator.clipboard.writeText(`# ${currentTitle}\n\n${currentContent}`);
		toastStore.show({ message: '📋 Testo Markdown copiato negli appunti!' });
	}

	function downloadFile() {
		const filename = `${currentTitle.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() || 'appunto'}.md`;
		const fullText = `# ${currentTitle}\n\n${currentContent}`;
		const blob = new Blob([fullText], { type: 'text/markdown;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
		toastStore.show({ message: `📥 "${filename}" scaricato!` });
	}

	let filteredNotes = $derived(
		notes.filter((n) => {
			const matchesTag = !selectedTagFilter || (n.tags && n.tags.includes(selectedTagFilter));
			const q = searchQuery.toLowerCase().trim();
			const matchesQuery = !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
			return matchesTag && matchesQuery;
		})
	);

	let filteredTrashNotes = $derived(
		trashNotes.filter((n) => {
			const q = searchQuery.toLowerCase().trim();
			return !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
		})
	);
</script>

<div class="notes-page-wrapper">
	<div class="notes-header-container" class:is-collapsed={isVaultCollapsed}>
		<PageHeader
			title="Appunti Cloud"
			subtitle="Salva le tue note e sincronizzale ovunque tu sia su tutti i tuoi dispositivi."
			icon="/emoji/clipboard_3d.png"
			variant="red"
			mobileOpenNav={true}
		/>
	</div>

	{#if user}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="obsidian-workspace"
			class:vault-collapsed={isVaultCollapsed}
			oncontextmenu={handleNotesContextMenu}
		>
			<!-- 🗂️ 1. LEFT VAULT EXPLORER -->
			<aside
				class="vault-sidebar duo-card"
				class:collapsed={isVaultCollapsed}
				class:mobile-hidden={!isSidebarOpenMobile && selectedNoteId !== null}
			>
				<div class="vault-header">
					<div class="vault-title-group">
						<span class="vault-icon">📓</span>
						<span class="vault-name">VAULT APPUNTI</span>
						<span class="vault-badge">{notes.length}</span>
					</div>

					<div class="vault-header-actions">
						<button
							type="button"
							class="new-note-btn"
							onclick={handleCreateNewNote}
							title="Crea nuova nota"
						>
							<span>➕</span>
							<span>Nuova</span>
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

				<!-- Vault Switcher Tabs: Attive / Cestino -->
				<div class="vault-tabs-row">
					<button
						type="button"
						class="vault-tab-pill"
						class:active={!isViewingTrash}
						onclick={() => {
							isViewingTrash = false;
							selectedTrashNote = null;
						}}
					>
						📓 Appunti ({notes.length})
					</button>
					<button
						type="button"
						class="vault-tab-pill trash"
						class:active={isViewingTrash}
						onclick={() => {
							isViewingTrash = true;
							loadTrash();
						}}
					>
						🗑️ Cestino ({trashNotes.length})
					</button>
				</div>

				<!-- Vault Search Bar -->
				<div class="vault-search-box">
					<span class="search-ico">🔍</span>
					<input
						type="text"
						bind:value={searchQuery}
						placeholder={isViewingTrash ? 'Cerca nel cestino...' : 'Cerca nel vault...'}
						class="vault-search-input"
					/>
					{#if searchQuery}
						<button type="button" class="clear-btn" onclick={() => (searchQuery = '')}>✕</button>
					{/if}
				</div>

				<!-- User Custom Tags Filter Row -->
				{#if !isViewingTrash && allUserTags.length > 0}
					<div class="vault-tags-filter-row">
						<button
							type="button"
							class="tag-filter-chip"
							class:active={selectedTagFilter === null}
							onclick={() => (selectedTagFilter = null)}
						>
							Tutte ({notes.length})
						</button>
						{#each allUserTags as tag}
							{@const tagCount = notes.filter((n) => n.tags && n.tags.includes(tag)).length}
							<button
								type="button"
								class="tag-filter-chip"
								class:active={selectedTagFilter === tag}
								onclick={() => (selectedTagFilter = selectedTagFilter === tag ? null : tag)}
							>
								🏷️ {tag} ({tagCount})
							</button>
						{/each}
					</div>
				{/if}

				<!-- Notes List Explorer -->
				<div class="vault-files-list">
					{#if isViewingTrash}
						{#if filteredTrashNotes.length === 0}
							<div class="vault-empty-state">
								<p>✨ Il cestino è vuoto.</p>
							</div>
						{:else}
							{#each filteredTrashNotes as note (note.id)}
								{@const isSelected = selectedTrashNote?.id === note.id}
								<div
									class="vault-file-item in-trash"
									class:active={isSelected}
									onclick={() => selectTrashNote(note)}
									role="button"
									tabindex="0"
									onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectTrashNote(note)}
								>
									<div class="file-item-header">
										<span class="file-title">
											{note.title || 'Senza titolo'}
										</span>
									</div>

									<div class="file-item-meta">
										<span class="file-date">
											Eliminata il {new Date(note.deletedAt || note.updatedAt).toLocaleDateString('it-IT', {
												day: 'numeric',
												month: 'short'
											})}
										</span>
										<span class="trash-badge-mini">Cestino</span>
									</div>
								</div>
							{/each}
						{/if}
					{:else}
						{#if filteredNotes.length === 0}
							<div class="vault-empty-state">
								<p>Nessun appunto trovato nel Vault.</p>
								<button type="button" class="create-first-link" onclick={handleCreateNewNote}>
									Crea un nuovo appunto
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
									</div>

									{#if note.tags && note.tags.length > 0}
										<div class="file-tags-row">
											{#each note.tags.slice(0, 3) as tag}
												<span class="file-tag-mini">🏷️ {tag}</span>
											{/each}
											{#if note.tags.length > 3}
												<span class="file-tag-mini">+{note.tags.length - 3}</span>
											{/if}
										</div>
									{/if}

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
					{/if}
				</div>
			</aside>

			<!-- 📝 2. CENTER MAIN WORKSPACE -->
			<main
				class="note-workspace-pane duo-card"
				class:mobile-hidden={isSidebarOpenMobile && (selectedNoteId !== null || selectedTrashNote !== null)}
			>
				{#if isViewingTrash && selectedTrashNote}
					<div class="trash-note-view" in:fade={{ duration: 150 }}>
						<div class="trash-note-banner duo-card">
							<div class="trash-banner-info">
								<span class="trash-icon">🗑️</span>
								<div>
									<strong>Questo appunto si trova nel Cestino</strong>
									<span class="trash-sub">Eliminato il {new Date(selectedTrashNote.deletedAt || selectedTrashNote.updatedAt).toLocaleDateString('it-IT')} • Il cestino non si svuota mai automaticamente</span>
								</div>
							</div>
							<div class="trash-banner-actions">
								<button
									type="button"
									class="duo-btn duo-btn-green restore-note-btn"
									onclick={() => selectedTrashNote && handleRestoreTrashNote(selectedTrashNote.id)}
								>
									♻️ Ripristina
								</button>
								<button
									type="button"
									class="duo-btn duo-btn-red perm-delete-note-btn"
									onclick={() => selectedTrashNote && handlePermanentDeleteNote(selectedTrashNote.id)}
								>
									✕ Elimina Definitivamente
								</button>
							</div>
						</div>

						<div class="trash-note-canvas">
							<h1 class="trash-note-title">{selectedTrashNote.title}</h1>
							<div class="md-rendered-view">
								{@html parseMarkdown(selectedTrashNote.content)}
							</div>
						</div>
					</div>
				{:else if selectedNoteId && activeNote}
					<!-- Workspace Top Header Bar -->
					<div class="workspace-header">
						<div class="workspace-header-left">
							{#if isVaultCollapsed}
								<button
									type="button"
									class="expand-vault-btn"
									onclick={toggleVaultCollapse}
									title="Espandi Vault Appunti"
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

							<div class="save-status-pill">
								{#if isAutoSaving}
									<span class="saving-txt">⏳ Salvataggio...</span>
								{:else}
									<span class="saved-txt">💾 {lastSavedTime ? `Salvato ${lastSavedTime}` : 'Salvato'}</span>
								{/if}
							</div>
						</div>

						<div class="workspace-quick-actions">
							<!-- Switcher Modalità Scrittura / Anteprima / Split -->
							<div class="view-mode-toggle-group">
								<button
									type="button"
									class="mode-pill-btn"
									class:active={viewMode === 'write'}
									onclick={() => (viewMode = 'write')}
									title="Modalità Scrittura Markdown"
								>
									✏️ Scrivi
								</button>
								<button
									type="button"
									class="mode-pill-btn hide-on-small"
									class:active={viewMode === 'split'}
									onclick={() => (viewMode = 'split')}
									title="Modalità Affiancata Live"
								>
									⚡ Split
								</button>
								<button
									type="button"
									class="mode-pill-btn"
									class:active={viewMode === 'preview'}
									onclick={() => (viewMode = 'preview')}
									title="Modalità Anteprima Renderizzata"
								>
									👁️ Anteprima
								</button>
							</div>

							<button
								type="button"
								class="action-icon-btn action-fullscreen-btn"
								class:pinned={isFullscreen}
								onclick={toggleFullscreen}
								title={isFullscreen ? 'Disattiva Schermo Intero' : 'Modalità Schermo Intero (F11)'}
							>
								{isFullscreen ? '✕' : '⛶'}
							</button>

							<button
								type="button"
								class="action-icon-btn action-pin-btn"
								class:pinned={currentIsPinned}
								onclick={handleTogglePin}
								title={currentIsPinned ? 'Rimuovi pin' : 'Fissa in alto'}
							>
								📌
							</button>

							<button
								type="button"
								class="action-icon-btn action-outline-btn"
								onclick={() => (isOutlineOpen = !isOutlineOpen)}
								title="Indice contenuti (TOC)"
							>
								📑
							</button>

							<button
								type="button"
								class="action-icon-btn action-copy-btn"
								onclick={copyMarkdown}
								title="Copia Markdown"
							>
								📋
							</button>

							<button
								type="button"
								class="action-icon-btn action-export-btn"
								onclick={downloadFile}
								title="Esporta file .md"
							>
								📥
							</button>

							<button
								type="button"
								class="action-icon-btn action-delete-btn delete-btn"
								onclick={handleDeleteActiveNote}
								title="Elimina nota"
							>
								🗑️
							</button>
						</div>
					</div>

					<!-- Markdown Formatting Ribbon Toolbar -->
					<div class="obsidian-ribbon-bar">
						<button
							type="button"
							class="ribbon-btn"
							onclick={() => insertMarkdownWrap('**', '**', 'grassetto')}
							title="Grassetto (Ctrl+B)"
						>
							<strong>B</strong>
						</button>
						<button
							type="button"
							class="ribbon-btn"
							onclick={() => insertMarkdownWrap('*', '*', 'corsivo')}
							title="Corsivo (Ctrl+I)"
						>
							<em>I</em>
						</button>
						<button
							type="button"
							class="ribbon-btn highlight-btn"
							onclick={() => insertMarkdownWrap('==', '==', 'testo evidenziato')}
							title="Evidenzia testo (Ctrl+H)"
						>
							🖍️ Evidenzia
						</button>
						<button
							type="button"
							class="ribbon-btn"
							onclick={() => insertMarkdownPrefix('# ')}
							title="Titolo H1 (# Titolo)"
						>
							<strong>H1</strong>
						</button>
						<button
							type="button"
							class="ribbon-btn"
							onclick={() => insertMarkdownPrefix('## ')}
							title="Titolo H2 (## Titolo)"
						>
							<strong>H2</strong>
						</button>
						<button
							type="button"
							class="ribbon-btn"
							onclick={() => insertMarkdownPrefix('### ')}
							title="Titolo H3 (### Titolo)"
						>
							<strong>H3</strong>
						</button>
						<span class="ribbon-sep"></span>
						<button
							type="button"
							class="ribbon-btn"
							onclick={() => insertMarkdownPrefix('- ')}
							title="Elenco puntato"
						>
							• Lista
						</button>
						<button
							type="button"
							class="ribbon-btn"
							onclick={() => insertMarkdownPrefix('1. ')}
							title="Elenco numerato"
						>
							1. Num
						</button>
						<button
							type="button"
							class="ribbon-btn"
							onclick={() => insertMarkdownPrefix('> ')}
							title="Citazione / Box"
						>
							💡 Box
						</button>
						<span class="ribbon-sep"></span>
						<button
							type="button"
							class="ribbon-btn image-ribbon-btn"
							onclick={() => fileInputEl?.click()}
							disabled={isUploadingImage}
							title="Allega o incolla (Ctrl+V) immagine"
						>
							{isUploadingImage ? '⏳ Caricamento...' : '🖼️ Immagine'}
						</button>
						<input
							bind:this={fileInputEl}
							type="file"
							accept="image/png,image/jpeg,image/webp"
							onchange={handleFileInputChange}
							style="display: none;"
						/>
					</div>

					<!-- Note Title Input -->
					<div class="note-document-title-box">
						<input
							type="text"
							bind:value={currentTitle}
							oninput={triggerAutoSave}
							placeholder="Titolo dell'appunto..."
							class="obsidian-title-input"
						/>
					</div>

					<!-- User Custom Tags Bar for Active Note -->
					<div class="note-tags-bar">
						<span class="tags-bar-label">🏷️ Etichette:</span>
						{#each currentTags as tag}
							<span class="note-tag-chip">
								<span>{tag}</span>
								<button
									type="button"
									class="remove-tag-btn"
									onclick={() => handleRemoveTag(tag)}
									title="Rimuovi etichetta"
								>
									✕
								</button>
							</span>
						{/each}
						{#if isAddingTag}
							<div class="add-tag-input-wrap">
								<input
									type="text"
									bind:value={newTagInput}
									placeholder="Nuova etichetta..."
									class="add-tag-input"
									onkeydown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault();
											handleAddTag();
										} else if (e.key === 'Escape') {
											isAddingTag = false;
										}
									}}
								/>
								<button type="button" class="confirm-tag-btn" onclick={handleAddTag}>✓</button>
								<button type="button" class="cancel-tag-btn" onclick={() => (isAddingTag = false)}>✕</button>
							</div>
						{:else}
							<button
								type="button"
								class="add-tag-trigger-btn"
								onclick={() => (isAddingTag = true)}
								title="Aggiungi etichetta personalizzata"
							>
								➕ Aggiungi
							</button>
						{/if}
					</div>

					<!-- Markdown Editor & Preview Canvas -->
					<div class="document-canvas-container mode-{viewMode}">
						{#if viewMode === 'write' || viewMode === 'split'}
							<div class="markdown-editor-pane">
								<textarea
									bind:this={textareaEl}
									bind:value={currentContent}
									oninput={triggerAutoSave}
									onkeydown={handleTextareaKeyDown}
									onpaste={handleTextareaPaste}
									ondrop={handleTextareaDrop}
									ondragover={(e) => e.preventDefault()}
									placeholder="Scrivi qui il tuo appunto in Markdown... Usa # Titolo, **grassetto**, *corsivo*, ==evidenziato== o incolla immagini con Ctrl+V"
									class="markdown-textarea"
									spellcheck="false"
								></textarea>
							</div>
						{/if}

						{#if viewMode === 'preview' || viewMode === 'split'}
							<div class="markdown-preview-pane">
								<div class="md-rendered-view">
									{#if !currentContent.trim()}
										<div class="empty-preview-hint">
											<span>Anteprima live dell'appunto... Inizia a digitare a sinistra per vederlo formattato.</span>
										</div>
									{:else}
										{@html parseMarkdown(currentContent)}
									{/if}
								</div>
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
							<span>Supporto nativo Markdown • Incolla immagini con <strong>Ctrl+V</strong></span>
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
							<div class="no-headings-state">
								<span>Nessun titolo (#, ##) presente in questa nota.</span>
							</div>
						{:else}
							{#each headingsOutline as h}
								<div class="outline-item level-{h.level}">
									<span class="outline-dot"></span>
									<span class="outline-text">{h.text}</span>
								</div>
							{/each}
						{/if}
					</div>
				</aside>
			{/if}
		</div>
	{:else}
		<div class="notes-login-card duo-card">
			<div class="notes-hero-box">
				<div class="notes-icon-badge">
					<img src="/emoji/clipboard_3d.png" alt="Appunti" class="hero-notes-img" />
					<span class="sync-glow-badge">☁️ CLOUD SYNC</span>
				</div>
				<h2 class="notes-hero-title">Salva i tuoi appunti ovunque tu sia</h2>
				<p class="notes-hero-subtitle">
					Accedi con Discord per sbloccare il tuo Vault digitale. Le tue note, gli schemi e le sintesi della normativa RFI saranno sempre al sicuro e sincronizzate su PC, smartphone e tablet.
				</p>
			</div>

			<div class="notes-features-grid">
				<div class="notes-feature-card">
					<span class="nfeature-ico">📱</span>
					<div class="nfeature-text">
						<strong>Sincronizzazione Multi-Dispositivo</strong>
						<p>Inizia a scrivere gli appunti a casa sul computer e rileggili comodamente in mobilità dal telefono.</p>
					</div>
				</div>

				<div class="notes-feature-card">
					<span class="nfeature-ico">📝</span>
					<div class="nfeature-text">
						<strong>Editor Ricco & Markdown Visuale</strong>
						<p>Organizza i concetti con titoli, immagini allegate, elenchi formattati e tabelle intuitive.</p>
					</div>
				</div>

				<div class="notes-feature-card">
					<span class="nfeature-ico">🛡️</span>
					<div class="nfeature-text">
						<strong>Backup Automatico e Protetto</strong>
						<p>I tuoi appunti sono associati in modo sicuro al tuo account Discord. Mai più note perse durante lo studio.</p>
					</div>
				</div>
			</div>

			<div class="notes-action-zone">
				<button type="button" class="duo-btn discord-login-btn hero-action-btn" onclick={() => loginWithDiscord('/notes')}>
					<svg
						class="discord-svg"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 127.14 96.36"
						fill="currentColor"
					>
						<path
							d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.92,53.87,53,48.8,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.92,96.1,53,91,65.69,84.69,65.69Z"
						/>
					</svg>
					<span>ACCEDI CON DISCORD PER SALVARE GLI APPUNTI</span>
				</button>
			</div>
		</div>
	{/if}
</div>

<!-- Menu Contestuale Personalizzato Note (Tasto Destro) -->
{#if isNotesContextMenuOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="notes-floating-context-menu duo-card"
		style="left: {contextMenuX}px; top: {contextMenuY}px;"
		transition:fade={{ duration: 80 }}
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.key === 'Escape' && closeNotesContextMenu()}
		oncontextmenu={(e) => e.preventDefault()}
		role="menu"
		tabindex="0"
	>
		<button type="button" class="ctx-item" onclick={() => { isNotesContextMenuOpen = false; fileInputEl?.click(); }}>
			<span class="ctx-ico">📷</span>
			<span>Inserisci Immagine</span>
		</button>
		<button type="button" class="ctx-item" onclick={() => { isNotesContextMenuOpen = false; insertMarkdownWrap('==', '==', 'testo evidenziato'); }}>
			<span class="ctx-ico">🖍️</span>
			<span>Evidenzia Testo</span>
		</button>
		<button type="button" class="ctx-item" onclick={() => { isNotesContextMenuOpen = false; insertMarkdownWrap('**', '**', 'grassetto'); }}>
			<span class="ctx-ico"><strong>B</strong></span>
			<span>Grassetto</span>
		</button>
		<button type="button" class="ctx-item" onclick={() => { isNotesContextMenuOpen = false; insertMarkdownWrap('*', '*', 'corsivo'); }}>
			<span class="ctx-ico"><em>I</em></span>
			<span>Corsivo</span>
		</button>
		<button type="button" class="ctx-item" onclick={() => { isNotesContextMenuOpen = false; copyMarkdown(); }}>
			<span class="ctx-ico">📋</span>
			<span>Copia Markdown</span>
		</button>
		<button type="button" class="ctx-item" onclick={() => { isNotesContextMenuOpen = false; handleTogglePin(); }}>
			<span class="ctx-ico">📌</span>
			<span>{currentIsPinned ? 'Rimuovi Pin' : 'Fissa in Alto'}</span>
		</button>
		<div class="ctx-divider"></div>
		<button type="button" class="ctx-item danger" onclick={() => { isNotesContextMenuOpen = false; handleDeleteActiveNote(); }}>
			<span class="ctx-ico">🗑️</span>
			<span>Sposta nel Cestino</span>
		</button>
	</div>
{/if}

<style>
	.notes-page-wrapper {
		width: 100%;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		position: relative;
	}

	.notes-header-container {
		width: 100%;
		max-width: 600px;
		margin: 0 auto 0.5rem auto;
		box-sizing: border-box;
		max-height: 180px;
		opacity: 1;
		transform: translateY(0) scale(1);
		transition:
			max-height 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
			opacity 0.25s ease,
			transform 0.3s ease,
			margin 0.3s ease;
		overflow: hidden;
	}

	.notes-header-container.is-collapsed {
		max-height: 0;
		opacity: 0;
		transform: translateY(-12px) scale(0.97);
		margin-bottom: 0;
		pointer-events: none;
	}

	.obsidian-workspace {
		display: flex;
		gap: 0.85rem;
		width: 100%;
		height: calc(100vh - 120px);
		height: calc(100dvh - 120px);
		min-height: 520px;
		position: relative;
		box-sizing: border-box;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	@media (min-width: 1024px) {
		.obsidian-workspace {
			height: calc(100vh - 75px);
			height: calc(100dvh - 75px);
		}
	}

	/* 🗂️ Vault Left Sidebar */
	.vault-sidebar {
		width: 330px;
		min-width: 330px;
		max-width: 330px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding: 0.85rem;
		background: var(--card-bg);
		border-radius: 18px;
		overflow: hidden;
		height: 100%;
		box-sizing: border-box;
		border: 2px solid var(--border-color);
		border-bottom: 4px solid var(--border-depth-color);
		transition:
			width 0.28s cubic-bezier(0.4, 0, 0.2, 1),
			min-width 0.28s cubic-bezier(0.4, 0, 0.2, 1),
			max-width 0.28s cubic-bezier(0.4, 0, 0.2, 1),
			padding 0.28s cubic-bezier(0.4, 0, 0.2, 1),
			opacity 0.22s ease,
			transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
			border-width 0.28s ease;
	}

	@media (min-width: 1024px) {
		.vault-sidebar.collapsed {
			width: 0 !important;
			min-width: 0 !important;
			max-width: 0 !important;
			padding: 0 !important;
			border-width: 0 !important;
			opacity: 0 !important;
			pointer-events: none !important;
			transform: translateX(-16px);
		}
	}

	.vault-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.45rem;
		border-bottom: 1.5px solid var(--border-color);
		flex-shrink: 0;
		gap: 0.5rem;
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
		color: var(--text-color);
		letter-spacing: 0.03em;
	}

	.vault-badge {
		font-size: 0.7rem;
		font-weight: 900;
		background: var(--card-bg-subtle);
		color: var(--text-muted);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		padding: 0.1rem 0.4rem;
	}

	.vault-header-actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.new-note-btn {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		background: var(--accent-color);
		color: #ffffff;
		border: 1.5px solid var(--accent-depth);
		border-bottom: 3px solid var(--accent-depth);
		border-radius: 8px;
		padding: 0.25rem 0.55rem;
		font-size: 0.72rem;
		font-weight: 900;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.new-note-btn:hover {
		filter: brightness(1.1);
	}

	.new-note-btn:active {
		transform: translateY(1.5px);
		border-bottom-width: 1px;
	}

	.collapse-vault-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-bottom: 2.5px solid var(--border-depth-color);
		border-radius: 8px;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		font-size: 0.68rem;
		font-weight: 900;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.collapse-vault-btn:hover {
		color: var(--text-color);
		border-color: var(--accent-color);
		background: var(--hover-bg);
	}

	.collapse-vault-btn:active {
		transform: translateY(1.5px);
		border-bottom-width: 1px;
	}

	.expand-vault-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-bottom: 2.5px solid var(--border-depth-color);
		border-radius: 9px;
		padding: 0.3rem 0.65rem;
		height: 32px;
		box-sizing: border-box;
		font-size: 0.76rem;
		font-weight: 800;
		color: var(--accent-color);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		transition: all 0.12s ease;
		white-space: nowrap;
	}

	.expand-vault-btn:hover {
		background: var(--hover-bg);
		border-color: var(--accent-color);
	}

	.expand-vault-btn:active {
		transform: translateY(1.5px);
		border-bottom-width: 1px;
	}

	.vault-tabs-row {
		display: flex;
		gap: 0.35rem;
		padding: 0.15rem;
		background: var(--card-bg-subtle);
		border-radius: 10px;
		border: 1.5px solid var(--border-color);
		flex-shrink: 0;
	}

	.vault-tab-pill {
		flex: 1;
		background: none;
		border: none;
		border-radius: 7px;
		padding: 0.35rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.12s ease;
		text-align: center;
	}

	.vault-tab-pill.active {
		background: var(--card-bg);
		color: var(--text-color);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
	}

	.vault-tab-pill.trash.active {
		color: #ef4444;
	}

	.vault-search-box {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 10px;
		padding: 0.35rem 0.6rem;
		flex-shrink: 0;
		height: 34px;
		box-sizing: border-box;
	}

	.search-ico {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.vault-search-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-color);
		font-size: 0.8rem;
		font-weight: 700;
		min-width: 0;
	}

	.clear-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		font-size: 0.8rem;
		cursor: pointer;
		padding: 0;
	}

	.vault-tags-filter-row {
		display: flex;
		gap: 0.35rem;
		overflow-x: auto;
		scrollbar-width: none;
		padding: 0.15rem 0;
		flex-shrink: 0;
	}

	.tag-filter-chip {
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 0.25rem 0.55rem;
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--text-muted);
		cursor: pointer;
		white-space: nowrap;
	}

	.tag-filter-chip.active {
		border-color: var(--accent-color);
		background: var(--accent-light-bg);
		color: var(--accent-color);
	}

	.vault-files-list {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		overflow-y: auto;
		scrollbar-width: thin;
		padding-right: 0.2rem;
	}

	.vault-file-item {
		padding: 0.65rem 0.8rem;
		border-radius: 12px;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		cursor: pointer;
		transition: all 0.12s ease;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.vault-file-item:hover {
		border-color: var(--accent-color);
		background: var(--hover-bg);
		transform: translateY(-1px);
	}

	.vault-file-item.active {
		border-color: var(--accent-color);
		background: var(--accent-light-bg);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.file-item-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.file-title {
		font-size: 0.85rem;
		font-weight: 800;
		color: var(--text-color);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pin-ico {
		font-size: 0.78rem;
		margin-right: 0.25rem;
	}

	.file-tags-row {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
	}

	.file-tag-mini {
		font-size: 0.65rem;
		font-weight: 800;
		color: var(--accent-color);
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		padding: 0.05rem 0.35rem;
		border-radius: 4px;
	}

	.file-item-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.68rem;
		color: var(--text-muted);
		font-weight: 700;
	}

	.vault-empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2.5rem 1rem;
		text-align: center;
		color: var(--text-muted);
		font-size: 0.82rem;
		font-weight: 700;
		gap: 0.5rem;
	}

	.create-first-link {
		background: none;
		border: none;
		color: var(--accent-color);
		font-weight: 800;
		text-decoration: underline;
		cursor: pointer;
	}

	/* 📝 Center Main Workspace */
	.note-workspace-pane {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: var(--card-bg);
		border-radius: 18px;
		overflow: hidden;
		height: 100%;
		box-sizing: border-box;
		border: 2px solid var(--border-color);
		border-bottom: 4px solid var(--border-depth-color);
		min-width: 0;
	}

	.workspace-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.6rem 0.85rem;
		border-bottom: 1.5px solid var(--border-color);
		background: var(--card-bg);
		flex-shrink: 0;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.workspace-header-left {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.save-status-pill {
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--text-muted);
		background: var(--card-bg-subtle);
		padding: 0.25rem 0.55rem;
		border-radius: 6px;
		border: 1px solid var(--border-color);
	}

	.workspace-quick-actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.view-mode-toggle-group {
		display: flex;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 9px;
		padding: 0.15rem;
		gap: 0.15rem;
	}

	.mode-pill-btn {
		background: none;
		border: none;
		border-radius: 6px;
		padding: 0.25rem 0.55rem;
		font-size: 0.74rem;
		font-weight: 800;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.mode-pill-btn.active {
		background: var(--card-bg);
		color: var(--accent-color);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.action-icon-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-bottom: 2.5px solid var(--border-depth-color);
		border-radius: 8px;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.85rem;
		color: var(--text-color);
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.action-icon-btn:hover {
		border-color: var(--accent-color);
		background: var(--hover-bg);
	}

	.action-icon-btn.pinned {
		border-color: #f59e0b;
		background: rgba(245, 158, 11, 0.15);
	}

	.action-icon-btn.delete-btn:hover {
		border-color: #ef4444;
		background: rgba(239, 68, 68, 0.12);
	}

	.obsidian-ribbon-bar {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.4rem 0.85rem;
		border-bottom: 1.5px solid var(--border-color);
		background: var(--card-bg-subtle);
		overflow-x: auto;
		scrollbar-width: none;
		flex-shrink: 0;
	}

	.ribbon-btn {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		padding: 0.25rem 0.5rem;
		font-size: 0.76rem;
		font-weight: 800;
		color: var(--text-color);
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.12s ease;
	}

	.ribbon-btn:hover {
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.ribbon-sep {
		width: 1px;
		height: 18px;
		background: var(--border-color);
		margin: 0 0.15rem;
	}

	.note-document-title-box {
		padding: 0.65rem 1.15rem 0.25rem 1.15rem;
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
	}

	.note-tags-bar {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.25rem 1.15rem 0.5rem 1.15rem;
		flex-wrap: wrap;
		flex-shrink: 0;
	}

	.tags-bar-label {
		font-size: 0.74rem;
		font-weight: 800;
		color: var(--text-muted);
	}

	.note-tag-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		padding: 0.15rem 0.45rem;
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--accent-color);
	}

	.remove-tag-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 0.68rem;
		padding: 0;
	}

	.add-tag-trigger-btn {
		background: none;
		border: 1px dashed var(--border-color);
		border-radius: 6px;
		padding: 0.15rem 0.45rem;
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--text-muted);
		cursor: pointer;
	}

	.add-tag-input-wrap {
		display: flex;
		gap: 0.25rem;
	}

	.add-tag-input {
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		padding: 0.15rem 0.4rem;
		font-size: 0.72rem;
		color: var(--text-color);
		outline: none;
		width: 110px;
	}

	.confirm-tag-btn,
	.cancel-tag-btn {
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		padding: 0.15rem 0.4rem;
		font-size: 0.72rem;
		font-weight: 900;
		cursor: pointer;
	}

	/* Document Canvas Container */
	.document-canvas-container {
		flex: 1;
		display: flex;
		overflow: hidden;
		position: relative;
		border-top: 1px solid var(--border-color);
	}

	.markdown-editor-pane,
	.markdown-preview-pane {
		flex: 1;
		height: 100%;
		overflow-y: auto;
		box-sizing: border-box;
		position: relative;
	}

	.mode-split .markdown-editor-pane {
		border-right: 1.5px solid var(--border-color);
	}

	.markdown-textarea {
		width: 100%;
		height: 100%;
		min-height: 100%;
		padding: 1.15rem 1.35rem;
		box-sizing: border-box;
		background: transparent;
		border: none;
		outline: none;
		resize: none;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.92rem;
		line-height: 1.6;
		color: var(--text-color);
		tab-size: 2;
	}

	.markdown-preview-pane {
		padding: 1.15rem 1.35rem;
		background: var(--card-bg);
	}

	.empty-preview-hint {
		color: var(--text-muted);
		font-size: 0.88rem;
		font-style: italic;
		text-align: center;
		padding: 2rem 0;
	}

	/* Markdown Rendered Typography */
	:global(.md-rendered-view) {
		font-size: 0.94rem;
		line-height: 1.65;
		color: var(--text-color);
	}

	:global(.md-rendered-view h1, .md-rendered-view .md-h1) {
		font-size: 1.6rem;
		font-weight: 900;
		color: var(--accent-color);
		margin: 1.25rem 0 0.6rem 0;
		border-bottom: 1.5px solid var(--border-color);
		padding-bottom: 0.35rem;
	}

	:global(.md-rendered-view h2, .md-rendered-view .md-h2) {
		font-size: 1.3rem;
		font-weight: 900;
		color: var(--accent-color);
		margin: 1.1rem 0 0.5rem 0;
	}

	:global(.md-rendered-view h3, .md-rendered-view .md-h3) {
		font-size: 1.1rem;
		font-weight: 800;
		color: var(--text-color);
		margin: 0.9rem 0 0.4rem 0;
	}

	:global(.md-rendered-view p, .md-rendered-view .md-paragraph) {
		margin: 0.6rem 0;
	}

	:global(.md-rendered-view mark, .md-rendered-view .md-highlight) {
		background: rgba(234, 179, 8, 0.25);
		color: var(--text-color);
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		font-weight: 700;
	}

	:global(.md-rendered-view .md-image-container) {
		margin: 0.85rem 0;
		display: flex;
		justify-content: center;
	}

	:global(.md-rendered-view .md-image) {
		max-width: 100%;
		border-radius: 12px;
		border: 1px solid var(--border-color);
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
	}

	:global(.md-rendered-view ul, .md-rendered-view ol) {
		padding-left: 1.4rem;
		margin: 0.5rem 0;
	}

	:global(.md-rendered-view li) {
		margin: 0.25rem 0;
	}

	:global(.md-rendered-view blockquote) {
		border-left: 4px solid var(--accent-color);
		background: var(--card-bg-subtle);
		padding: 0.65rem 1rem;
		border-radius: 0 10px 10px 0;
		margin: 0.75rem 0;
		font-style: italic;
	}

	.workspace-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.4rem 1rem;
		border-top: 1.5px solid var(--border-color);
		background: var(--card-bg-subtle);
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.doc-stats-left {
		display: flex;
		gap: 0.4rem;
	}

	/* 📑 TOC Outline Panel */
	.vault-outline-panel {
		width: 250px;
		min-width: 250px;
		background: var(--card-bg);
		border-radius: 18px;
		border: 2px solid var(--border-color);
		border-bottom: 4px solid var(--border-depth-color);
		padding: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.outline-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 0.45rem;
		border-bottom: 1.5px solid var(--border-color);
	}

	.outline-title {
		font-size: 0.82rem;
		font-weight: 900;
		color: var(--text-color);
	}

	.close-outline-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-weight: 900;
	}

	.outline-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		overflow-y: auto;
	}

	.outline-item {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--text-muted);
	}

	.outline-item.level-1 {
		font-weight: 900;
		color: var(--accent-color);
	}

	.outline-item.level-2 {
		padding-left: 0.6rem;
	}

	.outline-item.level-3 {
		padding-left: 1.2rem;
	}

	.outline-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--accent-color);
	}

	.no-headings-state {
		font-size: 0.75rem;
		color: var(--text-muted);
		text-align: center;
		padding: 1.5rem 0;
	}

	/* 📋 Custom Floating Context Menu for Notes */
	.notes-floating-context-menu {
		position: fixed;
		z-index: 10000;
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		border-radius: 14px;
		padding: 0.35rem;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 195px;
	}

	.ctx-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.45rem 0.65rem;
		background: none;
		border: none;
		border-radius: 8px;
		color: var(--text-color);
		font-size: 0.8rem;
		font-weight: 800;
		cursor: pointer;
		text-align: left;
		transition: all 0.12s ease;
	}

	.ctx-item:hover {
		background: var(--card-bg-subtle);
		color: var(--accent-color);
	}

	.ctx-item.danger:hover {
		background: rgba(239, 68, 68, 0.12);
		color: #ef4444;
	}

	.ctx-ico {
		font-size: 0.95rem;
		width: 18px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.ctx-divider {
		height: 1px;
		background: var(--border-color);
		margin: 0.2rem 0;
	}

	.mobile-back-btn {
		display: none;
		align-items: center;
		gap: 0.3rem;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-bottom: 2.5px solid var(--border-depth-color);
		border-radius: 8px;
		padding: 0.25rem 0.55rem;
		font-size: 0.74rem;
		font-weight: 800;
		color: var(--text-color);
		cursor: pointer;
	}

	@media (max-width: 1023px) {
		.mobile-back-btn {
			display: inline-flex;
		}

		.vault-sidebar.mobile-hidden,
		.note-workspace-pane.mobile-hidden {
			display: none !important;
		}

		.vault-sidebar {
			width: 100% !important;
			min-width: 0 !important;
			max-width: none !important;
		}

		.hide-on-small {
			display: none !important;
		}
	}

	.workspace-empty-canvas {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: 2rem;
		text-align: center;
		gap: 0.65rem;
	}

	.empty-owl {
		width: 90px;
		height: 90px;
		object-fit: contain;
	}

	.trash-note-view {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		overflow-y: auto;
	}

	.trash-note-banner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.85rem 1.15rem;
		background: rgba(239, 68, 68, 0.08);
		border: 1.5px solid #ef4444;
		border-radius: 14px;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.trash-banner-info {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.trash-icon {
		font-size: 1.3rem;
	}

	.trash-banner-info strong {
		display: block;
		font-size: 0.9rem;
		color: var(--text-color);
	}

	.trash-sub {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.trash-banner-actions {
		display: flex;
		gap: 0.5rem;
	}

	.restore-note-btn,
	.perm-delete-note-btn {
		font-size: 0.78rem;
		padding: 0.45rem 0.85rem;
	}

	.trash-note-canvas {
		background: var(--card-bg);
		border-radius: 18px;
		padding: 1.5rem;
		border: 1px solid var(--border-color);
	}

	.trash-note-title {
		font-size: 1.75rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0 0 1rem 0;
	}

	.notes-login-card {
		padding: 2.5rem 1.5rem;
		background: var(--card-bg);
		border-radius: 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 2rem;
		max-width: 680px;
		margin: 0 auto;
	}

	.notes-hero-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.notes-icon-badge {
		position: relative;
		display: inline-flex;
	}

	.hero-notes-img {
		width: 75px;
		height: 75px;
		object-fit: contain;
	}

	.sync-glow-badge {
		position: absolute;
		bottom: -6px;
		right: -10px;
		background: #ef4444;
		color: #ffffff;
		font-size: 0.65rem;
		font-weight: 900;
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
	}

	.notes-hero-title {
		font-size: 1.4rem;
		font-weight: 900;
		margin: 0;
		color: var(--text-color);
	}

	.notes-hero-subtitle {
		font-size: 0.88rem;
		color: var(--text-muted);
		line-height: 1.5;
		margin: 0;
		max-width: 520px;
	}

	.notes-features-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
		gap: 0.85rem;
		width: 100%;
	}

	.notes-feature-card {
		padding: 1rem;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.45rem;
	}

	.nfeature-ico {
		font-size: 1.5rem;
	}

	.nfeature-text strong {
		font-size: 0.85rem;
		color: var(--text-color);
		display: block;
		margin-bottom: 0.25rem;
	}

	.nfeature-text p {
		font-size: 0.75rem;
		color: var(--text-muted);
		line-height: 1.4;
		margin: 0;
	}

	.discord-login-btn {
		background-color: #5865f2;
		color: #ffffff;
		border: 2px solid #4752c4;
		border-bottom: 4px solid #4752c4;
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		font-weight: 900;
		padding: 0.85rem 1.8rem;
		border-radius: 16px;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.discord-svg {
		width: 22px;
		height: 22px;
	}
</style>
