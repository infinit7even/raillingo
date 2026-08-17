<script lang="ts">
	import { page } from '$app/state';
	import { themeStore, LIVERY_OPTIONS, type TrainLivery, type ThemeMode } from '$lib/stores/themeStore';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { pwaStore } from '$lib/stores/pwaStore';
	import { navStore } from '$lib/stores/navStore';
	import { toastStore } from '$lib/stores/toastStore';
	import { notesNavStore, type NotesNavState } from '$lib/stores/notesNavStore';
	import QuickAddCardModal from '$lib/components/QuickAddCardModal.svelte';
	import type { Card } from '$lib/types/cards';
	import { onMount } from 'svelte';

	let { user } = $props<{ user?: any }>();

	let currentTheme = $state<ThemeMode>('dark');
	let currentLivery = $state<TrainLivery>('regionale');
	let activeLivery = $derived(LIVERY_OPTIONS.find((l) => l.id === currentLivery) ?? LIVERY_OPTIONS[0]);
	let cards = $state<Card[]>([]);
	let isQuickAddOpen = $state(false);
	let canInstall = $state(false);
	let isNavOpen = $state(false);

	let notesNavState = $state<NotesNavState>({
		isVaultCollapsed: false,
		notes: [],
		selectedNoteId: null
	});

	let activeNotes = $derived(notesNavState.notes.filter((n) => !n.isArchived && !n.isDeleted));

	let sortedCollapsedNotes = $derived(
		[...activeNotes].sort((a, b) => {
			if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
				return a.isPinned ? -1 : 1;
			}
			return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
		})
	);

	let isNotesPage = $derived(page.url.pathname === '/notes');

	let isAdmin = $derived(
		Boolean(
			user &&
			(user.isAdmin === true ||
			 user.role === 'admin' ||
			 user.id === '691289686093725736')
		)
	);

	function handleAddCardClick() {
		if (isAdmin) {
			isQuickAddOpen = true;
			navStore.close();
		} else {
			toastStore.show({
				message: '🔒 Funzione riservata agli amministratori autorizzati'
			});
		}
	}

	function handleLogoClick() {
		const nextLiveryId = themeStore.cycleLivery();
		const liv = LIVERY_OPTIONS.find((l) => l.id === nextLiveryId) ?? LIVERY_OPTIONS[0];
		toastStore.show({ message: `Tema cambiato in ${liv.name}` });
	}

	onMount(() => {
		const unTheme = themeStore.subscribe((state) => {
			currentTheme = state.theme;
			currentLivery = state.livery;
		});
		const unCards = cardsStore.subscribe((c) => (cards = c));
		const unPwa = pwaStore.subscribe(() => {
			canInstall = pwaStore.canInstall;
		});
		const unNav = navStore.subscribe((o) => (isNavOpen = o));
		const unNotesNav = notesNavStore.subscribe((s) => (notesNavState = s));

		return () => {
			unTheme();
			unCards();
			unPwa();
			unNav();
			unNotesNav();
		};
	});

	function handleNavClick() {
		navStore.close();
	}

	let drawerTouchStartX = 0;
	let drawerTouchStartY = 0;

	function handleDrawerTouchStart(e: TouchEvent) {
		drawerTouchStartX = e.touches[0].clientX;
		drawerTouchStartY = e.touches[0].clientY;
	}

	function handleDrawerTouchEnd(e: TouchEvent) {
		if (!drawerTouchStartX) return;
		const diffX = e.changedTouches[0].clientX - drawerTouchStartX;
		const diffY = e.changedTouches[0].clientY - drawerTouchStartY;

		// Swipe verso sinistra per chiudere la tendina
		if (diffX < -30 && Math.abs(diffX) > Math.abs(diffY)) {
			navStore.close();
		}
		drawerTouchStartX = 0;
		drawerTouchStartY = 0;
	}

	const navItems = [
		{ href: '/', label: 'HOME', emoji: '/emoji/house_3d.png' },
		{ href: '/flashcard', label: 'FLASHCARD', emoji: '/emoji/open_book_3d.png' },
		{ href: '/quiz', label: 'QUIZ', emoji: '/emoji/star_3d.png' },
		{ href: '/reels', label: 'REELS', emoji: '/emoji/camera_3d.png' },
		{ href: '/wiki', label: 'WIKI', emoji: '/emoji/books_3d.png' },
		{ href: '/notes', label: 'APPUNTI', emoji: '/emoji/clipboard_3d.png' }
	];
</script>

<!-- Backdrop Overlay per Mobile Drawer -->
<div
	class="drawer-backdrop"
	class:open={isNavOpen}
	onclick={() => navStore.close()}
	onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && navStore.close()}
	ontouchstart={handleDrawerTouchStart}
	ontouchend={handleDrawerTouchEnd}
	role="button"
	tabindex="0"
	aria-label="Chiudi menu navigazione"
></div>

<nav
	class="duo-navigation"
	class:open={isNavOpen}
	ontouchstart={handleDrawerTouchStart}
	ontouchend={handleDrawerTouchEnd}
>
	<!-- Header Brand e Pulsante Cambio Tema al Click -->
	<div class="sidebar-brand">
		<button
			type="button"
			class="brand-link"
			onclick={handleLogoClick}
			title="Clicca per cambiare livrea treno"
			aria-label="Cambia livrea treno"
		>
			<img src="/emoji/triangular_flag_3d.png" alt="Bandiera" width="28" height="28" decoding="async" class="brand-emoji" />
			<span class="brand-title">
				Rai<span class="ll-track-box"
					>l<img src="/emoji/railway_track_3d.png" alt="Binario" width="18" height="18" decoding="async" class="brand-track-img" />l</span
				>ingo
			</span>
		</button>
	</div>

	<div class="nav-container">
		{#if isNotesPage && notesNavState.isVaultCollapsed}
			<!-- 📓 Modalità Vault Compresso: Mostra unicamente elenco note nella barra laterale -->
			<div class="collapsed-vault-sidebar-panel">
				<div class="collapsed-notes-scroll">
					{#if sortedCollapsedNotes.length === 0}
						<div class="cv-empty">Nessun appunto presente</div>
					{:else}
						{#each sortedCollapsedNotes as n}
							<button
								type="button"
								class="cv-note-chip"
								class:active={notesNavState.selectedNoteId === n.id}
								onclick={() => {
									notesNavStore.selectNote(n.id);
									navStore.close();
								}}
							>
								<span class="cv-chip-icon">{n.isPinned ? '📌' : '📄'}</span>
								<span class="cv-chip-text">{n.title || 'Nuovo Appunto'}</span>
							</button>
						{/each}
					{/if}
				</div>
			</div>
		{:else}
			<div class="nav-scroll-wrapper">
				{#each navItems as item}
					{@const isActive = page.url.pathname === item.href}
					<a
						href={item.href}
						class="nav-item"
						class:active={isActive}
						onclick={handleNavClick}
						data-sveltekit-preload-data="tap"
						data-sveltekit-preload-code="eager"
					>
						<div class="icon-wrapper" class:active-outline={isActive}>
							<img src={item.emoji} alt={item.label} width="26" height="26" decoding="async" class="nav-emoji-img" />
						</div>
						<span class="nav-label">{item.label}</span>
					</a>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Actions Bottom Drawer (Theme + Quick Add Section) -->
	<div class="sidebar-actions">
		<!-- ⚡ Pulsante Aggiungi Scheda + ⚙️ Rotellina Impostazioni Admin sulla stessa riga -->
		<div class="quick-add-row">
			<button
				type="button"
				class="duo-btn duo-btn-green desktop-quick-add-btn"
				onclick={handleAddCardClick}
				title="Aggiungi Scheda Rapida"
			>
				⚡ AGGIUNGI
			</button>

			{#if isAdmin}
				<a
					href="/admin"
					class="duo-btn duo-btn-purple admin-cog-btn"
					title="Pannello Amministrazione"
					aria-label="Pannello Amministrazione"
					onclick={handleNavClick}
				>
					⚙️
				</a>
			{/if}
		</div>

		<!-- 🌙 / ☀️ / 🖤 Toggle Tema Ciclico: Scuro -> Chiaro -> AMOLED -->
		<button
			class="duo-btn duo-btn-gray desktop-theme-btn"
			onclick={() => themeStore.toggleTheme()}
			title="Alterna Scuro / Chiaro / AMOLED"
		>
			<span>
				MODALITÀ: {currentTheme === 'dark' ? 'SCURO 🌙' : currentTheme === 'light' ? 'CHIARO ☀️' : 'AMOLED 🖤'}
			</span>
		</button>
	</div>
</nav>

<QuickAddCardModal isOpen={isQuickAddOpen} onClose={() => (isQuickAddOpen = false)} {cards} />

<style>
	/* Overlay Sfocato Mobile */
	.drawer-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		z-index: 280;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.drawer-backdrop.open {
		opacity: 1;
		pointer-events: auto;
	}

	/* 📱 Mobile Animated Drawer (< 1024px) */
	.duo-navigation {
		position: fixed;
		top: 0;
		bottom: 0;
		left: 0;
		width: 280px;
		max-width: 84vw;
		height: 100vh;
		height: 100dvh;
		z-index: 300;
		background: var(--card-bg);
		border-right: 2px solid var(--border-color);
		box-shadow: 4px 0 24px rgba(0, 0, 0, 0.25);
		padding: 1.25rem 1rem;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 1rem;
		box-sizing: border-box;
		transform: translateX(-100%);
		transition:
			transform 0.32s cubic-bezier(0.16, 1, 0.3, 1),
			background-color 0.18s cubic-bezier(0.4, 0, 0.2, 1),
			border-color 0.18s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.duo-navigation.open {
		transform: translateX(0);
	}

	.sidebar-brand {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.25rem 0.25rem 0.75rem 0.25rem;
		border-bottom: 2px solid var(--border-color);
	}

	.brand-link {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		text-decoration: none;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: inherit;
		text-align: left;
		transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
		user-select: none;
		-webkit-tap-highlight-color: transparent;
	}

	.brand-link:hover {
		transform: scale(1.03);
	}

	.brand-link:active {
		transform: scale(0.96);
	}

	.brand-emoji {
		width: 32px;
		height: 32px;
		object-fit: contain;
	}

	.brand-title {
		font-family: 'Outfit', sans-serif;
		font-size: 1.6rem;
		font-weight: 900;
		color: var(--brand-color, var(--green-color));
		letter-spacing: -0.04em;
		display: inline-flex;
		align-items: center;
		transition: color 0.2s ease;
	}

	.ll-track-box {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	.brand-track-img {
		width: 0.75em;
		height: 0.75em;
		object-fit: contain;
		margin: 0 -0.08em;
	}

	.nav-container {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: none;
		padding: 0.5rem 0.25rem;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
	}

	.nav-container::-webkit-scrollbar {
		display: none;
	}

	.nav-scroll-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: 100%;
		box-sizing: border-box;
	}

	.nav-item {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.65rem 0.85rem;
		color: var(--text-muted);
		text-decoration: none;
		font-size: 0.88rem;
		font-weight: 800;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease,
			transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1);
		background: none;
		border: 2px solid transparent;
		border-bottom: 4px solid transparent;
		cursor: pointer;
		user-select: none;
		border-radius: 16px;
		box-sizing: border-box;
		text-align: left;
		-webkit-tap-highlight-color: transparent;
	}

	.nav-item:active {
		transform: scale(0.97) translateY(1px);
	}

	.nav-item.active {
		border-color: var(--accent-color);
		border-bottom-color: var(--accent-color);
		background-color: var(--accent-light-bg);
		color: var(--accent-color);
		font-weight: 900;
	}

	.icon-wrapper {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 12px;
	}

	.nav-emoji-img {
		width: 26px;
		height: 26px;
		object-fit: contain;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
	}

	.nav-item:hover {
		color: var(--text-color);
	}

	.nav-label {
		font-family: 'Outfit', sans-serif;
		font-weight: 900;
		font-size: 0.85rem;
		letter-spacing: 0.04em;
		white-space: nowrap;
	}

	/* Collapsed Vault Panel inside Sidebar */
	.collapsed-vault-sidebar-panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		height: 100%;
		overflow: hidden;
	}

	.collapsed-notes-scroll {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		overflow-y: auto;
		scrollbar-width: thin;
		padding-right: 0.2rem;
	}

	.cv-empty {
		font-size: 0.76rem;
		color: var(--text-muted);
		text-align: center;
		padding: 1.5rem 0;
	}

	.cv-note-chip {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.65rem;
		border-radius: 10px;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		color: var(--text-color);
		font-family: inherit;
		font-size: 0.8rem;
		font-weight: 700;
		text-align: left;
		cursor: pointer;
		transition: all 0.12s ease;
		width: 100%;
		box-sizing: border-box;
	}

	.cv-note-chip:hover {
		border-color: var(--accent-color);
		background: var(--hover-bg);
		transform: translateY(-1px);
	}

	.cv-note-chip.active {
		border-color: var(--accent-color);
		background: var(--accent-light-bg);
		color: var(--accent-color);
		font-weight: 900;
	}

	.cv-chip-icon {
		font-size: 0.85rem;
		flex-shrink: 0;
	}

	.cv-chip-text {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Sidebar Actions */
	.sidebar-actions {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		width: 100%;
		padding-top: 0.65rem;
		border-top: 2px solid var(--border-color);
	}

	.quick-add-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		width: 100%;
	}

	.desktop-quick-add-btn {
		flex: 1;
		font-size: 0.8rem;
		padding: 0.65rem;
		text-align: center;
		justify-content: center;
	}

	.admin-cog-btn {
		width: 44px;
		height: 42px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.1rem;
		padding: 0;
		flex-shrink: 0;
		text-decoration: none;
	}

	.desktop-theme-btn {
		width: 100%;
		font-size: 0.78rem;
		padding: 0.6rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	/* 🖥️ Desktop Sidebar Navigation (>= 1024px) */
	@media (min-width: 1024px) {
		.drawer-backdrop {
			display: none !important;
		}

		.duo-navigation {
			position: fixed;
			top: 0;
			bottom: 0;
			left: 0;
			right: auto;
			width: 240px;
			max-width: none;
			height: 100vh;
			border: none;
			border-radius: 0;
			border-right: 2px solid var(--border-color);
			padding: 1.5rem 1rem;
			transform: none !important;
			box-shadow: none;
			backdrop-filter: none;
		}

		.sidebar-brand {
			padding: 0.5rem 0.5rem 0 0.5rem;
			border-bottom: none;
		}

		.brand-title {
			font-size: 1.8rem;
		}
	}
</style>
