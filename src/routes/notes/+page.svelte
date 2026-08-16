<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { notesStore } from '$lib/stores/notesStore';
	import { getMarkdownStats, extractHeadings, type HeadingItem } from '$lib/utils/markdown';
	import type { Note, NoteSortOption } from '$lib/types/notes';
	import { toastStore } from '$lib/stores/toastStore';
	import { fade, scale } from 'svelte/transition';
	import { uploadImage } from '$lib/utils/imageUploader';
	import { offlineNotesSync, type SyncState } from '$lib/utils/offlineNotesSync';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import {
		markdownToDocHtml,
		docHtmlToMarkdown,
		createInlineImageFigureHtml
	} from '$lib/utils/docConverter';

	import { globalCategoryStore, matchesCategory } from '$lib/stores/globalCategoryStore';
	import { navStore } from '$lib/stores/navStore';

	let { data } = $props();
	let user = $derived(data.user);

	const seed = (() => {
		const list: Note[] = data.initialNotes ?? [];
		return { list };
	})();

	let notes = $state<Note[]>(seed.list);
	let selectedNoteId = $state<string | null>(null);
	let searchQuery = $state('');
	let selectedCategory = $state<string>('ALL');
	let sortOption = $state<NoteSortOption>('custom');

	// Vault category search & picker modal
	let isVaultCatPickerOpen = $state(false);
	let vaultCatSearchQuery = $state('');
	let newCategoryModalInput = $state('');
	let isCreatingCustomCategory = $state(false);
	let customCategoryInput = $state('');

	// Workspace UI states
	let isOutlineOpen = $state(false);
	let isSidebarOpenMobile = $state(true);
	let isVaultCollapsed = $state(false);
	let isAutoSaving = $state(false);
	let isUploadingImage = $state(false);
	let lastSavedTime = $state<string>('');

	// Custom Notes Context Menu (Tasto Destro)
	let contextMenu = $state<{
		isOpen: boolean;
		x: number;
		y: number;
		targetNote: Note | null;
	}>({
		isOpen: false,
		x: 0,
		y: 0,
		targetNote: null
	});

	// Sync engine state
	let syncState = $state<SyncState>('synced');
	let pendingSyncCount = $state(0);

	// Active note local editor state
	let currentTitle = $state('');
	let currentContent = $state('');
	let currentCategory = $state('');
	let currentImages = $state<string[]>([]);
	let currentIsPinned = $state(false);

	let editorEl = $state<HTMLDivElement | null>(null);
	let fileInputEl = $state<HTMLInputElement | null>(null);
	let savedRange: Range | null = null;

	let saveDebounceTimer = $state<ReturnType<typeof setTimeout> | null>(null);

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

			// Intercetta paste globale e chiusura context menu
			window.addEventListener('paste', handleGlobalPaste);
			window.addEventListener('click', closeContextMenu);
			window.addEventListener('keydown', handleGlobalKeydown);
		}

		const unsubSync = offlineNotesSync.subscribe((state, count) => {
			syncState = state;
			pendingSyncCount = count;
		});

		const unsubGlobalCat = globalCategoryStore.subscribe((cat) => {
			if (cat) {
				selectedCategory = cat;
			}
		});

		const unsub = notesStore.subscribe((n) => {
			notes = n;
			if (selectedNoteId === null && n.length > 0) {
				const activeNote = n[0];
				selectedNoteId = activeNote.id;
				selectNote(activeNote);
			}
		});

		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('paste', handleGlobalPaste);
				window.removeEventListener('click', closeContextMenu);
				window.removeEventListener('keydown', handleGlobalKeydown);
			}
			unsubSync();
			unsubGlobalCat();
			unsub();
			if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
		};
	});

	function handleGlobalKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closeContextMenu();
			isVaultCatPickerOpen = false;
		}
	}

	function openNoteContextMenu(e: MouseEvent, note: Note) {
		e.preventDefault();
		e.stopPropagation();
		const menuWidth = 240;
		const menuHeight = 300;
		const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
		const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);
		contextMenu = {
			isOpen: true,
			x: Math.max(10, x),
			y: Math.max(10, y),
			targetNote: note
		};
	}

	function openWorkspaceContextMenu(e: MouseEvent) {
		e.preventDefault();
		const menuWidth = 240;
		const menuHeight = 260;
		const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
		const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);
		contextMenu = {
			isOpen: true,
			x: Math.max(10, x),
			y: Math.max(10, y),
			targetNote: activeNote
		};
	}

	function closeContextMenu() {
		if (contextMenu.isOpen) {
			contextMenu = { isOpen: false, x: 0, y: 0, targetNote: null };
		}
	}

	async function handleCopyNote(note: Note) {
		closeContextMenu();
		const fullText = `# ${note.title}\n\n${note.content || ''}`;
		try {
			await navigator.clipboard.writeText(fullText);
			toastStore.show({ message: `📋 Contenuto di "${note.title}" copiato!`, type: 'success' });
		} catch (e) {
			toastStore.show({ message: '⚠️ Impossibile accedere agli appunti', type: 'error' });
		}
	}

	async function handleDuplicateNote(note: Note) {
		closeContextMenu();
		const copy = await notesStore.createNote({
			title: `${note.title} (Copia)`,
			content: note.content,
			category: note.category,
			images: note.images ? [...note.images] : [],
			isPinned: false
		});
		if (copy) {
			selectNote(copy);
			toastStore.show({ message: `📑 Nota duplicata con successo!`, type: 'success' });
		}
	}

	async function handleTogglePinNote(note: Note) {
		closeContextMenu();
		const newPinned = !note.isPinned;
		await notesStore.updateNote({
			id: note.id,
			isPinned: newPinned
		});
		toastStore.show({
			message: newPinned ? `📌 "${note.title}" fissata in evidenza` : `📌 "${note.title}" rimossa dall'evidenza`,
			type: 'info'
		});
	}

	async function handleDeleteContextNote(note: Note) {
		closeContextMenu();
		if (confirm(`Sei sicuro di voler eliminare "${note.title}"?`)) {
			await notesStore.deleteNote(note.id);
			const remaining = notes.filter((n) => n.id !== note.id);
			if (remaining.length > 0) {
				selectNote(remaining[0]);
			} else {
				selectedNoteId = null;
				currentTitle = '';
				currentContent = '';
				currentCategory = '';
				if (editorEl) editorEl.innerHTML = '';
			}
			toastStore.show({ message: `🗑️ Nota eliminata`, type: 'info' });
		}
	}

	async function handleChangeNoteCategory(note: Note, newCat: string) {
		closeContextMenu();
		const trimmed = newCat.trim();
		if (note.id === selectedNoteId) {
			currentCategory = trimmed;
		}
		await notesStore.updateNote({
			id: note.id,
			category: trimmed
		});
		toastStore.show({ message: `📁 Categoria cambiata in "${trimmed || 'Senza Categoria'}"`, type: 'success' });
	}

	async function handleContextPaste() {
		closeContextMenu();
		if (!selectedNoteId && notes.length > 0) {
			selectNote(notes[0]);
		}
		try {
			if (navigator.clipboard && navigator.clipboard.read) {
				const items = await navigator.clipboard.read();
				for (const item of items) {
					const imageType = item.types.find((t) => t.startsWith('image/'));
					if (imageType) {
						const blob = await item.getType(imageType);
						if (blob && blob.size > 0) {
							await uploadAndInsertImage(blob);
							return;
						}
					}
				}
			}

			if (navigator.clipboard && navigator.clipboard.readText) {
				const text = await navigator.clipboard.readText();
				if (text) {
					if (editorEl) {
						editorEl.focus();
						document.execCommand('insertText', false, text);
						syncContentFromEditor();
						triggerAutoSave();
						toastStore.show({ message: '📋 Testo incollato!', type: 'info' });
					}
				}
			}
		} catch (err: any) {
			console.warn('Errore lettura appunti:', err);
			toastStore.show({ message: '💡 Suggerimento: usa Ctrl+V o Cmd+V per incollare.', type: 'info' });
		}
	}

	function handleCreateCategoryFromModal() {
		const trimmed = newCategoryModalInput.trim();
		if (!trimmed) return;
		selectedCategory = trimmed;
		if (activeNote) {
			currentCategory = trimmed;
			triggerAutoSave();
		}
		newCategoryModalInput = '';
		toastStore.show({ message: `Filtro categoria "${trimmed}" creato!`, type: 'success' });
	}

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
		currentCategory = note.category || '';
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

	// Categorie personali dell'utente (derivate esclusivamente dalle sue note)
	let userNoteCategories = $derived.by<string[]>(() => {
		const set = new Set<string>();
		for (const n of notes) {
			if (n.category && n.category.trim()) {
				set.add(n.category.trim());
			}
		}
		return Array.from(set).sort((a, b) => a.localeCompare(b, 'it'));
	});

	let availableCategories = $derived.by<[string, number][]>(() => {
		const counts = new Map<string, number>();
		for (const catName of userNoteCategories) {
			counts.set(catName, 0);
		}
		for (const n of notes) {
			const cat = n.category?.trim() || 'Senza Categoria';
			counts.set(cat, (counts.get(cat) || 0) + 1);
		}
		return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], 'it'));
	});

	function handleConfirmCustomCategory() {
		const trimmed = customCategoryInput.trim();
		if (!trimmed) {
			isCreatingCustomCategory = false;
			return;
		}
		currentCategory = trimmed;
		isCreatingCustomCategory = false;
		triggerAutoSave();
		toastStore.show({ message: `Nuova categoria "${trimmed}" creata ed applicata!`, type: 'success' });
	}

	let filteredVaultCategories = $derived.by<[string, number][]>(() => {
		const q = vaultCatSearchQuery.toLowerCase().trim();
		if (!q) return availableCategories;
		return availableCategories.filter(([catName]) => catName.toLowerCase().includes(q));
	});

	function toggleVaultCategory(cat: string) {
		if (cat === 'ALL') {
			selectedCategory = 'ALL';
			globalCategoryStore.reset();
			return;
		}

		let selectedList = selectedCategory === 'ALL' || !selectedCategory
			? []
			: selectedCategory.split(',').map((s) => s.trim());

		if (selectedList.includes(cat)) {
			selectedList = selectedList.filter((c) => c !== cat);
		} else {
			selectedList.push(cat);
		}

		if (selectedList.length === 0 || selectedList.length === availableCategories.length) {
			selectedCategory = 'ALL';
			globalCategoryStore.reset();
		} else {
			const val = selectedList.join(',');
			selectedCategory = val;
			globalCategoryStore.setCategory(val);
		}
	}

	let filteredNotes = $derived.by(() => {
		let list = [...notes];

		if (selectedCategory !== 'ALL') {
			list = list.filter((n) => matchesCategory(n.category?.trim() || 'Generale & Varie', selectedCategory));
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
		const defaultCat = selectedCategory !== 'ALL' ? selectedCategory : (userNoteCategories[0] || '');
		const newNote = await notesStore.createNote({
			title: 'Nuovo Appunto',
			content: '',
			category: defaultCat,
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
		toastStore.show({ message: '⏳ Compressione e inserimento immagine...' });

		try {
			const uploadRes = await uploadImage(rawFile, { context: 'note' });

			if (uploadRes.isOffline && uploadRes.blob) {
				// Modalità offline: salva il blob in IndexedDB e usa l'URL blob locale
				const filename = uploadRes.filename || `note-img-${Date.now()}.webp`;
				await notesStore.saveOfflineImageBlob(uploadRes.blob, filename, selectedNoteId);
				insertImageBlockAtCursor(uploadRes.url, '400');
				toastStore.show({ message: '📝 Immagine inserita e salvata in locale (modalità offline)' });
			} else {
				insertImageBlockAtCursor(uploadRes.url, '400');
				toastStore.show({ message: '🖼️ Immagine compressa e inserita nel testo!' });
			}

			syncContentFromEditor();
			triggerAutoSave();
		} catch (err: any) {
			console.error('Errore compressione/upload immagine:', err);
			toastStore.show({ message: `⚠️ ${err.message || 'Impossibile caricare l\'immagine'}` });
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

	let draggedFigure = $state<HTMLElement | null>(null);

	// Gestione dei click sui controlli di allineamento / spostamento / cancellazione dell'immagine inline
	function handleEditorClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target) return;

		// 2. Click pulsante allineamento
		if (target.classList.contains('img-btn-align')) {
			e.preventDefault();
			e.stopPropagation();
			const newAlign = target.getAttribute('data-align') || 'center';
			const figure = target.closest('figure.doc-inline-image') as HTMLElement;
			if (figure) {
				const wrapper = figure.querySelector('.doc-image-wrapper') as HTMLElement;
				figure.setAttribute('data-align', newAlign);
				if (wrapper) {
					wrapper.classList.remove('align-left', 'align-center', 'align-right');
					wrapper.classList.add(`align-${newAlign}`);
				}

				figure.querySelectorAll('.img-btn-align').forEach((btn) => {
					if (btn.getAttribute('data-align') === newAlign) {
						btn.classList.add('active');
					} else {
						btn.classList.remove('active');
					}
				});

				handleEditorInput();
				const alignLabel = newAlign === 'left' ? 'Sinistra' : newAlign === 'right' ? 'Destra' : 'Centro';
				toastStore.show({ message: `📐 Allineamento: ${alignLabel}` });
			}
			return;
		}

		// 3. Click pulsante Sposta Su / Sposta Giù
		if (target.classList.contains('img-btn-move')) {
			e.preventDefault();
			e.stopPropagation();
			const dir = target.getAttribute('data-move');
			const figure = target.closest('figure.doc-inline-image') as HTMLElement;
			if (figure && editorEl) {
				if (dir === 'up') {
					const prev = figure.previousElementSibling;
					if (prev) {
						editorEl.insertBefore(figure, prev);
						handleEditorInput();
						toastStore.show({ message: '⬆️ Immagine spostata sopra' });
					}
				} else if (dir === 'down') {
					const next = figure.nextElementSibling;
					if (next) {
						editorEl.insertBefore(figure, next.nextElementSibling);
						handleEditorInput();
						toastStore.show({ message: '⬇️ Immagine spostata sotto' });
					}
				}
			}
			return;
		}

		// 4. Click pulsante eliminazione immagine
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

	// Gestione interattiva maniglie di ridimensionamento drag stile Word
	function handleEditorMouseDown(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target || !target.classList.contains('resize-handle')) return;

		e.preventDefault();
		e.stopPropagation();

		const figure = target.closest('figure.doc-inline-image') as HTMLElement;
		if (!figure) return;
		const wrapper = figure.querySelector('.doc-image-wrapper') as HTMLElement;
		if (!wrapper) return;

		const startX = e.clientX;
		const startWidth = wrapper.offsetWidth;
		const isSouthWest = target.classList.contains('handle-sw');

		function onMouseMove(moveEvent: MouseEvent) {
			const delta = isSouthWest ? startX - moveEvent.clientX : moveEvent.clientX - startX;
			const maxContainerWidth = (editorEl?.clientWidth || 700) - 20;
			const newWidth = Math.max(120, Math.min(maxContainerWidth, Math.round(startWidth + delta)));

			wrapper.style.maxWidth = `${newWidth}px`;
			figure.setAttribute('data-width', String(newWidth));
		}

		function onMouseUp() {
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onMouseUp);
			handleEditorInput();
		}

		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);
	}

	function handleEditorTouchStart(e: TouchEvent) {
		const target = e.target as HTMLElement;
		if (!target || !target.classList.contains('resize-handle')) return;

		const touch = e.touches[0];
		if (!touch) return;

		e.stopPropagation();

		const figure = target.closest('figure.doc-inline-image') as HTMLElement;
		if (!figure) return;
		const wrapper = figure.querySelector('.doc-image-wrapper') as HTMLElement;
		if (!wrapper) return;

		const startX = touch.clientX;
		const startWidth = wrapper.offsetWidth;
		const isSouthWest = target.classList.contains('handle-sw');

		function onTouchMove(moveEvent: TouchEvent) {
			const moveTouch = moveEvent.touches[0];
			if (!moveTouch) return;
			const delta = isSouthWest ? startX - moveTouch.clientX : moveTouch.clientX - startX;
			const maxContainerWidth = (editorEl?.clientWidth || 360) - 20;
			const newWidth = Math.max(120, Math.min(maxContainerWidth, Math.round(startWidth + delta)));

			wrapper.style.maxWidth = `${newWidth}px`;
			figure.setAttribute('data-width', String(newWidth));
		}

		function onTouchEnd() {
			window.removeEventListener('touchmove', onTouchMove);
			window.removeEventListener('touchend', onTouchEnd);
			handleEditorInput();
		}

		window.addEventListener('touchmove', onTouchMove, { passive: true });
		window.addEventListener('touchend', onTouchEnd);
	}

	// Gestione Drag & Drop reordering delle immagini nel testo
	function handleFigureDragStart(e: DragEvent) {
		const target = e.target as HTMLElement;
		const figure = target?.closest('figure.doc-inline-image') as HTMLElement;
		if (figure && e.dataTransfer) {
			draggedFigure = figure;
			figure.classList.add('is-dragging');
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', figure.getAttribute('data-url') || '');
		}
	}

	function handleFigureDragOver(e: DragEvent) {
		if (!draggedFigure) return;
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
	}

	function handleFigureDrop(e: DragEvent) {
		if (!draggedFigure || !editorEl) return;
		e.preventDefault();
		e.stopPropagation();

		const target = e.target as HTMLElement;
		const dropBlock = target.closest('p, h1, h2, h3, blockquote, figure, ul, ol, div') as HTMLElement;

		if (dropBlock && dropBlock !== draggedFigure && dropBlock.parentNode === editorEl) {
			const rect = dropBlock.getBoundingClientRect();
			const isAfter = e.clientY > rect.top + rect.height / 2;
			if (isAfter) {
				editorEl.insertBefore(draggedFigure, dropBlock.nextSibling);
			} else {
				editorEl.insertBefore(draggedFigure, dropBlock);
			}
		} else {
			editorEl.appendChild(draggedFigure);
		}

		draggedFigure.classList.remove('is-dragging');
		draggedFigure = null;
		handleEditorInput();
		toastStore.show({ message: '📍 Immagine riposizionata' });
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

	// Gestione evento Drag & Drop di file esterni dall'OS
	function handleDrop(e: DragEvent) {
		if (draggedFigure) {
			handleFigureDrop(e);
			return;
		}

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

<div class="notes-page-wrapper">
	<div class="notes-header-container" class:is-collapsed={isVaultCollapsed}>
		<PageHeader
			title="Vault Appunti Cloud"
			subtitle="Salva le tue note e sincronizzale ovunque tu sia su tutti i tuoi dispositivi."
			icon="/emoji/clipboard_3d.png"
			variant="red"
			mobileOpenNav={true}
		/>
	</div>

	{#if user}
		<div
			class="obsidian-workspace"
			class:vault-collapsed={isVaultCollapsed}
			onkeydown={handleKeyDown}
			role="presentation"
		>
	<!-- 🗂️ 1. LEFT VAULT EXPLORER -->
	<aside
		class="vault-sidebar duo-card"
		class:collapsed={isVaultCollapsed}
		class:mobile-hidden={!isSidebarOpenMobile && selectedNoteId !== null}
	>
			<!-- Vault Explorer Header -->
			<div class="vault-header">
				<button
					type="button"
					class="mobile-vault-nav-btn"
					onclick={() => navStore.open()}
					aria-label="Menu navigazione"
					title="Apri menu navigazione"
				>
					<span class="vault-nav-lines">
						<span></span>
						<span></span>
						<span></span>
					</span>
				</button>

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

			<!-- Folders Chips & Smart Category Selector -->
			<div class="vault-folders-bar">
				<!-- Trigger for Category Modal Picker with Search -->
				<button
					type="button"
					class="vault-cat-trigger-btn full-width"
					class:active={selectedCategory !== 'ALL'}
					onclick={() => (isVaultCatPickerOpen = true)}
					title="Apri filtro categorie con ricerca rapida"
				>
					<div class="vcat-left">
						<span class="vcat-ico">📁</span>
						<span class="vcat-label">Categorie</span>
					</div>
					<div class="vcat-right">
						<span class="vcat-badge">
							{#if selectedCategory === 'ALL'}
								Tutti ({notes.length})
							{:else}
								{selectedCategory.split(',').length} attive
							{/if}
						</span>
						<span class="vcat-arrow">▾</span>
					</div>
				</button>
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
							oncontextmenu={(e) => openNoteContextMenu(e, note)}
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
								<span class="file-cat">{note.category || 'Senza Categoria'}</span>
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

	<!-- 📝 2. CENTER MAIN WORKSPACE (EDITOR VISUALE WORD-STYLE CON IMMAGINI INTEGRATE NEL TESTO) -->
	<main
		class="note-workspace-pane duo-card"
		class:mobile-hidden={isSidebarOpenMobile && selectedNoteId !== null}
		oncontextmenu={openWorkspaceContextMenu}
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

					{#if currentCategory}
						<button
							type="button"
							class="workspace-category-pill"
							title="Categoria dell'appunto (Clicca per filtri o Tasto destro per opzioni)"
							onclick={() => (isVaultCatPickerOpen = true)}
							oncontextmenu={(e) => openNoteContextMenu(e, activeNote!)}
						>
							<span class="cat-pill-ico">📁</span>
							<span class="cat-pill-txt">{currentCategory}</span>
						</button>
					{/if}

					<div class="save-status-pill">
						{#if isAutoSaving}
							<span class="saving-txt">⏳ Salvataggio...</span>
						{:else}
							<span class="saved-txt">💾 {lastSavedTime ? `Salvato ${lastSavedTime}` : 'Salvato'}</span>
						{/if}
					</div>

					<!-- Cloud / Offline Sync Status Interactive Badge -->
					<button
						type="button"
						class="sync-status-badge-btn"
						class:is-synced={syncState === 'synced'}
						class:is-syncing={syncState === 'syncing'}
						class:is-pending={syncState === 'pending'}
						class:is-offline={syncState === 'offline'}
						onclick={() => notesStore.syncNow()}
						title="Stato sincronizzazione Cloud & Offline (Clicca per forzare il sync)"
					>
						{#if syncState === 'syncing'}
							<span class="sync-icon-spin">🔄</span>
							<span class="sync-btn-txt">Sincronizzazione...</span>
						{:else if syncState === 'pending'}
							<span class="sync-status-dot pending"></span>
							<span class="sync-btn-txt">{pendingSyncCount} in sospeso (Sync)</span>
						{:else if syncState === 'offline'}
							<span class="sync-status-dot offline"></span>
							<span class="sync-btn-txt">Offline (Locale)</span>
						{:else}
							<span class="sync-status-dot synced"></span>
							<span class="sync-btn-txt">Cloud Sincronizzato</span>
						{/if}
					</button>
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
					onmousedown={handleEditorMouseDown}
					ontouchstart={handleEditorTouchStart}
					ondragstart={handleFigureDragStart}
					ondragover={handleFigureDragOver}
					ondrop={handleDrop}
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

	<!-- 🗂️ Modal / Popover Selettore Categorie per il Vault -->
	{#if isVaultCatPickerOpen}
		<div
			class="vault-cat-backdrop"
			onclick={() => (isVaultCatPickerOpen = false)}
			onkeydown={(e) => e.key === 'Escape' && (isVaultCatPickerOpen = false)}
			role="button"
			tabindex="0"
			aria-label="Chiudi selettore categorie"
			transition:fade={{ duration: 120 }}
		></div>

		<div
			class="vault-cat-modal duo-card"
			transition:scale={{ start: 0.95, duration: 150 }}
		>
			<div class="vcat-modal-header">
				<div class="vcat-modal-title">
					<span class="vcat-modal-ico">📁</span>
					<div>
						<h3 class="vcat-heading">Categorie Appunti</h3>
						<span class="vcat-sub">
							{#if selectedCategory === 'ALL'}
								Tutte le {availableCategories.length} categorie
							{:else}
								{selectedCategory.split(',').length} di {availableCategories.length} selezionate
							{/if}
						</span>
					</div>
				</div>
				<button
					type="button"
					class="vcat-close-btn"
					onclick={() => (isVaultCatPickerOpen = false)}
					aria-label="Chiudi"
				>
					✕
				</button>
			</div>

			<!-- Live Search -->
			<div class="vcat-search-box">
				<span class="vsearch-ico">🔍</span>
				<input
					type="text"
					bind:value={vaultCatSearchQuery}
					placeholder="Cerca tra le {availableCategories.length} categorie..."
					class="vcat-search-input"
				/>
				{#if vaultCatSearchQuery}
					<button
						type="button"
						class="vsearch-clear"
						onclick={() => (vaultCatSearchQuery = '')}
					>
						✕
					</button>
				{/if}
			</div>

			<!-- Quick Batch Actions -->
			<div class="vcat-batch-row">
				<button
					type="button"
					class="vcat-batch-btn"
					class:active-batch={selectedCategory === 'ALL'}
					onclick={() => toggleVaultCategory('ALL')}
				>
					📁 Tutte ({notes.length})
				</button>
				<button
					type="button"
					class="vcat-batch-btn"
					onclick={() => {
						selectedCategory = 'ALL';
						globalCategoryStore.reset();
					}}
				>
					✕ Azzera filtri
				</button>
			</div>

			<!-- Category List -->
			<div class="vcat-list">
				{#if filteredVaultCategories.length === 0}
					<p class="vcat-empty">Nessuna categoria trovata per "{vaultCatSearchQuery}"</p>
				{:else}
					{#each filteredVaultCategories as [catName, count]}
						{@const isSelected = selectedCategory !== 'ALL' && selectedCategory.split(',').map((s) => s.trim()).includes(catName)}
						<button
							type="button"
							class="vcat-item-btn"
							class:checked={isSelected}
							onclick={() => toggleVaultCategory(catName)}
						>
							<div class="vcat-checkbox" class:checked={isSelected}>
								{#if isSelected}✓{/if}
							</div>
							<span class="vcat-item-name">{catName}</span>
							<span class="vcat-item-count">{count} {count === 1 ? 'nota' : 'note'}</span>
						</button>
					{/each}
				{/if}
			</div>

			<!-- Create New Category Filter Row -->
			<div class="vcat-create-row">
				<input
					type="text"
					bind:value={newCategoryModalInput}
					placeholder="➕ Crea nuova categoria..."
					class="vcat-create-input"
					onkeydown={(e) => {
						if (e.key === 'Enter') handleCreateCategoryFromModal();
					}}
				/>
				<button
					type="button"
					class="vcat-create-btn duo-btn duo-btn-blue"
					onclick={handleCreateCategoryFromModal}
					disabled={!newCategoryModalInput.trim()}
				>
					+ Aggiungi
				</button>
			</div>

			<!-- Footer -->
			<div class="vcat-modal-footer">
				<button
					type="button"
					class="duo-btn duo-btn-green vcat-apply-btn"
					onclick={() => (isVaultCatPickerOpen = false)}
				>
					✓ CONFERMA ({selectedCategory === 'ALL' ? 'Tutte' : `${selectedCategory.split(',').length} attive`})
				</button>
			</div>
		</div>
	{/if}

	<!-- 🖱️ Custom Context Menu per la sezione Note (Tasto Destro) -->
	{#if contextMenu.isOpen}
		<div
			class="notes-custom-context-menu duo-card"
			style="top: {contextMenu.y}px; left: {contextMenu.x}px;"
			transition:scale={{ start: 0.92, duration: 120 }}
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="menu"
			tabindex="-1"
		>
			{#if contextMenu.targetNote}
				<div class="ctx-header">
					<span class="ctx-note-title">{contextMenu.targetNote.title || 'Appunto'}</span>
					<span class="ctx-note-cat">📁 {contextMenu.targetNote.category || 'Senza Categoria'}</span>
				</div>
				<div class="ctx-divider"></div>

				<button type="button" class="ctx-item" onclick={() => handleTogglePinNote(contextMenu.targetNote!)}>
					<span class="ctx-icon">{contextMenu.targetNote.isPinned ? '📌' : '📍'}</span>
					<span>{contextMenu.targetNote.isPinned ? 'Rimuovi evidenza' : 'Fissa in alto'}</span>
				</button>

				<button type="button" class="ctx-item" onclick={() => handleCopyNote(contextMenu.targetNote!)}>
					<span class="ctx-icon">📋</span>
					<span>Copia testo appunto</span>
				</button>

				<button type="button" class="ctx-item" onclick={() => handleDuplicateNote(contextMenu.targetNote!)}>
					<span class="ctx-icon">📑</span>
					<span>Duplica appunto</span>
				</button>

				<!-- Submenu Categoria -->
				<div class="ctx-item ctx-category-container">
					<span class="ctx-icon">📁</span>
					<select
						class="ctx-cat-select"
						value={contextMenu.targetNote.category || ''}
						onchange={(e) => {
							const val = (e.target as HTMLSelectElement).value;
							if (val === '__CREATE_NEW__') {
								closeContextMenu();
								isVaultCatPickerOpen = true;
							} else {
								handleChangeNoteCategory(contextMenu.targetNote!, val);
							}
						}}
					>
						<option value="" disabled>📁 Assegna Categoria...</option>
						{#each userNoteCategories as cat}
							<option value={cat}>{cat}</option>
						{/each}
						<option value="">(Nessuna categoria)</option>
						<option value="__CREATE_NEW__">➕ Crea Nuova Categoria...</option>
					</select>
				</div>

				<div class="ctx-divider"></div>

				<button type="button" class="ctx-item" onclick={handleContextPaste}>
					<span class="ctx-icon">📥</span>
					<span>Incolla dagli appunti</span>
				</button>

				<button type="button" class="ctx-item ctx-danger" onclick={() => handleDeleteContextNote(contextMenu.targetNote!)}>
					<span class="ctx-icon">🗑️</span>
					<span>Elimina appunto</span>
				</button>
			{:else}
				<button type="button" class="ctx-item" onclick={handleCreateNewNote}>
					<span class="ctx-icon">➕</span>
					<span>Nuovo appunto</span>
				</button>

				<button type="button" class="ctx-item" onclick={handleContextPaste}>
					<span class="ctx-icon">📥</span>
					<span>Incolla dagli appunti</span>
				</button>

				{#if activeNote}
					<button type="button" class="ctx-item" onclick={() => handleCopyNote(activeNote)}>
						<span class="ctx-icon">📋</span>
						<span>Copia appunto corrente</span>
					</button>
					<button type="button" class="ctx-item" onclick={() => handleDuplicateNote(activeNote)}>
						<span class="ctx-icon">📑</span>
						<span>Duplica appunto corrente</span>
					</button>
					<div class="ctx-divider"></div>
					<button type="button" class="ctx-item ctx-danger" onclick={handleDeleteActiveNote}>
						<span class="ctx-icon">🗑️</span>
						<span>Elimina appunto corrente</span>
					</button>
				{/if}
			{/if}
		</div>
	{/if}
</div>
{:else}
	<div class="login-page-container">
		{#if data?.error === 'admin_required'}
			<div class="login-error-alert duo-card">
				<span class="error-icon">⚠️</span>
				<div class="error-text-col">
					<strong>Accesso Riservato agli Amministratori</strong>
					<p>Per accedere a quella sezione è necessario effettuare il login con un account Discord autorizzato.</p>
				</div>
			</div>
		{/if}

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
				<a href="/api/auth/login?returnUrl=/notes" class="duo-btn discord-login-btn hero-action-btn">
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
				</a>
			</div>
		</div>
	</div>
{/if}
</div>

<style>
	.notes-page-wrapper {
		width: 100%;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
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
			opacity 0.28s ease,
			transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
			margin 0.3s ease;
		overflow: hidden;
	}

	.notes-header-container.is-collapsed {
		max-height: 0;
		opacity: 0;
		transform: translateY(-20px) scale(0.98);
		margin-bottom: 0;
		pointer-events: none;
	}

	/* 📐 Main Obsidian Workspace Flex Container */
	.obsidian-workspace {
		display: flex;
		flex-direction: row;
		align-items: stretch;
		gap: 0.75rem;
		height: calc(100vh - 180px);
		height: calc(100dvh - 180px);
		min-height: 420px;
		width: 100%;
		max-width: 100%;
		margin: 0 auto;
		box-sizing: border-box;
		overflow: hidden;
		position: relative;
		transition: height 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.obsidian-workspace.vault-collapsed {
		height: calc(100vh - 80px);
		height: calc(100dvh - 80px);
	}

	@media (max-width: 1023px) {
		.obsidian-workspace {
			height: calc(100vh - 150px);
			height: calc(100dvh - 150px);
		}

		.obsidian-workspace.vault-collapsed {
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

	.mobile-vault-nav-btn {
		display: none;
		align-items: center;
		justify-content: center;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 8px;
		width: 30px;
		height: 28px;
		cursor: pointer;
		padding: 0;
		flex-shrink: 0;
	}

	.vault-nav-lines {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		width: 14px;
		height: 10px;
	}

	.vault-nav-lines span {
		display: block;
		width: 100%;
		height: 1.8px;
		background-color: var(--text-color);
		border-radius: 2px;
	}

	@media (max-width: 1023px) {
		.mobile-vault-nav-btn {
			display: inline-flex;
		}
	}

	.vault-title-group {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		min-width: 0;
		flex: 1;
	}

	.vault-icon {
		font-size: 0.95rem;
		flex-shrink: 0;
	}

	.vault-name {
		font-family: 'Outfit', sans-serif;
		font-size: 0.78rem;
		font-weight: 900;
		letter-spacing: 0.03em;
		color: var(--text-color);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.vault-badge {
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		border-radius: 9999px;
		padding: 0.1rem 0.45rem;
		font-size: 0.68rem;
		font-weight: 800;
		color: var(--accent-color);
		flex-shrink: 0;
		margin-left: 0.15rem;
	}

	.vault-header-actions {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-shrink: 0;
	}

	.new-note-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		height: 28px;
		padding: 0 0.55rem;
		font-size: 0.72rem;
		font-weight: 800;
		font-family: 'Outfit', sans-serif;
		letter-spacing: 0.02em;
		border-radius: 8px;
		background: var(--green-color);
		border: 1.5px solid var(--green-depth);
		border-bottom: 2.5px solid var(--green-depth);
		color: #ffffff;
		cursor: pointer;
		user-select: none;
		white-space: nowrap;
		transition: all 0.12s ease;
	}

	.new-note-btn:hover {
		background: #61df02;
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

	.vault-folders-bar {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 2px 0 4px 0;
		flex-shrink: 0;
		flex-wrap: wrap;
	}

	.vault-cat-trigger-btn {
		display: inline-flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.35rem;
		padding: 0.35rem 0.65rem;
		border-radius: 10px;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		color: var(--text-color);
		font-family: 'Outfit', sans-serif;
		font-size: 0.76rem;
		font-weight: 800;
		cursor: pointer;
		white-space: nowrap;
		flex-shrink: 0;
		transition: all 0.12s ease;
		box-sizing: border-box;
	}

	.vault-cat-trigger-btn.full-width {
		width: 100%;
	}

	.vault-cat-trigger-btn:hover {
		border-color: var(--accent-color);
		color: var(--accent-color);
		background: var(--hover-bg);
	}

	.vault-cat-trigger-btn.active {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.vcat-left {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.vcat-right {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.vcat-badge {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		padding: 0.05rem 0.35rem;
		font-size: 0.65rem;
		font-weight: 900;
		color: var(--accent-color);
	}

	.vcat-arrow {
		font-size: 0.7rem;
		opacity: 0.6;
	}



	/* 🗂️ Vault Category Modal Styles */
	.vault-cat-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		z-index: 500;
	}

	.vault-cat-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 90vw;
		max-width: 440px;
		max-height: 80vh;
		background: var(--card-bg);
		border-radius: 22px;
		border: 2px solid var(--border-color);
		border-bottom: 6px solid var(--border-depth-color);
		box-shadow: 0 20px 48px rgba(0, 0, 0, 0.45);
		z-index: 510;
		padding: 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		box-sizing: border-box;
	}

	.vcat-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.4rem;
		border-bottom: 2px solid var(--border-color);
	}

	.vcat-modal-title {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.vcat-modal-ico {
		font-size: 1.2rem;
	}

	.vcat-heading {
		font-family: 'Outfit', sans-serif;
		font-size: 1.05rem;
		font-weight: 900;
		margin: 0;
		color: var(--text-color);
	}

	.vcat-sub {
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--text-muted);
	}

	.vcat-close-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 10px;
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 900;
		cursor: pointer;
	}

	.vcat-search-box {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-radius: 12px;
		padding: 0.4rem 0.65rem;
	}

	.vsearch-ico {
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.vcat-search-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-color);
		font-family: 'Outfit', sans-serif;
		font-size: 0.85rem;
		font-weight: 700;
	}

	.vsearch-clear {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 0.85rem;
		cursor: pointer;
	}

	.vcat-batch-row {
		display: flex;
		gap: 0.35rem;
	}

	.vcat-batch-btn {
		flex: 1;
		padding: 0.35rem 0.5rem;
		border-radius: 9px;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		color: var(--text-muted);
		font-family: 'Outfit', sans-serif;
		font-size: 0.72rem;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.vcat-batch-btn:hover {
		color: var(--text-color);
		border-color: var(--accent-color);
	}

	.vcat-batch-btn.active-batch {
		background: var(--accent-light-bg);
		color: var(--accent-color);
		border-color: var(--accent-color);
	}

	.vcat-list {
		flex: 1;
		overflow-y: auto;
		max-height: 230px;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding-right: 0.15rem;
	}

	.vcat-empty {
		text-align: center;
		padding: 1.2rem;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.vcat-item-btn {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.5rem 0.65rem;
		border-radius: 11px;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		color: var(--text-color);
		cursor: pointer;
		text-align: left;
		transition: all 0.12s ease;
		user-select: none;
	}

	.vcat-item-btn:hover {
		background: var(--hover-bg);
		border-color: var(--accent-color);
	}

	.vcat-item-btn.checked {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.vcat-checkbox {
		width: 18px;
		height: 18px;
		border-radius: 5px;
		border: 2px solid var(--border-color);
		background: var(--card-bg);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		font-weight: 900;
		color: #ffffff;
		flex-shrink: 0;
		transition: all 0.12s ease;
	}

	.vcat-checkbox.checked {
		background: var(--accent-color);
		border-color: var(--accent-color);
	}

	.vcat-item-name {
		font-family: 'Outfit', sans-serif;
		font-size: 0.82rem;
		font-weight: 800;
		flex: 1;
	}

	.vcat-item-count {
		font-size: 0.68rem;
		font-weight: 800;
		color: var(--text-muted);
	}

	.vcat-modal-footer {
		padding-top: 0.25rem;
		border-top: 1.5px solid var(--border-color);
	}

	.vcat-apply-btn {
		width: 100%;
		padding: 0.65rem;
		font-size: 0.85rem;
		font-weight: 900;
		justify-content: center;
	}

	.vault-files-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding-right: 0.15rem;
	}

	.vault-file-item {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-left: 3.5px solid transparent;
		border-radius: 12px;
		padding: 0.55rem 0.7rem;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		text-align: left;
		transition: all 0.15s ease;
		box-sizing: border-box;
	}

	.vault-file-item:hover {
		background: var(--hover-bg);
		border-color: var(--accent-color);
	}

	.vault-file-item.active {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		border-left-color: var(--accent-color);
		box-shadow: 0 2px 8px var(--shadow-color);
	}

	.file-item-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
	}

	.file-title {
		font-family: 'Outfit', sans-serif;
		font-size: 0.86rem;
		font-weight: 800;
		color: var(--text-color);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex: 1;
		min-width: 0;
	}

	.pin-ico {
		font-size: 0.75rem;
		flex-shrink: 0;
	}

	.file-cat {
		font-size: 0.62rem;
		font-weight: 800;
		text-transform: uppercase;
		color: var(--accent-color);
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		padding: 0.1rem 0.35rem;
		white-space: nowrap;
		flex-shrink: 0;
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
		flex: 1 1 0%;
		min-width: 0;
		width: 100%;
		display: flex;
		flex-direction: column;
		background: var(--card-bg);
		border-radius: 18px;
		padding: 0.85rem 1.15rem;
		overflow: hidden;
		height: 100%;
		box-sizing: border-box;
		gap: 0.5rem;
		border: 2px solid var(--border-color);
		border-bottom: 4px solid var(--border-depth-color);
	}

	.workspace-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding-bottom: 0.45rem;
		border-bottom: 1.5px solid var(--border-color);
		flex-shrink: 0;
		min-height: 38px;
	}

	.workspace-header-left {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}

	.mobile-back-btn {
		display: none;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-bottom: 2.5px solid var(--border-depth-color);
		border-radius: 8px;
		padding: 0 0.6rem;
		height: 32px;
		font-size: 0.76rem;
		font-weight: 800;
		color: var(--accent-color);
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.12s ease;
	}

	@media (max-width: 1023px) {
		.mobile-back-btn {
			display: inline-flex;
			align-items: center;
		}
	}

	.workspace-category-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 8px;
		padding: 0 0.55rem;
		height: 32px;
		box-sizing: border-box;
		user-select: none;
	}

	.cat-pill-ico {
		font-size: 0.82rem;
		flex-shrink: 0;
	}

	.cat-pill-txt {
		font-size: 0.76rem;
		font-weight: 800;
		color: var(--accent-color);
		white-space: nowrap;
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.save-status-pill {
		font-size: 0.72rem;
		font-weight: 700;
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		padding: 0.15rem 0.55rem;
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		height: 32px;
		box-sizing: border-box;
	}

	.saving-txt {
		color: var(--orange-color);
	}

	.saved-txt {
		color: var(--text-muted);
	}

	.sync-status-badge-btn {
		font-size: 0.72rem;
		font-weight: 800;
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.15rem 0.6rem;
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		height: 32px;
		box-sizing: border-box;
		cursor: pointer;
		color: var(--text-color);
		transition: all 0.15s ease;
	}

	.sync-status-badge-btn:hover {
		background: var(--btn-hover-bg, rgba(255, 255, 255, 0.08));
		border-color: var(--accent-color);
		transform: translateY(-1px);
	}

	.sync-status-badge-btn.is-synced {
		border-color: rgba(46, 204, 113, 0.35);
	}

	.sync-status-badge-btn.is-pending {
		border-color: rgba(241, 196, 15, 0.5);
		background: rgba(241, 196, 15, 0.08);
	}

	.sync-status-badge-btn.is-offline {
		border-color: rgba(231, 76, 60, 0.5);
		background: rgba(231, 76, 60, 0.08);
	}

	.sync-status-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.sync-status-dot.synced {
		background: #2ecc71;
		box-shadow: 0 0 6px #2ecc71;
	}

	.sync-status-dot.pending {
		background: #f1c40f;
		box-shadow: 0 0 6px #f1c40f;
		animation: pulse-dot 1.5s infinite;
	}

	.sync-status-dot.offline {
		background: #e74c3c;
		box-shadow: 0 0 6px #e74c3c;
	}

	.sync-icon-spin {
		display: inline-block;
		animation: spin-icon 1s linear infinite;
	}

	@keyframes spin-icon {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	@keyframes pulse-dot {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.4; transform: scale(0.85); }
	}


	.workspace-quick-actions {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-shrink: 0;
	}

	.action-icon-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-bottom: 2.5px solid var(--border-depth-color);
		border-radius: 9px;
		width: 32px;
		height: 32px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--text-color);
		font-size: 0.88rem;
		cursor: pointer;
		transition: all 0.12s ease;
		user-select: none;
	}

	.action-icon-btn:hover {
		background: var(--hover-bg);
		border-color: var(--accent-color);
	}

	.action-icon-btn:active {
		transform: translateY(1.5px);
		border-bottom-width: 1px;
	}

	.action-icon-btn.pinned {
		background: rgba(255, 150, 0, 0.18);
		border-color: var(--orange-color);
		border-bottom-color: var(--orange-depth);
	}

	.delete-btn:hover {
		background: rgba(255, 75, 75, 0.18);
		border-color: #ff5e5b;
		border-bottom-color: #ea2b2b;
	}

	/* Ribbon formatting bar */
	.obsidian-ribbon-bar {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 12px;
		padding: 0.25rem 0.4rem;
		overflow-x: auto;
		flex-shrink: 0;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
		height: 38px;
		box-sizing: border-box;
	}

	.obsidian-ribbon-bar::-webkit-scrollbar {
		display: none;
	}

	.ribbon-btn {
		background: transparent;
		border: 1px solid transparent;
		border-radius: 7px;
		height: 28px;
		padding: 0 0.55rem;
		font-size: 0.74rem;
		font-weight: 800;
		color: var(--text-color);
		cursor: pointer;
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		transition: all 0.12s ease;
		flex-shrink: 0;
	}

	.ribbon-btn:hover {
		background: var(--card-bg);
		border-color: var(--border-color);
	}

	.ribbon-btn:active {
		transform: scale(0.95);
	}

	.ribbon-sep {
		width: 1px;
		height: 16px;
		background: var(--border-color);
		margin: 0 0.1rem;
		flex-shrink: 0;
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
		padding: 0.15rem 0 0.1rem 0;
		flex-shrink: 0;
	}

	.obsidian-title-input {
		width: 100%;
		background: transparent;
		border: none;
		outline: none;
		font-family: 'Outfit', sans-serif;
		font-size: 1.4rem;
		font-weight: 900;
		color: var(--text-color);
		padding: 0 0 0.2rem 0;
		letter-spacing: -0.01em;
		border-bottom: 2px solid transparent;
		transition: border-color 0.2s ease;
	}

	.obsidian-title-input:focus {
		border-bottom-color: var(--accent-color);
	}

	/* 📄 Word-Style Document Canvas */
	.document-canvas-container {
		flex: 1;
		min-height: 0;
		display: flex;
		overflow-y: auto;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 14px;
		padding: 1.25rem 1.6rem;
		box-sizing: border-box;
	}

	.word-document-editor {
		width: 100%;
		min-height: 100%;
		outline: none;
		color: var(--text-color);
		font-family: 'Outfit', 'Plus Jakarta Sans', sans-serif;
		font-size: 0.96rem;
		line-height: 1.48;
		word-break: break-word;
	}

	.word-document-editor :global(p),
	.word-document-editor :global(div:not(.doc-image-wrapper):not(.doc-image-toolbar)) {
		margin: 0.12rem 0;
		min-height: 1.25em;
		line-height: 1.48;
	}

	.word-document-editor :global(h1) {
		font-size: 1.35rem;
		font-weight: 900;
		color: var(--accent-color);
		margin: 0.65rem 0 0.2rem 0;
		line-height: 1.3;
	}

	.word-document-editor :global(h2) {
		font-size: 1.2rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0.55rem 0 0.18rem 0;
		line-height: 1.3;
	}

	.word-document-editor :global(h3) {
		font-size: 1.08rem;
		font-weight: 800;
		color: var(--text-color);
		margin: 0.45rem 0 0.15rem 0;
		line-height: 1.3;
	}

	.word-document-editor :global(ul),
	.word-document-editor :global(ol) {
		margin: 0.2rem 0;
		padding-left: 1.3rem;
	}

	.word-document-editor :global(li) {
		margin: 0.06rem 0;
		line-height: 1.45;
	}

	.word-document-editor :global(blockquote) {
		margin: 0.35rem 0;
		padding: 0.35rem 0.75rem;
		border-left: 4px solid var(--accent-color);
		background: var(--accent-light-bg);
		border-radius: 0 8px 8px 0;
		font-style: italic;
		line-height: 1.45;
	}

	.word-document-editor :global(code) {
		background: var(--card-bg);
		padding: 0.12rem 0.3rem;
		border-radius: 4px;
		font-family: monospace;
		font-size: 0.88em;
	}

	.word-document-editor :global(mark) {
		background: rgba(255, 230, 0, 0.3);
		padding: 0 0.2rem;
		border-radius: 3px;
	}

	/* 🖼️ INLINE IMAGE FIGURE IN MEZZO AL TESTO (Word-Style) */
	.word-document-editor :global(figure.doc-inline-image) {
		margin: 0.65rem 0;
		display: flex;
		flex-direction: column;
		width: 100%;
		user-select: none;
		transition: opacity 0.15s ease;
	}

	.word-document-editor :global(figure.doc-inline-image.is-dragging) {
		opacity: 0.4;
		outline: 2px dashed var(--accent-color);
		outline-offset: 4px;
		border-radius: 12px;
	}

	.word-document-editor :global(.doc-image-wrapper) {
		position: relative;
		display: inline-block;
		width: 100%;
		border-radius: 12px;
		border: 2px solid var(--border-color);
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
		background: #000;
		transition: max-width 0.1s ease-out, border-color 0.15s ease;
	}

	.word-document-editor :global(.doc-image-wrapper:hover) {
		border-color: var(--accent-color);
	}

	.word-document-editor :global(.doc-image-wrapper.align-center) {
		margin: 0 auto;
	}

	.word-document-editor :global(.doc-image-wrapper.align-left) {
		margin: 0 auto 0 0;
	}

	.word-document-editor :global(.doc-image-wrapper.align-right) {
		margin: 0 0 0 auto;
	}

	.word-document-editor :global(.doc-img-element) {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 10px;
		object-fit: contain;
		pointer-events: none;
	}

	/* Maniglie di Ridimensionamento Interattive Stile Word */
	.word-document-editor :global(.resize-handle) {
		position: absolute;
		width: 14px;
		height: 14px;
		background: var(--accent-color);
		border: 2.5px solid #ffffff;
		border-radius: 4px;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
		z-index: 20;
		opacity: 0;
		transition: opacity 0.15s ease, transform 0.1s ease;
	}

	.word-document-editor :global(.doc-image-wrapper:hover .resize-handle),
	.word-document-editor :global(.resize-handle:hover) {
		opacity: 1;
	}

	.word-document-editor :global(.resize-handle.handle-se) {
		bottom: -6px;
		right: -6px;
		cursor: nwse-resize;
	}

	.word-document-editor :global(.resize-handle.handle-sw) {
		bottom: -6px;
		left: -6px;
		cursor: nesw-resize;
	}

	.word-document-editor :global(.resize-handle:hover) {
		transform: scale(1.25);
	}

	/* Toolbar Fluttuante Word-Style */
	.word-document-editor :global(.doc-image-toolbar) {
		position: absolute;
		bottom: 8px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(15, 23, 42, 0.94);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1.5px solid rgba(255, 255, 255, 0.22);
		border-radius: 9999px;
		padding: 0.25rem 0.55rem;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
		z-index: 20;
		opacity: 0.95;
		width: max-content;
		max-width: calc(100vw - 32px);
		white-space: nowrap;
		flex-wrap: nowrap;
		justify-content: center;
		transition: opacity 0.15s ease, transform 0.15s ease;
	}

	.word-document-editor :global(.doc-image-wrapper:hover .doc-image-toolbar) {
		opacity: 1;
	}

	.word-document-editor :global(.img-btn-move) {
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 6px;
		color: #e5e7eb;
		font-size: 0.72rem;
		padding: 0.15rem 0.38rem;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.word-document-editor :global(.img-btn-move:hover) {
		background: rgba(255, 255, 255, 0.25);
		color: #fff;
	}

	.word-document-editor :global(.img-tool-sep) {
		width: 1px;
		height: 14px;
		background: rgba(255, 255, 255, 0.25);
		margin: 0 0.1rem;
	}

	.word-document-editor :global(.img-btn-align) {
		background: transparent;
		border: 1px solid transparent;
		border-radius: 6px;
		font-size: 0.8rem;
		padding: 0.15rem 0.32rem;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.word-document-editor :global(.img-btn-align:hover) {
		background: rgba(255, 255, 255, 0.18);
	}

	.word-document-editor :global(.img-btn-align.active) {
		background: var(--accent-color);
		border-color: var(--accent-color);
	}

	.word-document-editor :global(.img-btn-view) {
		font-size: 0.82rem;
		text-decoration: none;
		color: #e5e7eb;
		padding: 0 0.2rem;
	}

	.word-document-editor :global(.img-btn-del) {
		background: transparent;
		border: none;
		color: #ff5e5b;
		font-size: 0.88rem;
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
		gap: 0.5rem;
	}

	.doc-stats-left {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		white-space: nowrap;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.doc-stats-right {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@media (max-width: 640px) {
		.doc-stats-right {
			display: none;
		}
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
		border: 2px solid var(--border-color);
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
			flex-direction: column;
			height: calc(100vh - 70px);
			height: calc(100dvh - 70px);
		}

		.vault-sidebar {
			width: 100% !important;
			min-width: 100% !important;
			max-width: 100% !important;
		}
	}

	/* 🔑 Embedded Unauthenticated Login Styles */
	.login-page-container {
		width: 100%;
		max-width: 600px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		box-sizing: border-box;
	}

	.login-error-alert {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 1rem 1.25rem;
		background: rgba(255, 94, 91, 0.12);
		border: 2px solid #ff5e5b;
		border-radius: 16px;
		color: var(--text-color);
	}

	.error-icon {
		font-size: 1.5rem;
	}

	.error-text-col {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.85rem;
	}

	.error-text-col p {
		margin: 0;
		color: var(--text-muted);
	}

	.notes-login-card {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1.75rem 1.5rem;
		background: var(--card-bg);
		border-radius: 24px;
		border: 2px solid var(--border-color);
		border-bottom: 5px solid var(--border-depth-color);
		text-align: center;
	}

	.notes-hero-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.65rem;
		padding-bottom: 1rem;
		border-bottom: 2px dashed var(--border-color);
	}

	.notes-icon-badge {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.hero-notes-img {
		width: 72px;
		height: 72px;
		object-fit: contain;
		filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.2));
	}

	.sync-glow-badge {
		font-size: 0.68rem;
		font-weight: 900;
		color: #ffffff;
		background: var(--red-color, #ff5e5b);
		padding: 0.2rem 0.65rem;
		border-radius: 9999px;
		margin-top: -0.4rem;
		box-shadow: 0 3px 10px rgba(255, 94, 91, 0.4);
		letter-spacing: 0.05em;
	}

	.notes-hero-title {
		font-family: 'Outfit', sans-serif;
		font-size: 1.45rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
		line-height: 1.25;
	}

	.notes-hero-subtitle {
		font-size: 0.88rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.45;
		max-width: 480px;
	}

	.notes-features-grid {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		text-align: left;
	}

	.notes-feature-card {
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 16px;
		padding: 0.9rem 1rem;
	}

	.nfeature-ico {
		font-size: 1.5rem;
		flex-shrink: 0;
		margin-top: 0.05rem;
	}

	.nfeature-text {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.nfeature-text strong {
		font-size: 0.92rem;
		font-weight: 800;
		color: var(--text-color);
	}

	.nfeature-text p {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.35;
	}

	.notes-action-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
		padding-top: 0.5rem;
	}

	.hero-action-btn {
		padding: 0.95rem 1.2rem !important;
		font-size: 0.92rem !important;
	}

	.quick-access-hint {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-muted);
	}

	.discord-login-btn {
		width: 100%;
		background-color: #5865f2 !important;
		color: #ffffff !important;
		border: none !important;
		border-bottom: 4px solid #4752c4 !important;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.65rem;
		font-size: 0.95rem;
		font-weight: 900;
		padding: 0.85rem 1rem;
		border-radius: 16px;
		text-decoration: none;
		box-sizing: border-box;
		transition: filter 0.15s ease, transform 0.1s ease, background-color 0.15s ease;
	}

	.discord-login-btn:hover {
		background-color: #4752c4 !important;
		color: #ffffff !important;
		filter: brightness(1.08);
	}

	.discord-login-btn:active {
		transform: translateY(2px);
		border-bottom-width: 2px;
	}

	.discord-svg {
		width: 22px;
		height: 22px;
		flex-shrink: 0;
	}

	.back-btn {
		width: 100%;
		text-align: center;
		justify-content: center;
		font-size: 0.85rem;
		padding: 0.7rem 1rem;
		text-decoration: none;
		box-sizing: border-box;
	}

	/* 🗂️ Category Creator Row in Modal */
	.vcat-create-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 0.85rem;
		background: var(--card-bg-subtle);
		border-radius: 12px;
		margin: 0.5rem 0;
		border: 1.5px solid var(--border-color);
	}

	.vcat-create-input {
		flex: 1;
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		border-radius: 8px;
		padding: 0.45rem 0.65rem;
		color: var(--text-color);
		font-family: inherit;
		font-size: 0.82rem;
		font-weight: 800;
		outline: none;
	}

	.vcat-create-input:focus {
		border-color: var(--accent-color);
	}

	.vcat-create-btn {
		padding: 0.45rem 0.85rem !important;
		font-size: 0.78rem !important;
		border-radius: 10px !important;
		white-space: nowrap;
	}

	/* 🖱️ Custom Context Menu (Tasto Destro) */
	.notes-custom-context-menu {
		position: fixed;
		z-index: 10000;
		width: 235px;
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		border-bottom: 4px solid var(--border-depth-color, var(--border-color));
		border-radius: 16px;
		box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
		padding: 0.45rem;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		box-sizing: border-box;
		animation: duoPop 0.12s cubic-bezier(0.34, 1.56, 0.64, 1);
		user-select: none;
	}

	.ctx-header {
		padding: 0.35rem 0.55rem;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.ctx-note-title {
		font-size: 0.85rem;
		font-weight: 900;
		color: var(--text-color);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ctx-note-cat {
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--accent-color);
		text-transform: uppercase;
	}

	.ctx-divider {
		height: 1px;
		background: var(--border-color);
		margin: 0.25rem 0.2rem;
	}

	.ctx-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		padding: 0.5rem 0.65rem;
		border-radius: 10px;
		background: transparent;
		border: none;
		color: var(--text-color);
		font-family: inherit;
		font-size: 0.82rem;
		font-weight: 800;
		text-align: left;
		cursor: pointer;
		box-sizing: border-box;
		transition: background 0.12s ease, transform 0.08s ease;
	}

	.ctx-item:hover {
		background: var(--hover-bg, rgba(255, 255, 255, 0.08));
	}

	.ctx-item:active {
		transform: scale(0.98);
	}

	.ctx-icon {
		font-size: 0.95rem;
		flex-shrink: 0;
		width: 18px;
		text-align: center;
	}

	.ctx-danger {
		color: var(--pink-color, #ff4b4b);
	}

	.ctx-danger:hover {
		background: rgba(255, 75, 75, 0.15);
	}

	.ctx-category-container {
		position: relative;
		cursor: pointer;
		padding: 0;
	}

	.ctx-cat-select {
		width: 100%;
		background: transparent;
		border: none;
		color: var(--text-color);
		font-family: inherit;
		font-size: 0.82rem;
		font-weight: 800;
		padding: 0.5rem 0.65rem 0.5rem 2rem;
		border-radius: 10px;
		cursor: pointer;
		outline: none;
	}

	.ctx-cat-select option {
		background: var(--card-bg);
		color: var(--text-color);
	}

	.ctx-category-container .ctx-icon {
		position: absolute;
		left: 0.65rem;
		top: 50%;
		transform: translateY(-50%);
		pointer-events: none;
	}
</style>
