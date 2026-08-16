<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { contextMenuStore, type ContextMenuState } from '$lib/stores/contextMenuStore';
	import { notesStore } from '$lib/stores/notesStore';
	import { toastStore } from '$lib/stores/toastStore';
	import type { Note } from '$lib/types/notes';

	let menuState = $state<ContextMenuState>({
		isOpen: false,
		type: 'global-nav',
		x: 0,
		y: 0,
		targetNoteId: null
	});

	let notesList = $state<Note[]>([]);

	const MENU_WIDTH = 215;
	const MENU_APPROX_HEIGHT = 300;
	const PADDING = 12;

	const navItems = [
		{ href: '/', label: 'Home', icon: '/emoji/house_3d.png' },
		{ href: '/flashcard', label: 'Flashcard', icon: '/emoji/open_book_3d.png' },
		{ href: '/quiz', label: 'Quiz', icon: '/emoji/star_3d.png' },
		{ href: '/reels', label: 'Reels', icon: '/emoji/camera_3d.png' },
		{ href: '/wiki', label: 'Wiki', icon: '/emoji/books_3d.png' },
		{ href: '/notes', label: 'Appunti', icon: '/emoji/clipboard_3d.png' },
		{ href: '/missions', label: 'Missioni', icon: '/emoji/package_3d.png' }
	];

	onMount(() => {
		const unsubMenu = contextMenuStore.subscribe((val) => {
			menuState = val;
		});

		const unsubNotes = notesStore.subscribe((val) => {
			notesList = val;
		});

		function handleContextMenu(e: MouseEvent) {
			// Blocca SEMPRE il menu nativo di Chrome ovunque nel sito
			e.preventDefault();

			const target = e.target as HTMLElement;
			const clientX = e.clientX;
			const clientY = e.clientY;

			// Se siamo nella pagina /notes
			if (page.url.pathname.startsWith('/notes')) {
				const noteItem = target.closest('[data-note-id]') as HTMLElement | null;
				if (noteItem) {
					const noteId = noteItem.getAttribute('data-note-id');
					if (noteId) {
						contextMenuStore.openNoteItem(clientX, clientY, noteId);
						return;
					}
				}

				const workspacePane = target.closest('.obsidian-workspace, .note-workspace-pane, .vault-sidebar');
				if (workspacePane) {
					const activeId = typeof localStorage !== 'undefined' ? localStorage.getItem('rf_last_opened_note_id') : null;
					contextMenuStore.openNotesWorkspace(clientX, clientY, activeId);
					return;
				}
			}

			// Altrimenti (esterno o su un'altra pagina del sito)
			contextMenuStore.openGlobalNav(clientX, clientY);
		}

		function handleGlobalClick(e: MouseEvent) {
			if (!menuState.isOpen) return;
			const target = e.target as HTMLElement;
			if (!target.closest('.quick-nav-menu')) {
				contextMenuStore.close();
			}
		}

		function handleGlobalKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape' && menuState.isOpen) {
				contextMenuStore.close();
			}
		}

		function handleGlobalScroll() {
			if (menuState.isOpen) {
				contextMenuStore.close();
			}
		}

		window.addEventListener('contextmenu', handleContextMenu, { capture: true });
		window.addEventListener('click', handleGlobalClick, { capture: true });
		window.addEventListener('keydown', handleGlobalKeyDown);
		window.addEventListener('scroll', handleGlobalScroll, { passive: true });

		return () => {
			unsubMenu();
			unsubNotes();
			window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
			window.removeEventListener('click', handleGlobalClick, { capture: true });
			window.removeEventListener('keydown', handleGlobalKeyDown);
			window.removeEventListener('scroll', handleGlobalScroll);
		};
	});

	let targetNote = $derived(
		menuState.targetNoteId ? notesList.find((n: Note) => n.id === menuState.targetNoteId) || null : null
	);

	let activeNote = $derived(
		menuState.targetNoteId
			? notesList.find((n: Note) => n.id === menuState.targetNoteId) || null
			: notesList.length > 0
				? notesList[0]
				: null
	);

	let menuX = $derived(
		Math.max(PADDING, Math.min(menuState.x, typeof window !== 'undefined' ? window.innerWidth - MENU_WIDTH - PADDING : 0))
	);

	let menuY = $derived(
		Math.max(PADDING, Math.min(menuState.y, typeof window !== 'undefined' ? window.innerHeight - MENU_APPROX_HEIGHT - PADDING : 0))
	);

	function navigateTo(path: string) {
		contextMenuStore.close();
		goto(path);
	}

	async function handleTogglePin(note: Note) {
		contextMenuStore.close();
		const newPinned = !note.isPinned;
		await notesStore.updateNote({ id: note.id, isPinned: newPinned });
		toastStore.show({
			message: newPinned ? `📌 "${note.title}" fissato in alto` : `📌 "${note.title}" rimosso dall'evidenza`
		});
	}

	function handleCopy(note: Note) {
		contextMenuStore.close();
		const text = `# ${note.title}\n\n${note.content || ''}`;
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text);
			toastStore.show({ message: '📋 Appunto copiato negli appunti!' });
		}
	}

	async function handleDuplicate(note: Note) {
		contextMenuStore.close();
		const copy = await notesStore.createNote({
			title: `${note.title} (Copia)`,
			content: note.content || '',
			category: note.category || '',
			isPinned: false
		});
		if (copy) {
			toastStore.show({ message: '📑 Appunto duplicato!' });
		}
	}

	async function handleDelete(note: Note) {
		contextMenuStore.close();
		if (confirm(`Sei sicuro di voler eliminare "${note.title}"?`)) {
			await notesStore.deleteNote(note.id);
			toastStore.show({ message: '🗑️ Appunto eliminato' });
		}
	}

	function handlePaste() {
		contextMenuStore.close();
		window.dispatchEvent(new CustomEvent('rf-paste-request'));
	}

	function handleOpenCategoryModal() {
		contextMenuStore.close();
		window.dispatchEvent(new CustomEvent('rf-open-category-modal'));
	}

	async function handleCreateNew() {
		contextMenuStore.close();
		const newNote = await notesStore.createNote({
			title: 'Nuovo Appunto',
			content: '',
			category: ''
		});
		if (newNote) {
			toastStore.show({ message: '📝 Nuovo appunto creato!' });
		}
	}
</script>

{#if menuState.isOpen}
	<!-- Backdrop trasparente a tutto schermo: intercetta click, click destri e chiude all'istante -->
	<div
		class="quick-nav-backdrop"
		onclick={() => contextMenuStore.close()}
		oncontextmenu={(e) => {
			e.preventDefault();
			contextMenuStore.close();
		}}
		role="presentation"
	></div>

	<!-- Menu Rapido Globale con Posizionamento Viewport Pixel-Perfect -->
	<div
		class="quick-nav-menu duo-card"
		style="left: {menuX}px; top: {menuY}px;"
		role="menu"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
	>
		{#if menuState.type === 'note-item' && targetNote}
			<!-- 📄 Menu Contestuale per Nota Specifica -->
			<div class="ctx-header">
				<span class="ctx-note-title">{targetNote.title || 'Appunto'}</span>
				{#if targetNote.category}
					<span class="ctx-note-cat">📁 {targetNote.category}</span>
				{/if}
			</div>
			<div class="ctx-divider"></div>

			<button type="button" class="ctx-item" onclick={() => handleTogglePin(targetNote!)}>
				<span class="ctx-icon">{targetNote.isPinned ? '📌' : '📍'}</span>
				<span>{targetNote.isPinned ? 'Rimuovi evidenza' : 'Fissa in alto'}</span>
			</button>

			<button type="button" class="ctx-item" onclick={handleOpenCategoryModal}>
				<span class="ctx-icon">📁</span>
				<span>Gestisci Categoria...</span>
			</button>

			<button type="button" class="ctx-item" onclick={() => handleCopy(targetNote!)}>
				<span class="ctx-icon">📋</span>
				<span>Copia appunto</span>
			</button>

			<button type="button" class="ctx-item" onclick={handlePaste}>
				<span class="ctx-icon">📥</span>
				<span>Incolla</span>
			</button>

			<button type="button" class="ctx-item" onclick={() => handleDuplicate(targetNote!)}>
				<span class="ctx-icon">📑</span>
				<span>Duplica appunto</span>
			</button>

			<div class="ctx-divider"></div>

			<button type="button" class="ctx-item ctx-danger" onclick={() => handleDelete(targetNote!)}>
				<span class="ctx-icon">🗑️</span>
				<span>Elimina appunto</span>
			</button>
		{:else if menuState.type === 'notes-workspace'}
			<!-- 📓 Menu Contestuale per Area di Lavoro Note -->
			<button type="button" class="ctx-item" onclick={handleCreateNew}>
				<span class="ctx-icon">📝</span>
				<span>Nuovo appunto</span>
			</button>

			<button type="button" class="ctx-item" onclick={handleOpenCategoryModal}>
				<span class="ctx-icon">📁</span>
				<span>Gestisci Categorie...</span>
			</button>

			<button type="button" class="ctx-item" onclick={handlePaste}>
				<span class="ctx-icon">📥</span>
				<span>Incolla</span>
			</button>

			{#if activeNote}
				<div class="ctx-divider"></div>
				<button type="button" class="ctx-item" onclick={() => handleCopy(activeNote!)}>
					<span class="ctx-icon">📋</span>
					<span>Copia appunto aperto</span>
				</button>

				<button type="button" class="ctx-item" onclick={() => handleDuplicate(activeNote!)}>
					<span class="ctx-icon">📑</span>
					<span>Duplica appunto aperto</span>
				</button>

				<button type="button" class="ctx-item ctx-danger" onclick={() => handleDelete(activeNote!)}>
					<span class="ctx-icon">🗑️</span>
					<span>Elimina appunto aperto</span>
				</button>
			{/if}
		{:else}
			<!-- 🧭 Menu Rapido di Navigazione Globale -->
			<div class="quick-nav-list">
				{#each navItems as item}
					{@const isActive = page.url.pathname === item.href}
					<button
						type="button"
						class="quick-nav-item"
						class:active={isActive}
						onclick={() => navigateTo(item.href)}
					>
						<img src={item.icon} alt="" width="20" height="20" class="nav-ico-img" />
						<span class="nav-label-text">{item.label}</span>
						{#if isActive}
							<span class="active-dot-indicator">●</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.quick-nav-backdrop {
		position: fixed;
		inset: 0;
		z-index: 99998;
		background: transparent;
	}

	.quick-nav-menu {
		position: fixed;
		z-index: 99999;
		width: 215px;
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		border-bottom: 3.5px solid var(--border-depth-color);
		border-radius: 16px;
		padding: 0.4rem;
		box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		box-sizing: border-box;
		animation: navPop 0.14s cubic-bezier(0.34, 1.56, 0.64, 1);
		user-select: none;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	@keyframes navPop {
		0% {
			opacity: 0;
			transform: scale(0.92) translateY(3px);
		}
		100% {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.quick-nav-list {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.quick-nav-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.45rem 0.65rem;
		border-radius: 11px;
		border: 1.5px solid transparent;
		background: transparent;
		color: var(--text-color);
		font-family: 'Outfit', sans-serif;
		font-size: 0.85rem;
		font-weight: 800;
		cursor: pointer;
		text-align: left;
		transition: all 0.1s ease;
		box-sizing: border-box;
		width: 100%;
	}

	.quick-nav-item:hover {
		background: var(--card-bg-subtle);
		border-color: var(--border-color);
		transform: translateX(2px);
	}

	.quick-nav-item.active {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
		font-weight: 900;
	}

	.nav-ico-img {
		width: 20px;
		height: 20px;
		object-fit: contain;
		flex-shrink: 0;
	}

	.nav-label-text {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.active-dot-indicator {
		color: var(--accent-color);
		font-size: 0.6rem;
	}

	/* 📝 Context Menu Styles */
	.ctx-header {
		padding: 0.35rem 0.55rem;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.ctx-note-title {
		font-size: 0.84rem;
		font-weight: 900;
		color: var(--text-color);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ctx-note-cat {
		font-size: 0.68rem;
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
		padding: 0.45rem 0.65rem;
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
		font-size: 0.92rem;
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
</style>
