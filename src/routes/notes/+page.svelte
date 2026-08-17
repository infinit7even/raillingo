<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { notesStore } from '$lib/stores/notesStore';
	import { getMarkdownStats, extractHeadings, type HeadingItem } from '$lib/utils/markdown';
	import type { Note, NoteSortOption } from '$lib/types/notes';
	import { toastStore } from '$lib/stores/toastStore';
	import { confirmModalStore } from '$lib/stores/confirmModalStore';
	import { fade } from 'svelte/transition';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import {
		markdownToDocHtml,
		docHtmlToMarkdown,
		createInlineImageFigureHtml
	} from '$lib/utils/docConverter';
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

	// Active note local editor state
	let currentTitle = $state('');
	let currentContent = $state('');
	let currentTags = $state<string[]>([]);
	let currentImages = $state<string[]>([]);
	let currentIsPinned = $state(false);

	let newTagInput = $state('');
	let isAddingTag = $state(false);

	let editorEl = $state<HTMLDivElement | null>(null);
	let docCanvasEl = $state<HTMLDivElement | null>(null);
	let notesWrapperEl = $state<HTMLDivElement | null>(null);
	let fileInputEl = $state<HTMLInputElement | null>(null);
	let savedRange: Range | null = null;

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
		const target = e.target as HTMLElement;
		if (target && (target.closest('.document-canvas-container') || target.closest('.word-document-editor') || target.closest('.note-workspace-pane'))) {
			e.preventDefault();
			e.stopPropagation();
			contextMenuX = Math.min(e.clientX, window.innerWidth - 230);
			contextMenuY = Math.min(e.clientY, window.innerHeight - 320);
			isNotesContextMenuOpen = true;
		}
	}

	function closeNotesContextMenu() {
		isNotesContextMenuOpen = false;
	}

	onMount(() => {
		notesStore.hydrate(data.initialNotes, user?.id);
		loadTrash();

		const handlePasteReq = () => {
			handleContextPaste();
		};

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
			}
			const savedCollapsed = localStorage.getItem('rf_vault_collapsed');
			if (savedCollapsed === 'true') {
				isVaultCollapsed = true;
			}

			// Intercetta paste globale, contextmenu ed eventi custom
			window.addEventListener('paste', handleGlobalPaste);
			window.addEventListener('rf-paste-request', handlePasteReq);
			window.addEventListener('rf-select-note', handleExternalNoteSelect);
			window.addEventListener('rf-vault-collapse-changed', handleCollapseChange);
			window.addEventListener('click', closeNotesContextMenu);
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
				window.removeEventListener('paste', handleGlobalPaste);
				window.removeEventListener('rf-paste-request', handlePasteReq);
				window.removeEventListener('rf-select-note', handleExternalNoteSelect);
				window.removeEventListener('rf-vault-collapse-changed', handleCollapseChange);
				window.removeEventListener('click', closeNotesContextMenu);
				window.removeEventListener('contextmenu', handleNotesContextMenu);
			}
			unsub();
			if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
		};
	});

	function handleCanvasScroll() {
		if (docCanvasEl && selectedNoteId && typeof sessionStorage !== 'undefined') {
			sessionStorage.setItem(`rf_note_scroll_${selectedNoteId}`, String(docCanvasEl.scrollTop));
		}
	}

	async function handleContextPaste() {
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
		currentImages = note.images ? [...note.images] : [];
		currentIsPinned = Boolean(note.isPinned);
		isSidebarOpenMobile = false;

		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('rf_last_opened_note_id', note.id);
		}

		notesNavStore.syncNotes(notes, note.id, isVaultCollapsed);

		await tick();
		if (editorEl) {
			editorEl.innerHTML = markdownToDocHtml(currentContent);
		}

		// Ripristina posizione di scroll memorizzata per questa nota
		if (docCanvasEl && typeof sessionStorage !== 'undefined') {
			const savedScroll = sessionStorage.getItem(`rf_note_scroll_${note.id}`);
			if (savedScroll) {
				docCanvasEl.scrollTop = Number(savedScroll);
			}
		}
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

	let activeNote = $derived(notes.find((n) => n.id === selectedNoteId) || null);

	$effect(() => {
		if (activeNote && activeNote.id !== selectedNoteId) {
			selectNote(activeNote);
		}
	});

	let filteredNotes = $derived.by(() => {
		let list = [...notes];

		const tagFilter = selectedTagFilter;
		if (tagFilter) {
			list = list.filter((n) => n.tags && n.tags.includes(tagFilter));
		}

		const q = searchQuery.toLowerCase().trim();
		if (q) {
			list = list.filter(
				(n) =>
					n.title.toLowerCase().includes(q) ||
					n.content.toLowerCase().includes(q) ||
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
		} else if (sortOption === 'date-asc') {
			list.sort((a, b) => {
				if (a.isPinned && !b.isPinned) return -1;
				if (!a.isPinned && b.isPinned) return 1;
				return (
					new Date(a.updatedAt || a.createdAt).getTime() -
					new Date(b.updatedAt || b.createdAt).getTime()
				);
			});
		} else if (sortOption === 'title-asc') {
			list.sort((a, b) => {
				if (a.isPinned && !b.isPinned) return -1;
				if (!a.isPinned && b.isPinned) return 1;
				return a.title.localeCompare(b.title, 'it');
			});
		}

		return list;
	});

	let filteredTrashNotes = $derived.by(() => {
		let list = [...trashNotes];
		const q = searchQuery.toLowerCase().trim();
		if (q) {
			list = list.filter(
				(n) =>
					n.title.toLowerCase().includes(q) ||
					n.content.toLowerCase().includes(q) ||
					(n.tags && n.tags.some((t) => t.toLowerCase().includes(q)))
			);
		}
		return list;
	});

	async function handleRestoreTrashNote(noteId: string) {
		const success = await notesStore.restoreNote(noteId);
		if (success) {
			await loadTrash();
			selectedTrashNote = null;
			isViewingTrash = false;
			await notesStore.loadNotes();
		}
	}

	async function handlePermanentDeleteNote(noteId: string) {
		confirmModalStore.open({
			title: 'Elimina Definitivamente',
			message: 'Vuoi eliminare DEFINITIVAMENTE questo appunto dal cestino? L\'operazione non può essere annullata.',
			confirmText: 'Elimina Definitivamente',
			confirmVariant: 'danger',
			icon: '🗑️',
			onConfirm: async () => {
				await notesStore.permanentDeleteNote(noteId);
				trashNotes = trashNotes.filter((n) => n.id !== noteId);
				if (selectedTrashNote?.id === noteId) {
					selectedTrashNote = null;
				}
			}
		});
	}

	function selectTrashNote(note: Note) {
		selectedTrashNote = note;
		if (typeof window !== 'undefined' && window.innerWidth < 1024) {
			isSidebarOpenMobile = false;
		}
	}

	let docStats = $derived(getMarkdownStats(currentContent));
	let headingsOutline = $derived<HeadingItem[]>(extractHeadings(currentContent));

	function syncContentFromEditor() {
		if (!editorEl) return;
		currentContent = docHtmlToMarkdown(editorEl);

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
				tags: currentTags,
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
			category: 'Generale',
			tags: selectedTagFilter ? [selectedTagFilter] : [],
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

	function handleDeleteActiveNote() {
		if (!selectedNoteId || !activeNote) return;
		const idToDelete = selectedNoteId;
		const titleToDelete = activeNote.title || 'questo appunto';

		confirmModalStore.open({
			title: 'Elimina Appunto',
			message: `Sei sicuro di voler eliminare definitivamente "${titleToDelete}"? L'operazione non può essere annullata.`,
			confirmText: 'Elimina Appunto',
			confirmVariant: 'danger',
			icon: '🗑️',
			onConfirm: async () => {
				await notesStore.deleteNote(idToDelete);
				const remaining = notes.filter((n) => n.id !== idToDelete);
				if (remaining.length > 0) {
					selectNote(remaining[0]);
				} else {
					selectedNoteId = null;
					currentTitle = '';
					currentContent = '';
					currentTags = [];
					currentImages = [];
					if (editorEl) editorEl.innerHTML = '';
				}
				toastStore.show({ message: `🗑️ Appunto eliminato`, type: 'info' });
			}
		});
	}

	async function handleTogglePin() {
		currentIsPinned = !currentIsPinned;
		triggerAutoSave();
	}

	function handleEditorKeyUp(e: KeyboardEvent) {
		saveCurrentSelection();
		if (e.key === ' ' || e.key === 'Spacebar') {
			checkMarkdownPrefixTransform();
		}
	}

	function checkMarkdownPrefixTransform() {
		const sel = window.getSelection();
		if (!sel || !sel.anchorNode || !editorEl) return;

		let node: Node | null = sel.anchorNode;
		while (
			node &&
			node !== editorEl &&
			!['P', 'DIV', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'LI'].includes(node.nodeName)
		) {
			node = node.parentNode;
		}

		if (!node || node === editorEl) return;
		const blockEl = node as HTMLElement;
		const text = blockEl.textContent || '';

		if (text.startsWith('# ')) {
			const clean = text.substring(2);
			const h1 = document.createElement('h1');
			h1.textContent = clean;
			blockEl.replaceWith(h1);
			setCursorAtEnd(h1);
			handleEditorInput();
		} else if (text.startsWith('## ')) {
			const clean = text.substring(3);
			const h2 = document.createElement('h2');
			h2.textContent = clean;
			blockEl.replaceWith(h2);
			setCursorAtEnd(h2);
			handleEditorInput();
		} else if (text.startsWith('### ')) {
			const clean = text.substring(4);
			const h3 = document.createElement('h3');
			h3.textContent = clean;
			blockEl.replaceWith(h3);
			setCursorAtEnd(h3);
			handleEditorInput();
		} else if (text.startsWith('> ')) {
			const clean = text.substring(2);
			const bq = document.createElement('blockquote');
			bq.textContent = clean;
			blockEl.replaceWith(bq);
			setCursorAtEnd(bq);
			handleEditorInput();
		} else if (text.startsWith('- ') || text.startsWith('* ')) {
			const clean = text.substring(2);
			const ul = document.createElement('ul');
			const li = document.createElement('li');
			li.textContent = clean;
			ul.appendChild(li);
			blockEl.replaceWith(ul);
			setCursorAtEnd(li);
			handleEditorInput();
		} else if (/^\d+\.\s/.test(text)) {
			const clean = text.replace(/^\d+\.\s/, '');
			const ol = document.createElement('ol');
			const li = document.createElement('li');
			li.textContent = clean;
			ol.appendChild(li);
			blockEl.replaceWith(ol);
			setCursorAtEnd(li);
			handleEditorInput();
		}
	}

	function setCursorAtEnd(el: HTMLElement) {
		const range = document.createRange();
		const sel = window.getSelection();
		range.selectNodeContents(el);
		range.collapse(false);
		sel?.removeAllRanges();
		sel?.addRange(range);
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

	async function handleFileInputChange(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			await uploadAndInsertImage(input.files[0]);
			input.value = '';
		}
	}

	async function uploadAndInsertImage(rawFile: File | Blob) {
		if (!selectedNoteId) {
			toastStore.show({ message: "⚠️ Seleziona prima un appunto in cui incollare l'immagine." });
			return;
		}

		if (isUploadingImage) return;
		isUploadingImage = true;
		toastStore.show({ message: '⏳ Compressione e inserimento immagine...' });

		try {
			const uploadRes = await uploadImage(rawFile, { context: 'note' });
			insertImageBlockAtCursor(uploadRes.url, '400');
			toastStore.show({ message: '🖼️ Immagine compressa e inserita nel testo!' });
		} catch (err: any) {
			console.error('Errore inserimento immagine:', err);
			toastStore.show({
				message: `❌ Errore caricamento immagine: ${err.message || 'Riprova'}`,
				type: 'error'
			});
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

	function copyMarkdown() {
		syncContentFromEditor();
		if (!currentContent) return;
		navigator.clipboard.writeText(`# ${currentTitle}\n\n${currentContent}`);
		toastStore.show({ message: '📋 Testo copiato negli appunti!' });
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

	function handleKeyDown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 's') {
			e.preventDefault();
			triggerAutoSave();
			toastStore.show({ message: '💾 Appunto salvato!' });
		}
	}
</script>

<div class="notes-page-wrapper" bind:this={notesWrapperEl}>
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

			<!-- User Custom Tags Filter Row in Sidebar (solo se in appunti attivi) -->
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
								data-note-id={note.id}
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
					<div class="doc-editor preview-mode">
						{@html markdownToDocHtml(selectedTrashNote.content)}
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
					class="ribbon-btn highlight-btn"
					onclick={handleHighlightText}
					title="Evidenzia testo (==testo==)"
				>
					🖍️ Evidenzia
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

			<!-- Word-style Live Document Canvas with Inline Images -->
			<div
				bind:this={docCanvasEl}
				class="document-canvas-container"
				onscroll={handleCanvasScroll}
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
					onkeyup={handleEditorKeyUp}
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
					<span>Stato:</span>
					<strong>{currentIsPinned ? '📌 In evidenza' : 'Ordinario'}</strong>
				</div>
			</div>
		</aside>
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
	</div>
{/if}

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
		<button type="button" class="ctx-item" onclick={() => { isNotesContextMenuOpen = false; handleHighlightText(); }}>
			<span class="ctx-ico">🖍️</span>
			<span>Evidenzia Testo</span>
		</button>
		<button type="button" class="ctx-item" onclick={() => { isNotesContextMenuOpen = false; applyFormat('bold'); }}>
			<span class="ctx-ico"><strong>B</strong></span>
			<span>Grassetto</span>
		</button>
		<button type="button" class="ctx-item" onclick={() => { isNotesContextMenuOpen = false; applyFormat('italic'); }}>
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
</div>

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
		max-width: 100%;
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
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}

	.workspace-header-left {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
		flex: 1 1 auto;
		overflow: hidden;
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
		flex-shrink: 0;
	}

	@media (max-width: 1023px) {
		.mobile-back-btn {
			display: inline-flex;
			align-items: center;
		}
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
		flex-shrink: 0;
	}

	.saving-txt {
		color: var(--orange-color);
	}

	.saved-txt {
		color: var(--text-muted);
	}

	.action-share-btn.shared {
		background: rgba(52, 152, 219, 0.2);
		border-color: #3498db;
		color: #3498db;
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
		flex-shrink: 0;
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

	/* 📱 Mobile Responsive Header & Editor Optimizations */
	@media (max-width: 768px) {
		.note-workspace-pane {
			padding: 0.6rem 0.65rem;
			border-radius: 14px;
			gap: 0.4rem;
		}

		.workspace-header {
			gap: 0.3rem;
			min-height: 34px;
			padding-bottom: 0.35rem;
		}

		.workspace-header-left {
			gap: 0.25rem;
		}

		.mobile-back-btn {
			height: 30px;
			padding: 0 0.45rem;
			font-size: 0.72rem;
		}

		.save-status-pill {
			display: none;
		}

		.workspace-quick-actions {
			gap: 0.2rem;
		}

		.action-icon-btn {
			width: 29px;
			height: 29px;
			font-size: 0.8rem;
			border-radius: 7px;
		}
	}

	@media (max-width: 480px) {
		.action-outline-btn,
		.action-export-btn {
			display: none;
		}
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
		max-width: 100%;
		box-sizing: border-box;
	}

	.obsidian-ribbon-bar::-webkit-scrollbar {
		display: none;
	}

	@media (max-width: 768px) {
		.obsidian-ribbon-bar {
			height: 35px;
			padding: 0.2rem 0.35rem;
			gap: 0.2rem;
			border-radius: 10px;
		}
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

	@media (max-width: 768px) {
		.ribbon-btn {
			height: 26px;
			padding: 0 0.45rem;
			font-size: 0.72rem;
		}
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

	/* 🏷️ Stili Etichette / Tag Note */
	.vault-tags-filter-row {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		overflow-x: auto;
		scrollbar-width: none;
		padding: 0.1rem 0;
		flex-shrink: 0;
	}

	.vault-tags-filter-row::-webkit-scrollbar {
		display: none;
	}

	.tag-filter-chip {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.55rem;
		border-radius: 8px;
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		color: var(--text-muted);
		font-family: inherit;
		font-size: 0.72rem;
		font-weight: 800;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.12s ease;
	}

	.tag-filter-chip:hover {
		border-color: var(--accent-color);
		color: var(--text-color);
	}

	.tag-filter-chip.active {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
		font-weight: 900;
	}

	.file-tags-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: 0.2rem;
	}

	.file-tag-mini {
		font-size: 0.65rem;
		font-weight: 800;
		color: var(--accent-color);
		background: var(--card-bg-subtle);
		padding: 0.05rem 0.35rem;
		border-radius: 4px;
		border: 1px solid var(--border-color);
	}

	.note-tags-bar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem;
		padding: 0.4rem 0.2rem 0.6rem 0.2rem;
		flex-shrink: 0;
	}

	.tags-bar-label {
		font-size: 0.76rem;
		font-weight: 800;
		color: var(--text-muted);
	}

	.note-tag-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.2rem 0.5rem;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		font-size: 0.76rem;
		font-weight: 800;
		color: var(--accent-color);
	}

	.remove-tag-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 0.7rem;
		cursor: pointer;
		padding: 0;
		display: inline-flex;
		align-items: center;
	}

	.remove-tag-btn:hover {
		color: #ff4b4b;
	}

	.add-tag-trigger-btn {
		background: var(--card-bg-subtle);
		border: 1px dashed var(--border-color);
		border-radius: 8px;
		padding: 0.2rem 0.5rem;
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--text-muted);
		cursor: pointer;
	}

	.add-tag-trigger-btn:hover {
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.add-tag-input-wrap {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.add-tag-input {
		background: var(--card-bg);
		border: 1px solid var(--accent-color);
		border-radius: 6px;
		padding: 0.2rem 0.45rem;
		font-size: 0.75rem;
		color: var(--text-color);
		outline: none;
		width: 110px;
	}

	.confirm-tag-btn,
	.cancel-tag-btn {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		padding: 0.15rem 0.35rem;
		font-size: 0.72rem;
		cursor: pointer;
		font-weight: 900;
	}

	.confirm-tag-btn {
		color: var(--green-color);
	}

	.cancel-tag-btn {
		color: var(--pink-color);
	}

	/* 🖍️ Evidenziatore Stile Word */
	.word-document-editor :global(mark) {
		background-color: rgba(255, 200, 0, 0.35);
		color: inherit;
		border-radius: 4px;
		padding: 0.1em 0.25em;
		border-bottom: 1.5px solid var(--yellow-color, #ffc800);
	}

	.highlight-btn {
		background: rgba(255, 200, 0, 0.15);
		border-color: var(--yellow-color);
	}

	/* 🖥️ Desktop Banner Removal */
	@media (min-width: 1024px) {
		.notes-header-container {
			display: none !important;
		}

		.obsidian-workspace {
			height: calc(100vh - 40px) !important;
			height: calc(100dvh - 40px) !important;
		}
	}

	/* 🗑️ Vault Tabs & Cestino Styles */
	.vault-tabs-row {
		display: flex;
		gap: 0.4rem;
		padding: 0 0.85rem 0.5rem 0.85rem;
	}

	.vault-tab-pill {
		flex: 1;
		padding: 0.45rem 0.6rem;
		font-size: 0.78rem;
		font-weight: 800;
		border-radius: 10px;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.vault-tab-pill:hover {
		color: var(--text-color);
		border-color: var(--accent-color);
	}

	.vault-tab-pill.active {
		border-color: var(--accent-color);
		background: var(--accent-light-bg);
		color: var(--accent-color);
		font-weight: 900;
	}

	.vault-tab-pill.trash.active {
		border-color: #ef4444;
		background: rgba(239, 68, 68, 0.12);
		color: #ef4444;
	}

	.trash-badge-mini {
		font-size: 0.68rem;
		font-weight: 800;
		color: #ef4444;
		background: rgba(239, 68, 68, 0.12);
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
	}

	.vault-file-item.in-trash {
		border-left: 3px solid #ef4444;
	}

	.trash-note-view {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		height: 100%;
		padding: 1.25rem;
		overflow-y: auto;
		box-sizing: border-box;
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
</style>
