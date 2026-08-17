<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { notesStore } from '$lib/stores/notesStore';
	import { getMarkdownStats, extractHeadings } from '$lib/utils/markdown';
	import type { Note, NoteSortOption } from '$lib/types/notes';
	import { toastStore } from '$lib/stores/toastStore';
	import { fade, scale } from 'svelte/transition';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { markdownToDocHtml, docHtmlToMarkdown, createInlineImageFigureHtml, parseInlineMd } from '$lib/utils/docConverter';
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

	// Vault Tabs: 'notes' | 'archive' | 'trash'
	let activeVaultTab = $state<'notes' | 'archive' | 'trash'>('notes');
	let isViewingTrash = $derived(activeVaultTab === 'trash');
	let isViewingArchive = $derived(activeVaultTab === 'archive');

	let trashNotes = $state<Note[]>([]);
	let selectedTrashNote = $state<Note | null>(null);

	async function loadTrash() {
		trashNotes = await notesStore.fetchTrash();
	}

	let activeNotes = $derived(notes.filter((n) => !n.isArchived && !n.isDeleted));
	let archivedNotes = $derived(notes.filter((n) => Boolean(n.isArchived) && !n.isDeleted));
	let activeNotesCount = $derived(activeNotes.length);
	let archivedNotesCount = $derived(archivedNotes.length);

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
	let currentTags = $state<string[]>([]);
	let currentIsPinned = $state(false);
	let currentIsArchived = $state(false);

	let newTagInput = $state('');
	let isAddingTag = $state(false);

	// Tag Management Modal State
	let isTagManagerModalOpen = $state(false);
	let tagSearchQuery = $state('');
	let editingTagOldName = $state<string | null>(null);
	let editingTagNewName = $state('');
	let modalNewTagInput = $state('');

	let editorEl = $state<HTMLDivElement | null>(null);
	let docCanvasEl = $state<HTMLDivElement | null>(null);
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
		return Array.from(set).sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
	});

	// Etichette non ancora assegnate alla nota corrente (per suggerimenti rapidi)
	let unassignedUserTags = $derived.by<string[]>(() => {
		return allUserTags.filter((t) => !currentTags.includes(t));
	});

	// Etichette filtrate nel modal di gestione
	let filteredModalTags = $derived.by<string[]>(() => {
		const q = tagSearchQuery.toLowerCase().trim();
		if (!q) return allUserTags;
		return allUserTags.filter((t) => t.toLowerCase().includes(q));
	});

	// Fullscreen state
	let isFullscreen = $state(false);

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

		const handleNotesActionReq = (e: any) => {
			const action = e?.detail?.action;
			if (action === 'image') {
				fileInputEl?.click();
			} else if (action === 'highlight') {
				handleHighlightText();
			} else if (action === 'bold') {
				handleFormat('bold');
			} else if (action === 'italic') {
				handleFormat('italic');
			} else if (action === 'copy') {
				copyMarkdown();
			} else if (action === 'pin') {
				handleTogglePin();
			} else if (action === 'archive') {
				handleToggleArchive();
			} else if (action === 'delete') {
				handleDeleteActiveNote();
			}
		};

		if (typeof window !== 'undefined') {
			if (window.innerWidth >= 1024) {
				isSidebarOpenMobile = false;
			}
			const savedCollapsed = localStorage.getItem('rf_vault_collapsed');
			if (savedCollapsed === 'true') {
				isVaultCollapsed = true;
			}

			window.addEventListener('rf-select-note', handleExternalNoteSelect);
			window.addEventListener('rf-vault-collapse-changed', handleCollapseChange);
			window.addEventListener('rf-notes-action', handleNotesActionReq);
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
				window.removeEventListener('rf-notes-action', handleNotesActionReq);
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
		currentIsArchived = Boolean(note.isArchived);
		isSidebarOpenMobile = false;

		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('rf_last_opened_note_id', note.id);
		}

		notesNavStore.syncNotes(notes, note.id, isVaultCollapsed);

		await tick();
		if (editorEl) {
			editorEl.innerHTML = markdownToDocHtml(currentContent);
		}
	}

	function syncContentFromEditor() {
		if (!editorEl) return;
		currentContent = docHtmlToMarkdown(editorEl);
	}

	function handleAddTag(tagToAdd?: string) {
		const trimmed = (tagToAdd || newTagInput).trim();
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

	function handleCreateTagInModal() {
		const trimmed = modalNewTagInput.trim();
		if (!trimmed) return;
		if (allUserTags.includes(trimmed)) {
			toastStore.show({ message: `⚠️ L'etichetta "${trimmed}" esiste già.` });
			return;
		}
		if (selectedNoteId) {
			handleAddTag(trimmed);
		} else if (notes.length > 0) {
			const target = notes[0];
			notesStore.updateNote({ ...target, tags: [...(target.tags || []), trimmed] });
		}
		modalNewTagInput = '';
		toastStore.show({ message: `✨ Etichetta "${trimmed}" creata!` });
	}

	async function handleRenameTag(oldTag: string, newTag: string) {
		const trimmedOld = oldTag.trim();
		const trimmedNew = newTag.trim();
		if (!trimmedNew || trimmedOld === trimmedNew) {
			editingTagOldName = null;
			return;
		}

		const notesToUpdate = notes.filter((n) => n.tags && n.tags.includes(trimmedOld));
		for (const n of notesToUpdate) {
			const updatedTags = (n.tags || []).map((t) => (t === trimmedOld ? trimmedNew : t));
			const uniqueTags = Array.from(new Set(updatedTags));
			await notesStore.updateNote({
				...n,
				tags: uniqueTags
			});
		}

		if (currentTags.includes(trimmedOld)) {
			currentTags = currentTags.map((t) => (t === trimmedOld ? trimmedNew : t));
		}
		if (selectedTagFilter === trimmedOld) {
			selectedTagFilter = trimmedNew;
		}

		editingTagOldName = null;
		editingTagNewName = '';
		toastStore.show({ message: `🏷️ Etichetta rinominata in "${trimmedNew}" su ${notesToUpdate.length} note!` });
	}

	async function handleDeleteTagGlobally(tagToDelete: string) {
		const trimmed = tagToDelete.trim();
		const notesToUpdate = notes.filter((n) => n.tags && n.tags.includes(trimmed));

		for (const n of notesToUpdate) {
			const updatedTags = (n.tags || []).filter((t) => t !== trimmed);
			await notesStore.updateNote({
				...n,
				tags: updatedTags
			});
		}

		if (currentTags.includes(trimmed)) {
			currentTags = currentTags.filter((t) => t !== trimmed);
		}
		if (selectedTagFilter === trimmed) {
			selectedTagFilter = null;
		}

		toastStore.show({ message: `🗑️ Etichetta "${trimmed}" eliminata da ${notesToUpdate.length} note!` });
	}

	let activeNote = $derived(notes.find((n) => n.id === selectedNoteId) || null);
	let headingsOutline = $derived(isOutlineOpen ? extractHeadings(currentContent) : []);
	let docStats = $derived(getMarkdownStats(currentContent));

	function restoreCursorToEnd(targetEl: HTMLElement) {
		const range = document.createRange();
		const sel = window.getSelection();
		range.selectNodeContents(targetEl);
		range.collapse(false);
		sel?.removeAllRanges();
		sel?.addRange(range);
	}

	// Rilevamento in tempo reale dei titoli e blocchi Markdown stile Obsidian
	function checkLiveBlockAutoFormat() {
		if (!editorEl) return;
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) return;
		const node = sel.anchorNode;
		if (!node) return;

		let blockEl = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node) as HTMLElement;
		while (blockEl && blockEl.parentElement !== editorEl && blockEl !== editorEl) {
			blockEl = blockEl.parentElement as HTMLElement;
		}

		if (!blockEl || blockEl === editorEl) return;

		const tag = blockEl.tagName.toLowerCase();
		const text = blockEl.textContent || '';

		// Titolo 1: # ...
		if (tag !== 'h1' && (text.startsWith('# ') || text.startsWith('#'))) {
			const cleanText = text.startsWith('# ') ? text.substring(2) : text.substring(1);
			const h1 = document.createElement('h1');
			h1.innerHTML = parseInlineMd(cleanText) || '<br>';
			editorEl.replaceChild(h1, blockEl);
			restoreCursorToEnd(h1);
			return;
		}

		// Titolo 2: ## ...
		if (tag !== 'h2' && (text.startsWith('## ') || text.startsWith('##'))) {
			const cleanText = text.startsWith('## ') ? text.substring(3) : text.substring(2);
			const h2 = document.createElement('h2');
			h2.innerHTML = parseInlineMd(cleanText) || '<br>';
			editorEl.replaceChild(h2, blockEl);
			restoreCursorToEnd(h2);
			return;
		}

		// Titolo 3: ### ...
		if (tag !== 'h3' && (text.startsWith('### ') || text.startsWith('###'))) {
			const cleanText = text.startsWith('### ') ? text.substring(4) : text.substring(3);
			const h3 = document.createElement('h3');
			h3.innerHTML = parseInlineMd(cleanText) || '<br>';
			editorEl.replaceChild(h3, blockEl);
			restoreCursorToEnd(h3);
			return;
		}

		// Blockquote: > ...
		if (tag !== 'blockquote' && text.startsWith('>')) {
			const cleanText = text.startsWith('> ') ? text.substring(2) : text.substring(1);
			const bq = document.createElement('blockquote');
			bq.innerHTML = parseInlineMd(cleanText) || '<br>';
			editorEl.replaceChild(bq, blockEl);
			restoreCursorToEnd(bq);
			return;
		}

		// Lista puntata: - o *
		if (tag !== 'ul' && (text.startsWith('- ') || text.startsWith('* '))) {
			const cleanText = text.substring(2);
			const ul = document.createElement('ul');
			const li = document.createElement('li');
			li.innerHTML = parseInlineMd(cleanText) || '<br>';
			ul.appendChild(li);
			editorEl.replaceChild(ul, blockEl);
			restoreCursorToEnd(li);
			return;
		}
	}

	function handleEditorInput() {
		checkLiveBlockAutoFormat();
		syncContentFromEditor();
		triggerAutoSave();
	}

	function handleFormat(command: string, value: string | undefined = undefined) {
		document.execCommand(command, false, value);
		syncContentFromEditor();
		triggerAutoSave();
	}

	function handleHighlightText() {
		if (!editorEl) return;
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
			toastStore.show({ message: '💡 Seleziona prima del testo per evidenziarlo', type: 'info' });
			return;
		}
		const range = sel.getRangeAt(0);
		const mark = document.createElement('mark');
		mark.appendChild(range.extractContents());
		range.insertNode(mark);
		sel.removeAllRanges();
		syncContentFromEditor();
		triggerAutoSave();
		toastStore.show({ message: '🖍️ Testo evidenziato!' });
	}

	async function uploadAndInsertImage(file: Blob | File) {
		isUploadingImage = true;
		try {
			const res = await uploadImage(file as File);
			if (res && res.url) {
				const figHtml = createInlineImageFigureHtml(res.url, '450', 'center', res.filename || 'immagine');
				if (editorEl) {
					editorEl.focus();
					document.execCommand('insertHTML', false, figHtml);
					syncContentFromEditor();
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

	function handleEditorPaste(e: ClipboardEvent) {
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
		setTimeout(() => {
			syncContentFromEditor();
			triggerAutoSave();
		}, 10);
	}

	function handleEditorDrop(e: DragEvent) {
		if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			const file = e.dataTransfer.files[0];
			if (file.type.startsWith('image/')) {
				e.preventDefault();
				uploadAndInsertImage(file);
			}
		}
	}

	function handleEditorKeyDown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 's') {
			e.preventDefault();
			triggerAutoSave();
			toastStore.show({ message: '💾 Appunto salvato!' });
			return;
		}
		if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
			e.preventDefault();
			handleFormat('bold');
			return;
		}
		if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
			e.preventDefault();
			handleFormat('italic');
			return;
		}
		if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
			e.preventDefault();
			handleHighlightText();
			return;
		}
	}

	// Gestione interattiva pulsanti e ridimensionamento immagini nel testo
	function handleEditorClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target) return;

		// Gestione click su immagine per mantenerla selezionata con toolbar fissa
		const figure = target.closest('figure.doc-inline-image');
		if (editorEl) {
			editorEl.querySelectorAll('figure.doc-inline-image').forEach((f) => {
				if (f !== figure) f.classList.remove('selected-img');
			});
		}
		if (figure) {
			figure.classList.add('selected-img');
		}

		// Pulsante elimina immagine
		if (target.classList.contains('img-btn-del')) {
			const fig = target.closest('figure.doc-inline-image');
			if (fig) {
				fig.remove();
				syncContentFromEditor();
				triggerAutoSave();
				toastStore.show({ message: 'Immagine rimossa' });
			}
			return;
		}

		// Pulsante allinea immagine
		if (target.classList.contains('img-btn-align')) {
			const align = target.getAttribute('data-align') || 'center';
			const fig = target.closest('figure.doc-inline-image');
			if (fig) {
				fig.setAttribute('data-align', align);
				const wrapper = fig.querySelector('.doc-image-wrapper');
				if (wrapper) {
					wrapper.className = `doc-image-wrapper align-${align}`;
				}
				fig.querySelectorAll('.img-btn-align').forEach((btn) => btn.classList.remove('active'));
				target.classList.add('active');
				syncContentFromEditor();
				triggerAutoSave();
			}
			return;
		}

		// Pulsanti sposta immagine su / giù
		if (target.classList.contains('img-btn-move')) {
			const move = target.getAttribute('data-move');
			const fig = target.closest('figure.doc-inline-image') as HTMLElement;
			if (fig && editorEl) {
				if (move === 'up' && fig.previousElementSibling) {
					editorEl.insertBefore(fig, fig.previousElementSibling);
				} else if (move === 'down' && fig.nextElementSibling) {
					editorEl.insertBefore(fig.nextElementSibling, fig);
				}
				syncContentFromEditor();
				triggerAutoSave();
			}
			return;
		}
	}

	function handleResizeMouseDown(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target || !target.classList.contains('resize-handle')) return;

		e.preventDefault();
		e.stopPropagation();

		const figure = target.closest('figure.doc-inline-image') as HTMLElement;
		if (!figure) return;
		const wrapper = figure.querySelector('.doc-image-wrapper') as HTMLElement;
		if (!wrapper) return;

		figure.classList.add('selected-img');

		const startX = e.clientX;
		const startWidth = wrapper.getBoundingClientRect().width;
		const isSouthWest = target.classList.contains('handle-sw');

		function onMouseMove(moveEvent: MouseEvent) {
			const delta = isSouthWest ? startX - moveEvent.clientX : moveEvent.clientX - startX;
			const maxContainerWidth = Math.max(200, (editorEl?.clientWidth || 700) - 30);
			const newWidth = Math.max(100, Math.min(maxContainerWidth, Math.round(startWidth + delta)));

			wrapper.style.maxWidth = `${newWidth}px`;
			figure.setAttribute('data-width', String(newWidth));
		}

		function onMouseUp() {
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onMouseUp);
			syncContentFromEditor();
			triggerAutoSave();
		}

		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);
	}

	function triggerAutoSave() {
		if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
		isAutoSaving = true;

		saveDebounceTimer = setTimeout(async () => {
			if (!selectedNoteId) return;
			syncContentFromEditor();
			try {
				await notesStore.updateNote({
					id: selectedNoteId,
					title: currentTitle.trim() || 'Nuovo Appunto',
					content: currentContent,
					tags: currentTags,
					isPinned: currentIsPinned,
					isArchived: currentIsArchived
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
		activeVaultTab = 'notes';
		selectedTrashNote = null;
		try {
			const newNote = await notesStore.createNote({
				title: 'Nuovo Appunto',
				content: '',
				tags: selectedTagFilter ? [selectedTagFilter] : [],
				isArchived: false
			});
			selectedNoteId = newNote.id;
			currentTitle = newNote.title;
			currentContent = '';
			currentTags = newNote.tags || [];
			currentIsPinned = false;
			currentIsArchived = false;
			isSidebarOpenMobile = false;
			toastStore.show({ message: '✨ Nuovo appunto creato!' });
			await tick();
			if (editorEl) {
				editorEl.innerHTML = '<p><br></p>';
				editorEl.focus();
			}
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
			currentIsPinned = false;
			currentIsArchived = false;
			const sourceList = activeVaultTab === 'archive' ? archivedNotes : activeNotes;
			const remaining = sourceList.filter((n) => n.id !== idToDelete);
			if (remaining.length > 0) {
				selectNote(remaining[0]);
			}
		} catch (err: any) {
			console.error('Errore eliminazione appunto:', err);
			toastStore.show({ message: `⚠️ ${err.message || 'Errore eliminazione'}` });
		}
	}

	async function handleTogglePin(targetNoteId?: string) {
		const id = targetNoteId || selectedNoteId;
		if (!id) return;

		const target = notes.find((n) => n.id === id);
		if (!target) return;

		const newPinnedState = !target.isPinned;
		if (id === selectedNoteId) {
			currentIsPinned = newPinnedState;
		}

		await notesStore.updateNote({
			id,
			isPinned: newPinnedState
		});

		toastStore.show({ message: newPinnedState ? '📌 Appunto fissato in evidenza!' : '📌 Pin rimosso' });
	}

	async function handleToggleArchive(targetNoteId?: string) {
		const id = targetNoteId || selectedNoteId;
		if (!id) return;

		const target = notes.find((n) => n.id === id);
		if (!target) return;

		const nextArchived = !target.isArchived;
		if (id === selectedNoteId) {
			currentIsArchived = nextArchived;
		}

		await notesStore.updateNote({
			id,
			isArchived: nextArchived,
			archivedAt: nextArchived ? new Date().toISOString() : undefined
		});

		toastStore.show({
			message: nextArchived ? '📦 Appunto spostato in Archivio!' : '📂 Appunto ripristinato negli Appunti attivi!'
		});
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
			activeVaultTab = 'notes';
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

	async function handleEmptyTrash() {
		if (trashNotes.length === 0) return;
		if (confirm(`Sei sicuro di voler svuotare il cestino? (${trashNotes.length} note eliminate per sempre)`)) {
			try {
				for (const tn of trashNotes) {
					await notesStore.permanentDeleteNote(tn.id);
				}
				trashNotes = [];
				selectedTrashNote = null;
				toastStore.show({ message: '🧹 Cestino svuotato' });
			} catch (err: any) {
				console.error('Errore svuotamento cestino:', err);
				toastStore.show({ message: `⚠️ ${err.message || 'Errore svuotamento cestino'}` });
			}
		}
	}

	function copyMarkdown() {
		syncContentFromEditor();
		const fullText = `# ${currentTitle}\n\n${currentContent}`;
		if (navigator?.clipboard) {
			navigator.clipboard.writeText(fullText);
			toastStore.show({ message: '📋 Testo Markdown copiato negli appunti!' });
		}
	}

	function downloadFile() {
		syncContentFromEditor();
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
		(activeVaultTab === 'archive' ? archivedNotes : activeNotes)
			.filter((n) => {
				const matchesTag = !selectedTagFilter || (n.tags && n.tags.includes(selectedTagFilter));
				const q = searchQuery.toLowerCase().trim();
				const matchesQuery = !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
				return matchesTag && matchesQuery;
			})
			.sort((a, b) => {
				// 1. Note fissate sempre in cima
				if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
					return a.isPinned ? -1 : 1;
				}
				// 2. Ordinamento secondario
				if (sortOption === 'title-asc') {
					return a.title.localeCompare(b.title, 'it', { sensitivity: 'base' });
				} else if (sortOption === 'date-asc') {
					return new Date(a.updatedAt || a.createdAt).getTime() - new Date(b.updatedAt || b.createdAt).getTime();
				}
				// Default 'custom' o 'date-desc'
				return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
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
		>
			<!-- 🗂️ 1. LEFT VAULT EXPLORER -->
			<aside
				class="vault-sidebar duo-card"
				class:collapsed={isVaultCollapsed}
				class:mobile-hidden={!isSidebarOpenMobile && selectedNoteId !== null}
			>
				<div class="vault-header">
					<div class="vault-title-group">
						<span class="vault-name">I MIEI APPUNTI</span>
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
					</div>
				</div>

				<!-- Vault Switcher Tabs: Appunti / Archivio / Cestino -->
				<div class="vault-tabs-row">
					<button
						type="button"
						class="vault-tab-pill"
						class:active={activeVaultTab === 'notes'}
						onclick={() => {
							activeVaultTab = 'notes';
							selectedTrashNote = null;
						}}
					>
						📓 Note ({activeNotesCount})
					</button>
					<button
						type="button"
						class="vault-tab-pill archive"
						class:active={activeVaultTab === 'archive'}
						onclick={() => {
							activeVaultTab = 'archive';
							selectedTrashNote = null;
						}}
					>
						📦 Arch ({archivedNotesCount})
					</button>
					<button
						type="button"
						class="vault-tab-pill trash"
						class:active={activeVaultTab === 'trash'}
						onclick={() => {
							activeVaultTab = 'trash';
							loadTrash();
						}}
					>
						🗑️ Trash ({trashNotes.length})
					</button>
				</div>

				<!-- Vault Search Bar -->
				<div class="vault-search-box">
					<span class="search-ico">🔍</span>
					<input
						type="text"
						bind:value={searchQuery}
						placeholder={isViewingTrash ? 'Cerca nel cestino...' : isViewingArchive ? 'Cerca nell\'archivio...' : 'Cerca negli appunti...'}
						class="vault-search-input"
					/>
					{#if searchQuery}
						<button type="button" class="clear-btn" onclick={() => (searchQuery = '')}>✕</button>
					{/if}
				</div>

				<!-- User Custom Tags Filter Row (Filtro stile Categorie) -->
				{#if !isViewingTrash}
					<div class="vault-tags-filter-row">
						<button
							type="button"
							class="tag-filter-chip"
							class:active={selectedTagFilter === null}
							onclick={() => (selectedTagFilter = null)}
							title="Mostra tutti gli appunti"
						>
							Tutti ({activeVaultTab === 'archive' ? archivedNotesCount : activeNotesCount})
						</button>
						{#each allUserTags as tag}
							{@const tagCount = (activeVaultTab === 'archive' ? archivedNotes : activeNotes).filter((n) => n.tags && n.tags.includes(tag)).length}
							{#if tagCount > 0}
								<button
									type="button"
									class="tag-filter-chip"
									class:active={selectedTagFilter === tag}
									onclick={() => (selectedTagFilter = selectedTagFilter === tag ? null : tag)}
									title="Filtra per etichetta {tag}"
								>
									🏷️ {tag} ({tagCount})
								</button>
							{/if}
						{/each}
						<button
							type="button"
							class="tag-manage-gear-btn"
							onclick={() => (isTagManagerModalOpen = true)}
							title="Gestisci, rinomina ed elimina etichette"
						>
							⚙️
						</button>
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
								{#if isViewingArchive}
									<p>📦 Nessun appunto archiviato.</p>
								{:else}
									<p>Nessun appunto trovato.</p>
									<button type="button" class="create-first-link" onclick={handleCreateNewNote}>
										Crea un nuovo appunto
									</button>
								{/if}
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
										<div class="file-actions-quick">
											<button
												type="button"
												class="file-pin-trigger-btn"
												class:active={note.isPinned}
												onclick={(e) => {
													e.stopPropagation();
													handleTogglePin(note.id);
												}}
												title={note.isPinned ? 'Rimuovi pin' : 'Fissa in evidenza'}
											>
												📌
											</button>
											<button
												type="button"
												class="file-archive-trigger-btn"
												class:active={note.isArchived}
												onclick={(e) => {
													e.stopPropagation();
													handleToggleArchive(note.id);
												}}
												title={note.isArchived ? 'Ripristina dagli archivi' : 'Archivia appunto'}
											>
												📦
											</button>
										</div>
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

			<!-- 📝 2. CENTER OBSIDIAN LIVE CANVAS WORKSPACE -->
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
									<h3>Appunto nel Cestino</h3>
									<p>Stai visualizzando un appunto eliminato. Puoi ripristinarlo o eliminarlo per sempre.</p>
								</div>
							</div>
							<div class="trash-banner-actions">
								<button
									type="button"
									class="duo-btn duo-btn-green restore-btn"
									onclick={() => selectedTrashNote && handleRestoreTrashNote(selectedTrashNote.id)}
								>
									♻️ Ripristina
								</button>
								<button
									type="button"
									class="duo-btn duo-btn-red perm-delete-btn"
									onclick={() => selectedTrashNote && handlePermanentDeleteNote(selectedTrashNote.id)}
								>
									✕ Elimina per sempre
								</button>
							</div>
						</div>

						<div class="trash-document-preview">
							<h1 class="trash-preview-title">{selectedTrashNote.title}</h1>
							<div class="trash-preview-body">
								{@html markdownToDocHtml(selectedTrashNote.content)}
							</div>
						</div>
					</div>
				{:else if selectedNoteId}
					<!-- Top Navigation Bar & Action Icons -->
					<div class="workspace-header-bar">
						<div class="workspace-header-left">
							<button
								type="button"
								class="vault-collapse-btn desktop-only"
								onclick={toggleVaultCollapse}
								title={isVaultCollapsed ? 'Espandi barra laterale' : 'Comprimi barra laterale'}
							>
								<span>{isVaultCollapsed ? '⤢' : '⤡'}</span>
								<span>{isVaultCollapsed ? 'Espandi' : 'Comprimi'}</span>
							</button>

							<button
								type="button"
								class="mobile-back-btn mobile-only"
								onclick={() => (isSidebarOpenMobile = true)}
							>
								← Appunti
							</button>

							<div class="save-status-pill" class:is-saving={isAutoSaving}>
								<span class="status-dot" class:saving={isAutoSaving} class:saved={!isAutoSaving}></span>
								<span class="status-text">
									{#if isAutoSaving}
										Salvataggio...
									{:else}
										{lastSavedTime ? `Salvato alle ${lastSavedTime}` : 'Salvato'}
									{/if}
								</span>
							</div>
						</div>

						<div class="workspace-quick-actions">
							<button
								type="button"
								class="action-icon-btn action-fullscreen-btn"
								class:pinned={isFullscreen}
								onclick={toggleFullscreen}
								title={isFullscreen ? 'Disattiva Schermo Intero' : 'Schermo Intero (F11)'}
							>
								{isFullscreen ? '✕' : '⛶'}
							</button>

							<button
								type="button"
								class="action-icon-btn action-pin-btn"
								class:pinned={currentIsPinned}
								onclick={() => handleTogglePin()}
								title={currentIsPinned ? 'Rimuovi pin' : 'Fissa in alto'}
							>
								📌
							</button>

							<button
								type="button"
								class="action-icon-btn action-archive-btn"
								class:pinned={currentIsArchived}
								onclick={() => handleToggleArchive()}
								title={currentIsArchived ? 'Ripristina dall\'archivio' : 'Archivia appunto'}
							>
								📦
							</button>

							<button
								type="button"
								class="action-icon-btn action-outline-btn"
								class:active={isOutlineOpen}
								onclick={() => (isOutlineOpen = !isOutlineOpen)}
								title="Indice contenuti (TOC)"
							>
								📑
							</button>

							<button
								type="button"
								class="action-icon-btn action-copy-btn"
								onclick={copyMarkdown}
								title="Copia Markdown negli appunti"
							>
								📋
							</button>

							<button
								type="button"
								class="action-icon-btn action-export-btn"
								onclick={downloadFile}
								title="Scarica file .md"
							>
								📥
							</button>

							<button
								type="button"
								class="action-icon-btn action-delete-btn delete-btn"
								onclick={handleDeleteActiveNote}
								title="Sposta appunto nel cestino"
							>
								🗑️
							</button>
						</div>
					</div>

					<!-- Markdown Ribbon Toolbar -->
					<div class="obsidian-ribbon-bar">
						<div class="ribbon-group">
							<button
								type="button"
								class="ribbon-btn format-bold"
								onclick={() => handleFormat('bold')}
								title="Grassetto (Ctrl+B)"
							>
								<strong>B</strong>
							</button>
							<button
								type="button"
								class="ribbon-btn format-italic"
								onclick={() => handleFormat('italic')}
								title="Corsivo (Ctrl+I)"
							>
								<em>I</em>
							</button>
							<button
								type="button"
								class="ribbon-btn heading-btn"
								onclick={() => handleFormat('formatBlock', 'h1')}
								title="Titolo H1 (# Titolo)"
							>
								<strong>H1</strong>
							</button>
							<button
								type="button"
								class="ribbon-btn heading-btn"
								onclick={() => handleFormat('formatBlock', 'h2')}
								title="Titolo H2 (## Titolo)"
							>
								<strong>H2</strong>
							</button>
							<button
								type="button"
								class="ribbon-btn heading-btn"
								onclick={() => handleFormat('formatBlock', 'h3')}
								title="Titolo H3 (### Titolo)"
							>
								<strong>H3</strong>
							</button>
						</div>

						<span class="ribbon-sep"></span>

						<div class="ribbon-group">
							<button
								type="button"
								class="ribbon-btn"
								onclick={() => handleFormat('insertUnorderedList')}
								title="Elenco puntato (- )"
							>
								<span>• Lista</span>
							</button>
							<button
								type="button"
								class="ribbon-btn"
								onclick={() => handleFormat('insertOrderedList')}
								title="Elenco numerato (1. )"
							>
								<span>1. Num</span>
							</button>
						</div>

						<span class="ribbon-sep"></span>

						<div class="ribbon-group">
							<button
								type="button"
								class="ribbon-btn box-btn"
								onclick={() => handleFormat('formatBlock', 'blockquote')}
								title="Citazione / Box (> )"
							>
								<span>💡 Box</span>
							</button>
						</div>

						<span class="ribbon-sep"></span>

						<div class="ribbon-group">
							<button
								type="button"
								class="ribbon-btn image-ribbon-btn"
								onclick={() => fileInputEl?.click()}
								disabled={isUploadingImage}
								title="Allega o incolla (Ctrl+V) immagine"
							>
								<span>🖼️ Immagine</span>
							</button>
						</div>

						<input
							bind:this={fileInputEl}
							type="file"
							accept="image/png,image/jpeg,image/webp"
							onchange={handleFileInputChange}
							style="display: none;"
						/>
					</div>

					<!-- Archived Note Banner -->
					{#if currentIsArchived}
						<div class="archived-banner duo-card" in:fade={{ duration: 150 }}>
							<div class="archived-banner-info">
								<span class="archived-icon">📦</span>
								<div>
									<strong>Questo appunto è in Archivio</strong>
									<span class="archived-sub">Puoi visualizzarlo, modificarlo o ripristinarlo nei tuoi appunti principali</span>
								</div>
							</div>
							<button
								type="button"
								class="duo-btn duo-btn-theme unarchive-btn"
								onclick={() => handleToggleArchive()}
								title="Ripristina negli appunti principali"
							>
								📂 Disarchivia
							</button>
						</div>
					{/if}

					<!-- Note Title Input -->
					<div class="note-document-title-box">
						<input
							type="text"
							bind:value={currentTitle}
							oninput={triggerAutoSave}
							placeholder="Nuovo Appunto"
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
									title="Rimuovi etichetta da questa nota"
								>
									✕
								</button>
							</span>
						{/each}

						{#if isAddingTag}
							<div class="add-tag-popover duo-card" transition:fade={{ duration: 100 }}>
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
									<button type="button" class="confirm-tag-btn" onclick={() => handleAddTag()}>✓</button>
									<button type="button" class="cancel-tag-btn" onclick={() => (isAddingTag = false)}>✕</button>
								</div>

								{#if unassignedUserTags.length > 0}
									<div class="tag-quick-picker">
										<span class="quick-picker-title">Assegna esistente:</span>
										<div class="quick-picker-chips">
											{#each unassignedUserTags as existingTag}
												<button
													type="button"
													class="quick-tag-pick-btn"
													onclick={() => handleAddTag(existingTag)}
													title="Assegna etichetta {existingTag}"
												>
													+ {existingTag}
												</button>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						{:else}
							<button
								type="button"
								class="add-tag-trigger-btn"
								onclick={() => (isAddingTag = true)}
								title="Aggiungi o assegna etichetta"
							>
								➕ Aggiungi
							</button>
						{/if}
					</div>

					<!-- Obsidian Live Document Canvas -->
					<div
						bind:this={docCanvasEl}
						class="document-canvas-container"
						ondrop={handleEditorDrop}
						ondragover={(e) => e.preventDefault()}
						role="region"
						aria-label="Area di scrittura live Obsidian"
					>
						<div
							bind:this={editorEl}
							contenteditable="true"
							class="obsidian-live-editor"
							oninput={handleEditorInput}
							onkeydown={handleEditorKeyDown}
							onpaste={handleEditorPaste}
							onclick={handleEditorClick}
							onmousedown={handleResizeMouseDown}
							role="textbox"
							tabindex="0"
							aria-multiline="true"
							spellcheck="false"
						></div>
					</div>

					<!-- Workspace Footer Status Info -->
					<div class="workspace-footer">
						<div class="doc-stats-left">
							<span>📝 {docStats.wordCount} parole</span>
							<span class="footer-dot">•</span>
							<span>⏰ ~{docStats.readingTimeMinutes} min lettura</span>
							<span class="footer-dot">•</span>
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
								▶ Mostra Appunti
							</button>
						{/if}
						<img src="/emoji/owl_3d.png" alt="" class="empty-owl" />
						<h2>Seleziona un appunto o creane uno nuovo</h2>
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
					Accedi con Discord per salvare i tuoi appunti digitali. Le tue note, gli schemi e le sintesi della normativa RFI saranno sempre al sicuro e sincronizzate su PC, smartphone e tablet.
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

<!-- 🏷️ Modal Gestione & Rinomina Etichette Personali -->
{#if isTagManagerModalOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="modal-backdrop"
		transition:fade={{ duration: 150 }}
		onclick={() => (isTagManagerModalOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (isTagManagerModalOpen = false)}
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="tag-manager-modal duo-card"
			transition:scale={{ duration: 180, start: 0.96 }}
			onclick={(e) => e.stopPropagation()}
			onkeydown={() => {}}
			role="dialog"
			aria-modal="true"
			aria-label="Gestione Etichette Appunti"
			tabindex="0"
		>
			<div class="modal-header">
				<div class="modal-title-group">
					<span class="modal-icon">🏷️</span>
					<h2>Gestione Etichette</h2>
					<span class="modal-badge">{allUserTags.length}</span>
				</div>
				<button
					type="button"
					class="close-modal-btn"
					onclick={() => (isTagManagerModalOpen = false)}
					title="Chiudi"
				>
					✕
				</button>
			</div>

			<!-- Ricerca rapida tra le etichette -->
			<div class="modal-search-box">
				<span class="search-ico">🔍</span>
				<input
					type="text"
					bind:value={tagSearchQuery}
					placeholder="Cerca tra le tue etichette..."
					class="modal-search-input"
				/>
				{#if tagSearchQuery}
					<button type="button" class="clear-btn" onclick={() => (tagSearchQuery = '')}>✕</button>
				{/if}
			</div>

			<!-- Lista Etichette con Rinomina ed Elimina -->
			<div class="modal-tags-scroll">
				{#if allUserTags.length === 0}
					<div class="modal-empty-tags">
						<p>Nessuna etichetta creata finora.</p>
						<span>Aggiungi le etichette ai tuoi appunti per organizzarli e filtrarli rapidamente.</span>
					</div>
				{:else if filteredModalTags.length === 0}
					<div class="modal-empty-tags">
						<p>Nessuna etichetta trovata per "{tagSearchQuery}".</p>
					</div>
				{:else}
					{#each filteredModalTags as tag}
						{@const noteCount = notes.filter((n) => n.tags && n.tags.includes(tag)).length}
						{@const isEditing = editingTagOldName === tag}
						<div class="modal-tag-row" class:is-active-filter={selectedTagFilter === tag}>
							{#if isEditing}
								<div class="edit-tag-inline-form">
									<input
										type="text"
										bind:value={editingTagNewName}
										class="edit-tag-input"
										onkeydown={(e) => {
											if (e.key === 'Enter') handleRenameTag(tag, editingTagNewName);
											if (e.key === 'Escape') editingTagOldName = null;
										}}
									/>
									<button
										type="button"
										class="confirm-rename-btn"
										onclick={() => handleRenameTag(tag, editingTagNewName)}
										title="Salva nuovo nome"
									>
										✓
									</button>
									<button
										type="button"
										class="cancel-rename-btn"
										onclick={() => (editingTagOldName = null)}
										title="Annulla"
									>
										✕
									</button>
								</div>
							{:else}
								<div class="tag-row-info">
									<button
										type="button"
										class="tag-filter-link"
										onclick={() => {
											selectedTagFilter = selectedTagFilter === tag ? null : tag;
											isTagManagerModalOpen = false;
										}}
										title="Filtra gli appunti per questa etichetta"
									>
										<span class="tag-name">🏷️ {tag}</span>
										<span class="tag-count-pill">{noteCount} note</span>
									</button>
								</div>

								<div class="tag-row-actions">
									<button
										type="button"
										class="tag-action-btn edit"
										onclick={() => {
											editingTagOldName = tag;
											editingTagNewName = tag;
										}}
										title="Rinomina etichetta in tutte le note"
									>
										✏️ Rinomina
									</button>
									<button
										type="button"
										class="tag-action-btn delete"
										onclick={() => handleDeleteTagGlobally(tag)}
										title="Elimina etichetta da tutte le note"
									>
										🗑️
									</button>
								</div>
							{/if}
						</div>
					{/each}
				{/if}
			</div>

			<!-- Footer Modal: Aggiungi nuova etichetta -->
			<div class="modal-footer-box">
				<div class="modal-add-tag-box">
					<input
						type="text"
						bind:value={modalNewTagInput}
						placeholder="Crea nuova etichetta..."
						class="modal-add-input"
						onkeydown={(e) => e.key === 'Enter' && handleCreateTagInModal()}
					/>
					<button
						type="button"
						class="duo-btn duo-btn-green modal-add-btn"
						onclick={handleCreateTagInModal}
					>
						➕ Crea
					</button>
				</div>
			</div>
		</div>
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
		.notes-header-container {
			display: none !important;
		}

		.obsidian-workspace {
			height: calc(100vh - 40px);
			height: calc(100dvh - 40px);
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

	.vault-tab-pill.archive.active {
		color: #8b5cf6;
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

	.tag-manage-gear-btn {
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 0.25rem 0.45rem;
		font-size: 0.75rem;
		cursor: pointer;
		color: var(--text-muted);
		transition: all 0.12s ease;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.tag-manage-gear-btn:hover {
		border-color: var(--accent-color);
		color: var(--accent-color);
		background: var(--hover-bg);
		transform: scale(1.05);
	}

	.vault-files-list {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--border-color) transparent;
		padding-right: 0.2rem;
	}

	.vault-files-list::-webkit-scrollbar {
		width: 6px;
	}

	.vault-files-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.vault-files-list::-webkit-scrollbar-thumb {
		background: var(--border-color);
		border-radius: 9999px;
	}

	.vault-files-list::-webkit-scrollbar-thumb:hover {
		background: var(--accent-color);
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
		gap: 0.35rem;
	}

	.file-title {
		font-size: 0.85rem;
		font-weight: 800;
		color: var(--text-color);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
		min-width: 0;
	}

	.file-actions-quick {
		display: flex;
		align-items: center;
		gap: 0.15rem;
		flex-shrink: 0;
	}

	.file-pin-trigger-btn,
	.file-archive-trigger-btn {
		background: none;
		border: none;
		font-size: 0.72rem;
		opacity: 0.35;
		cursor: pointer;
		padding: 0.1rem 0.25rem;
		border-radius: 4px;
		transition: all 0.12s ease;
		flex-shrink: 0;
	}

	.vault-file-item:hover .file-pin-trigger-btn,
	.vault-file-item:hover .file-archive-trigger-btn,
	.file-pin-trigger-btn.active,
	.file-archive-trigger-btn.active {
		opacity: 1;
	}

	.file-pin-trigger-btn:hover,
	.file-archive-trigger-btn:hover {
		transform: scale(1.2);
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

	/* Top Workspace Header Bar */
	.workspace-header-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.55rem 0.85rem;
		border-bottom: 1.5px solid var(--border-color);
		background: var(--card-bg);
		flex-shrink: 0;
		gap: 0.65rem;
		min-height: 48px;
		box-sizing: border-box;
	}

	.workspace-header-left {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-shrink: 0;
	}

	.vault-collapse-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-bottom: 2.5px solid var(--border-depth-color);
		border-radius: 12px;
		padding: 0.3rem 0.65rem;
		font-size: 0.74rem;
		font-weight: 800;
		color: var(--text-color);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		transition: all 0.12s ease;
		height: 32px;
		box-sizing: border-box;
	}

	.vault-collapse-btn:hover {
		border-color: var(--accent-color);
		background: var(--hover-bg);
		color: var(--accent-color);
		transform: translateY(-1px);
	}

	.vault-collapse-btn:active {
		transform: translateY(1.5px);
		border-bottom-width: 1.5px;
	}

	.save-status-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.74rem;
		font-weight: 800;
		color: #c4b5fd;
		background: rgba(139, 92, 246, 0.12);
		padding: 0.25rem 0.65rem;
		border-radius: 9px;
		border: 1.5px solid rgba(139, 92, 246, 0.3);
		height: 32px;
		box-sizing: border-box;
		white-space: nowrap;
		transition: all 0.15s ease;
	}

	.status-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
		display: inline-block;
	}

	.status-dot.saved {
		background: #22c55e;
		box-shadow: 0 0 6px rgba(34, 197, 94, 0.6);
	}

	.status-dot.saving {
		background: #f59e0b;
		box-shadow: 0 0 6px rgba(245, 158, 11, 0.6);
		animation: pulse-save 1s infinite alternate;
	}

	@keyframes pulse-save {
		from { opacity: 0.4; transform: scale(0.85); }
		to { opacity: 1; transform: scale(1.15); }
	}

	.status-text {
		font-size: 0.72rem;
		font-weight: 750;
	}

	.workspace-quick-actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-shrink: 0;
	}

	.action-icon-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-bottom: 2.5px solid var(--border-depth-color);
		border-radius: 10px;
		width: 32px;
		height: 32px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.85rem;
		color: var(--text-color);
		cursor: pointer;
		transition: all 0.12s ease;
		flex-shrink: 0;
	}

	.action-icon-btn:hover {
		border-color: var(--accent-color);
		background: var(--hover-bg);
		transform: translateY(-1px);
	}

	.action-icon-btn:active {
		transform: translateY(1.5px);
		border-bottom-width: 1.5px;
	}

	.action-icon-btn.pinned {
		border-color: #f59e0b;
		border-bottom-color: #d97706;
		background: rgba(245, 158, 11, 0.16);
		color: #d97706;
	}

	.action-icon-btn.action-archive-btn.pinned {
		border-color: #8b5cf6;
		border-bottom-color: #7c3aed;
		background: rgba(139, 92, 246, 0.16);
		color: #7c3aed;
	}

	.action-icon-btn.action-outline-btn.active {
		border-color: var(--accent-color);
		border-bottom-color: var(--accent-dark-color, var(--border-depth-color));
		background: var(--accent-light-bg);
		color: var(--accent-color);
	}

	.action-icon-btn.delete-btn:hover {
		border-color: #ef4444;
		border-bottom-color: #dc2626;
		background: rgba(239, 68, 68, 0.14);
		color: #ef4444;
	}

	.archived-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		padding: 0.6rem 1rem;
		background: rgba(139, 92, 246, 0.08);
		border-bottom: 1.5px solid rgba(139, 92, 246, 0.25);
		border-radius: 0;
		flex-shrink: 0;
	}

	.archived-banner-info {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		font-size: 0.82rem;
		color: var(--text-color);
	}

	.archived-banner-info strong {
		display: block;
		font-size: 0.85rem;
		color: var(--text-color);
	}

	.archived-icon {
		font-size: 1.25rem;
	}

	.archived-sub {
		display: block;
		font-size: 0.72rem;
		color: var(--text-muted);
		font-weight: 600;
	}

	.unarchive-btn {
		padding: 0.35rem 0.75rem;
		font-size: 0.78rem;
		white-space: nowrap;
		flex-shrink: 0;
	}

	/* Markdown Ribbon Formatting Toolbar */
	.obsidian-ribbon-bar {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.4rem 0.85rem;
		margin: 0.75rem 1.25rem 0.35rem 1.25rem;
		border: 1.5px solid var(--border-color);
		border-radius: 14px;
		background: var(--card-bg-subtle);
		overflow-x: auto;
		scrollbar-width: none;
		flex-shrink: 0;
		min-height: 42px;
		box-sizing: border-box;
	}

	.obsidian-ribbon-bar::-webkit-scrollbar {
		display: none;
	}

	.ribbon-group {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: transparent;
		border: none;
		padding: 0;
		flex-shrink: 0;
	}

	.ribbon-btn {
		background: transparent;
		border: none;
		border-radius: 6px;
		padding: 0.2rem 0.45rem;
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--text-color);
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.12s ease;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		height: 27px;
		box-sizing: border-box;
		flex-shrink: 0;
	}

	.ribbon-btn:hover {
		color: var(--brand-color);
		background: var(--hover-bg);
		transform: translateY(-1px);
	}

	.ribbon-btn:active {
		transform: translateY(1px);
	}

	.ribbon-btn.format-bold,
	.ribbon-btn.format-italic {
		min-width: 25px;
		padding: 0.2rem 0.35rem;
	}

	.ribbon-btn.heading-btn {
		font-size: 0.75rem;
		min-width: 28px;
	}

	.ribbon-btn.image-ribbon-btn {
		color: #38bdf8;
		font-weight: 800;
	}

	.ribbon-btn.image-ribbon-btn:hover {
		color: #60a5fa;
		background: rgba(56, 189, 248, 0.12);
	}

	.ribbon-sep {
		width: 1.5px;
		height: 16px;
		background: var(--border-color);
		margin: 0 0.15rem;
		border-radius: 1px;
		opacity: 0.6;
		flex-shrink: 0;
	}

	.note-document-title-box {
		padding: 0.45rem 1.25rem 0.15rem 1.25rem;
		width: 100%;
		box-sizing: border-box;
		flex-shrink: 0;
	}

	.obsidian-title-input {
		width: 100%;
		background: transparent;
		border: none;
		outline: none;
		font-family: 'Outfit', sans-serif;
		font-size: 1.7rem;
		font-weight: 900;
		color: var(--text-color);
		padding: 0;
		box-sizing: border-box;
		letter-spacing: -0.01em;
	}

	.obsidian-title-input::placeholder {
		color: var(--text-muted);
		opacity: 0.6;
	}

	.note-tags-bar {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 1.25rem 0.35rem 1.25rem;
		flex-wrap: wrap;
		flex-shrink: 0;
		position: relative;
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

	.add-tag-popover {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		border-radius: 12px;
		padding: 0.5rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
		min-width: 230px;
		max-width: 320px;
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 10;
	}

	.add-tag-input-wrap {
		display: flex;
		gap: 0.25rem;
	}

	.add-tag-input {
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		padding: 0.2rem 0.45rem;
		font-size: 0.74rem;
		color: var(--text-color);
		outline: none;
		flex: 1;
		min-width: 0;
	}

	.confirm-tag-btn,
	.cancel-tag-btn {
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		padding: 0.2rem 0.45rem;
		font-size: 0.72rem;
		font-weight: 900;
		cursor: pointer;
	}

	.confirm-tag-btn:hover {
		border-color: var(--green-color);
		color: var(--green-color);
	}

	.tag-quick-picker {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		border-top: 1px dashed var(--border-color);
		padding-top: 0.35rem;
		margin-top: 0.15rem;
	}

	.quick-picker-title {
		font-size: 0.68rem;
		font-weight: 800;
		color: var(--text-muted);
	}

	.quick-picker-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		max-height: 110px;
		overflow-y: auto;
		scrollbar-width: thin;
	}

	.quick-tag-pick-btn {
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		padding: 0.15rem 0.4rem;
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--accent-color);
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.quick-tag-pick-btn:hover {
		border-color: var(--accent-color);
		background: var(--accent-light-bg);
		transform: translateY(-1px);
	}

	/* Obsidian Live Document Canvas Container */
	.document-canvas-container {
		flex: 1;
		min-height: 200px;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		position: relative;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 16px;
		margin: 0.35rem 1.25rem 0.75rem 1.25rem;
		padding: 1.25rem 1.4rem;
		box-sizing: border-box;
		scrollbar-width: thin;
		scrollbar-color: var(--border-color) transparent;
		cursor: text;
	}

	.document-canvas-container::-webkit-scrollbar {
		width: 7px;
	}

	.document-canvas-container::-webkit-scrollbar-track {
		background: transparent;
	}

	.document-canvas-container::-webkit-scrollbar-thumb {
		background: var(--border-color);
		border-radius: 9999px;
	}

	.document-canvas-container::-webkit-scrollbar-thumb:hover {
		background: var(--accent-color);
	}

	.obsidian-live-editor {
		width: 100%;
		min-height: 100%;
		flex: 1;
		outline: none;
		font-size: 0.98rem;
		line-height: 1.65;
		color: var(--text-color);
		font-family: inherit;
		box-sizing: border-box;
		word-break: break-word;
		padding: 0;
	}

	/* Obsidian Live Headings Styling */
	.obsidian-live-editor :global(h1) {
		font-family: 'Outfit', sans-serif;
		font-size: 1.55rem;
		font-weight: 900;
		color: var(--accent-color);
		margin: 0.75rem 0 0.25rem 0;
		border-bottom: none;
		padding-bottom: 0;
	}

	.obsidian-live-editor :global(h2) {
		font-family: 'Outfit', sans-serif;
		font-size: 1.3rem;
		font-weight: 900;
		color: var(--accent-color);
		margin: 0.65rem 0 0.2rem 0;
		border-bottom: none;
	}

	.obsidian-live-editor :global(h3) {
		font-family: 'Outfit', sans-serif;
		font-size: 1.12rem;
		font-weight: 800;
		color: var(--accent-color);
		margin: 0.55rem 0 0.18rem 0;
		border-bottom: none;
	}

	.obsidian-live-editor :global(p) {
		margin: 0.35rem 0;
		min-height: 1.25em;
	}

	.obsidian-live-editor :global(mark) {
		background: rgba(234, 179, 8, 0.28);
		color: var(--text-color);
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		font-weight: 700;
	}

	.obsidian-live-editor :global(strong),
	.obsidian-live-editor :global(b) {
		font-weight: 900;
		color: var(--text-color);
	}

	.obsidian-live-editor :global(blockquote) {
		border-left: 4px solid var(--accent-color);
		background: var(--card-bg-subtle);
		padding: 0.65rem 1rem;
		border-radius: 0 10px 10px 0;
		margin: 0.65rem 0;
		font-style: italic;
	}

	.obsidian-live-editor :global(ul),
	.obsidian-live-editor :global(ol) {
		padding-left: 1.5rem;
		margin: 0.45rem 0;
	}

	.obsidian-live-editor :global(li) {
		margin: 0.2rem 0;
	}

	.obsidian-live-editor :global(code) {
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		padding: 0.1rem 0.35rem;
		font-family: monospace;
		font-size: 0.85em;
		color: var(--accent-color);
	}

	/* Inline Image Figure Styling in Obsidian Live Editor */
	.obsidian-live-editor :global(figure.doc-inline-image) {
		margin: 0.85rem 0;
		user-select: none;
	}

	.obsidian-live-editor :global(.doc-image-wrapper) {
		position: relative;
		display: inline-block;
		border-radius: 12px;
		overflow: visible;
		border: 1.5px solid var(--border-color);
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
	}

	.obsidian-live-editor :global(.doc-image-wrapper.align-center) {
		display: block;
		margin: 0 auto;
	}

	.obsidian-live-editor :global(.doc-image-wrapper.align-left) {
		display: block;
		margin-right: auto;
	}

	.obsidian-live-editor :global(.doc-image-wrapper.align-right) {
		display: block;
		margin-left: auto;
	}

	.obsidian-live-editor :global(.doc-img-element) {
		width: 100%;
		display: block;
		border-radius: 11px;
	}

	.obsidian-live-editor :global(.doc-image-toolbar) {
		position: absolute;
		top: -42px;
		left: 50%;
		transform: translateX(-50%);
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		border-radius: 9px;
		padding: 0.2rem 0.4rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22);
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.15s ease;
		z-index: 25;
		white-space: nowrap;
	}

	/* Bridge invisibile per non perdere l'hover muovendo il mouse tra immagine e toolbar */
	.obsidian-live-editor :global(.doc-image-toolbar::after) {
		content: '';
		position: absolute;
		top: 100%;
		left: 0;
		width: 100%;
		height: 20px;
		background: transparent;
	}

	.obsidian-live-editor :global(figure.doc-inline-image:hover .doc-image-toolbar),
	.obsidian-live-editor :global(figure.doc-inline-image.selected-img .doc-image-toolbar) {
		opacity: 1;
		pointer-events: auto;
	}

	.obsidian-live-editor :global(.doc-image-toolbar button),
	.obsidian-live-editor :global(.doc-image-toolbar a) {
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		border-radius: 5px;
		padding: 0.15rem 0.35rem;
		font-size: 0.72rem;
		cursor: pointer;
		color: var(--text-color);
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.obsidian-live-editor :global(.doc-image-toolbar button:hover),
	.obsidian-live-editor :global(.doc-image-toolbar a:hover) {
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.obsidian-live-editor :global(.doc-image-toolbar .img-btn-del:hover) {
		border-color: #ef4444;
		color: #ef4444;
	}

	.obsidian-live-editor :global(.doc-image-toolbar .img-tool-sep) {
		width: 1px;
		height: 14px;
		background: var(--border-color);
		margin: 0 0.1rem;
	}

	.obsidian-live-editor :global(.resize-handle) {
		position: absolute;
		width: 14px;
		height: 14px;
		background: var(--accent-color);
		border: 2px solid #ffffff;
		border-radius: 50%;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
		opacity: 0;
		transition: opacity 0.15s ease, transform 0.15s ease;
		z-index: 20;
	}

	.obsidian-live-editor :global(.resize-handle.handle-se) {
		bottom: -6px;
		right: -6px;
		cursor: nwse-resize;
	}

	.obsidian-live-editor :global(.resize-handle.handle-sw) {
		bottom: -6px;
		left: -6px;
		cursor: nesw-resize;
	}

	.obsidian-live-editor :global(figure.doc-inline-image:hover .resize-handle),
	.obsidian-live-editor :global(figure.doc-inline-image.selected-img .resize-handle) {
		opacity: 1;
	}

	.workspace-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1.25rem;
		border-top: 1.5px solid var(--border-color);
		background: transparent;
		font-size: 0.76rem;
		font-weight: 700;
		color: var(--text-muted);
		flex-shrink: 0;
		gap: 0.75rem;
	}

	.doc-stats-left {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--text-muted);
	}

	.footer-dot {
		margin: 0 0.2rem;
		opacity: 0.5;
	}

	.doc-stats-right {
		font-size: 0.76rem;
		color: var(--text-muted);
	}

	.doc-stats-right strong {
		color: var(--text-color);
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
		scrollbar-width: thin;
		scrollbar-color: var(--border-color) transparent;
		padding-right: 0.15rem;
	}

	.outline-list::-webkit-scrollbar {
		width: 5px;
	}

	.outline-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.outline-list::-webkit-scrollbar-thumb {
		background: var(--border-color);
		border-radius: 9999px;
	}

	.outline-list::-webkit-scrollbar-thumb:hover {
		background: var(--accent-color);
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

		.document-canvas-container {
			padding: 1rem 1rem 2rem 1rem;
		}

		.obsidian-ribbon-bar {
			padding: 0.35rem 0.75rem;
		}

		.workspace-header-bar {
			padding: 0.5rem 0.75rem;
		}

		.workspace-footer {
			padding: 0.35rem 0.75rem;
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

	.trash-banner-info h3 {
		margin: 0;
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

	/* 🏷️ Tag Management Modal */
	.tag-manager-modal {
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		border-bottom: 5px solid var(--border-depth-color);
		border-radius: 24px;
		width: 100%;
		max-width: 480px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
		max-height: 85vh;
		box-sizing: border-box;
	}

	.modal-badge {
		background: var(--accent-light-bg);
		color: var(--accent-color);
		border: 1px solid var(--accent-color);
		border-radius: 9999px;
		font-size: 0.72rem;
		font-weight: 900;
		padding: 0.1rem 0.5rem;
	}

	.modal-search-box {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 12px;
		padding: 0.5rem 0.75rem;
		box-sizing: border-box;
	}

	.modal-search-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-color);
		font-size: 0.85rem;
		font-weight: 700;
	}

	.modal-tags-scroll {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		max-height: 320px;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--border-color) transparent;
		padding-right: 0.2rem;
	}

	.modal-empty-tags {
		text-align: center;
		padding: 2rem 1rem;
		color: var(--text-muted);
		font-size: 0.82rem;
	}

	.modal-empty-tags p {
		font-weight: 800;
		color: var(--text-color);
		margin-bottom: 0.3rem;
	}

	.modal-tag-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 12px;
		gap: 0.5rem;
		transition: all 0.12s ease;
	}

	.modal-tag-row.is-active-filter {
		border-color: var(--accent-color);
		background: var(--accent-light-bg);
	}

	.tag-row-info {
		flex: 1;
		min-width: 0;
	}

	.tag-filter-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: inherit;
		text-align: left;
	}

	.tag-name {
		font-weight: 800;
		font-size: 0.85rem;
		color: var(--text-color);
	}

	.tag-count-pill {
		font-size: 0.68rem;
		font-weight: 800;
		color: var(--text-muted);
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		padding: 0.1rem 0.4rem;
		border-radius: 9999px;
	}

	.tag-row-actions {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.tag-action-btn {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 0.25rem 0.5rem;
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--text-color);
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.tag-action-btn.edit:hover {
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.tag-action-btn.delete:hover {
		border-color: #ef4444;
		color: #ef4444;
		background: rgba(239, 68, 68, 0.12);
	}

	.edit-tag-inline-form {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		width: 100%;
	}

	.edit-tag-input {
		flex: 1;
		background: var(--card-bg);
		border: 1.5px solid var(--accent-color);
		border-radius: 8px;
		padding: 0.3rem 0.5rem;
		font-size: 0.82rem;
		color: var(--text-color);
		outline: none;
	}

	.confirm-rename-btn,
	.cancel-rename-btn {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 0.3rem 0.55rem;
		font-weight: 900;
		cursor: pointer;
		font-size: 0.78rem;
	}

	.confirm-rename-btn:hover {
		border-color: var(--green-color);
		color: var(--green-color);
	}

	.cancel-rename-btn:hover {
		border-color: #ef4444;
		color: #ef4444;
	}

	.modal-footer-box {
		border-top: 1.5px solid var(--border-color);
		padding-top: 0.85rem;
	}

	.modal-add-tag-box {
		display: flex;
		gap: 0.45rem;
	}

	.modal-add-input {
		flex: 1;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 10px;
		padding: 0.45rem 0.65rem;
		font-size: 0.82rem;
		color: var(--text-color);
		outline: none;
	}

	.modal-add-btn {
		padding: 0.45rem 1rem;
		font-size: 0.82rem;
		font-weight: 900;
	}
</style>
