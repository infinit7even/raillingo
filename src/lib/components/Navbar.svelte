<script lang="ts">
	import { page } from '$app/state';
	import { themeStore, type ThemePreset } from '$lib/stores/themeStore';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { pwaStore } from '$lib/stores/pwaStore';
	import { navStore } from '$lib/stores/navStore';
	import QuickAddCardModal from '$lib/components/QuickAddCardModal.svelte';
	import type { Card } from '$lib/types/cards';
	import { onMount } from 'svelte';

	let { user } = $props<{ user?: any }>();

	let currentTheme = $state<ThemePreset>('dark');
	let cards = $state<Card[]>([]);
	let isQuickAddOpen = $state(false);
	let canInstall = $state(false);
	let isNavOpen = $state(false);

	onMount(() => {
		const unTheme = themeStore.subscribe((t) => (currentTheme = t));
		const unCards = cardsStore.subscribe((c) => (cards = c));
		const unPwa = pwaStore.subscribe(() => {
			canInstall = pwaStore.canInstall;
		});
		const unNav = navStore.subscribe((o) => (isNavOpen = o));

		return () => {
			unTheme();
			unCards();
			unPwa();
			unNav();
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
		{ href: '/appunti', label: 'APPUNTI', emoji: '/emoji/clipboard_3d.png' }
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
	<!-- Header Brand e Pulsante Chiudi -->
	<div class="sidebar-brand">
		<a href="/" class="brand-link" onclick={handleNavClick}>
			<img src="/emoji/triangular_flag_3d.png" alt="Bandiera" class="brand-emoji" />
			<span class="brand-title">
				Rai<span class="ll-track-box"
					>l<img src="/emoji/railway_track_3d.png" alt="Binario" class="brand-track-img" />l</span
				>ingo
			</span>
		</a>
		<button
			type="button"
			class="close-drawer-btn"
			onclick={() => navStore.close()}
			aria-label="Chiudi menu"
		>
			✕
		</button>
	</div>

	<div class="nav-container">
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
						<img src={item.emoji} alt={item.label} class="nav-emoji-img" />
					</div>
					<span class="nav-label">{item.label}</span>
				</a>
			{/each}
		</div>
	</div>

	<!-- Actions Bottom Drawer (Theme + Quick Add Admin Section) -->
	<div class="sidebar-actions">
		{#if user && (user.isAdmin || user.role === 'admin')}
			<button
				type="button"
				class="duo-btn duo-btn-green desktop-quick-add-btn"
				onclick={() => {
					isQuickAddOpen = true;
					navStore.close();
				}}
				title="Aggiungi Scheda Rapida"
			>
				⚡ AGGIUNGI SCHEDA
			</button>
		{/if}

		<button
			class="duo-btn duo-btn-gray desktop-theme-btn"
			onclick={() => themeStore.setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
			title="Alterna Scuro/Chiaro"
		>
			<span>TEMA: {currentTheme === 'dark' ? 'SCURO 🌙' : 'CHIARO ☀️'}</span>
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
			background-color 0.3s ease,
			border-color 0.3s ease;
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
		color: var(--green-color);
		letter-spacing: -0.04em;
		display: inline-flex;
		align-items: center;
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

	.close-drawer-btn {
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-radius: 12px;
		width: 34px;
		height: 34px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-color);
		font-size: 1.1rem;
		font-weight: 800;
		cursor: pointer;
		transition:
			transform 0.15s ease,
			background-color 0.2s ease;
	}

	.close-drawer-btn:active {
		transform: scale(0.92);
	}

	.nav-container {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: none;
		padding: 0.5rem 0;
	}

	.nav-container::-webkit-scrollbar {
		display: none;
	}

	.nav-scroll-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: 100%;
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
		animation: duoPop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
		font-weight: 900;
	}

	.nav-item.active .nav-emoji-img {
		animation: gentleWobble 0.5s ease;
	}

	.icon-wrapper {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 12px;
		transition: transform 0.2s ease;
	}

	.nav-emoji-img {
		width: 26px;
		height: 26px;
		object-fit: contain;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
	}

	.nav-item:active .nav-emoji-img {
		transform: scale(0.9);
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

	.sidebar-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		padding-top: 0.65rem;
		border-top: 2px solid var(--border-color);
	}

	.desktop-quick-add-btn {
		width: 100%;
		font-size: 0.8rem;
		padding: 0.65rem;
		text-align: center;
		justify-content: center;
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

		.close-drawer-btn {
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
