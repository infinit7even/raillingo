<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { themeStore, type ThemePreset } from '$lib/stores/themeStore';
	import { toastStore } from '$lib/stores/toastStore';

	let { user } = $props<{ user?: any }>();

	let isOpen = $state(false);
	let menuX = $state(0);
	let menuY = $state(0);
	let currentTheme = $state<ThemePreset>('dark');

	const MENU_WIDTH = 250;
	const MENU_APPROX_HEIGHT = 420;
	const PADDING = 12;

	onMount(() => {
		const unsubTheme = themeStore.subscribe((t) => (currentTheme = t));

		function handleContextMenu(e: MouseEvent) {
			// Disabilita il menu contestuale predefinito del browser su tutto il sito
			e.preventDefault();

			const clientX = e.clientX;
			const clientY = e.clientY;

			// Calcola le coordinate per mantenere il menu sempre completamente visibile nello schermo
			const maxX = window.innerWidth - MENU_WIDTH - PADDING;
			const maxY = window.innerHeight - MENU_APPROX_HEIGHT - PADDING;

			menuX = Math.max(PADDING, Math.min(clientX, maxX));
			menuY = Math.max(PADDING, Math.min(clientY, maxY));

			isOpen = true;
		}

		function handleGlobalClick(e: MouseEvent) {
			if (!isOpen) return;
			const target = e.target as HTMLElement;
			if (!target.closest('.quick-context-menu')) {
				isOpen = false;
			}
		}

		function handleGlobalKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape' && isOpen) {
				isOpen = false;
			}
		}

		function handleGlobalScroll() {
			if (isOpen) {
				isOpen = false;
			}
		}

		window.addEventListener('contextmenu', handleContextMenu, { capture: true });
		window.addEventListener('click', handleGlobalClick, { capture: true });
		window.addEventListener('keydown', handleGlobalKeyDown);
		window.addEventListener('scroll', handleGlobalScroll, { passive: true });

		return () => {
			unsubTheme();
			window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
			window.removeEventListener('click', handleGlobalClick, { capture: true });
			window.removeEventListener('keydown', handleGlobalKeyDown);
			window.removeEventListener('scroll', handleGlobalScroll);
		};
	});

	function navigateTo(path: string) {
		isOpen = false;
		goto(path);
	}

	function handleReload() {
		isOpen = false;
		window.location.reload();
	}

	function handleGoBack() {
		isOpen = false;
		window.history.back();
	}

	function toggleTheme() {
		const nextTheme: ThemePreset = currentTheme === 'dark' ? 'light' : 'dark';
		themeStore.setTheme(nextTheme);
		toastStore.show({ message: `🎨 Tema applicato: ${nextTheme === 'dark' ? 'SCURO' : 'CHIARO'}` });
	}

	const navItems = [
		{ href: '/', label: 'Home', icon: '/emoji/house_3d.png', key: 'H' },
		{ href: '/flashcard', label: 'Flashcard & Studio', icon: '/emoji/open_book_3d.png', key: 'F' },
		{ href: '/quiz', label: 'Quiz Multiplo', icon: '/emoji/bullseye_3d.png', key: 'Q' },
		{ href: '/reels', label: 'Reels Ferroviari', icon: '/emoji/train_3d.png', key: 'R' },
		{ href: '/notes', label: 'Vault Appunti', icon: '/emoji/spiral_notebook_3d.png', key: 'N' },
		{ href: '/wiki', label: 'Glossario Wiki', icon: '/emoji/bookmark_tabs_3d.png', key: 'W' },
		{ href: '/missions', label: 'Missioni & XP', icon: '/emoji/trophy_3d.png', key: 'M' }
	];
</script>

{#if isOpen}
	<!-- Backdrop trasparente per catturare click esterni -->
	<div
		class="quick-menu-backdrop"
		onclick={() => (isOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (isOpen = false)}
		role="presentation"
	></div>

	<!-- Menu Rapido Contestuale -->
	<div
		class="quick-context-menu duo-card"
		style="left: {menuX}px; top: {menuY}px;"
		role="menu"
		tabindex="-1"
	>
		<!-- Header -->
		<div class="menu-header">
			<div class="menu-title-group">
				<span class="menu-title-icon">⚡</span>
				<span class="menu-title-text">MENU RAPIDO</span>
			</div>
			<button
				type="button"
				class="menu-close-btn"
				onclick={() => (isOpen = false)}
				title="Chiudi menu"
			>
				✕
			</button>
		</div>

		<!-- Navigazione Sezioni Principali -->
		<div class="menu-section">
			<span class="menu-section-label">NAVIGAZIONE</span>
			<div class="menu-items-list">
				{#each navItems as item}
					{@const isActive = page.url.pathname === item.href}
					<button
						type="button"
						class="menu-item-btn"
						class:active={isActive}
						onclick={() => navigateTo(item.href)}
					>
						<img src={item.icon} alt="" class="menu-item-img" />
						<span class="menu-item-name">{item.label}</span>
						{#if isActive}
							<span class="active-dot">●</span>
						{/if}
					</button>
				{/each}
			</div>
		</div>

		<!-- Separatore -->
		<div class="menu-divider"></div>

		<!-- Azioni e Strumenti Rapidi -->
		<div class="menu-section">
			<span class="menu-section-label">AZIONI RAPIDE</span>
			<div class="menu-actions-grid">
				<button
					type="button"
					class="menu-action-btn"
					onclick={toggleTheme}
					title="Cambia tema visivo"
				>
					<span>🎨</span>
					<span class="action-btn-text">Tema ({currentTheme})</span>
				</button>

				<button
					type="button"
					class="menu-action-btn"
					onclick={handleReload}
					title="Ricarica la pagina corrente"
				>
					<span>🔄</span>
					<span class="action-btn-text">Ricarica</span>
				</button>

				<button
					type="button"
					class="menu-action-btn"
					onclick={handleGoBack}
					title="Torna alla schermata precedente"
				>
					<span>⬅️</span>
					<span class="action-btn-text">Indietro</span>
				</button>

				{#if user && (user.isAdmin || user.role === 'admin')}
					<button
						type="button"
						class="menu-action-btn admin-action-btn"
						onclick={() => navigateTo('/admin')}
						title="Accedi al pannello amministratore"
					>
						<span>🔐</span>
						<span class="action-btn-text">Admin</span>
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.quick-menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 9998;
		background: transparent;
	}

	.quick-context-menu {
		position: fixed;
		z-index: 9999;
		width: 250px;
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		border-bottom: 4px solid var(--border-depth-color);
		border-radius: 18px;
		padding: 0.55rem;
		box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		box-sizing: border-box;
		animation: menuPop 0.16s cubic-bezier(0.34, 1.56, 0.64, 1);
		user-select: none;
	}

	@keyframes menuPop {
		0% {
			opacity: 0;
			transform: scale(0.92) translateY(4px);
		}
		100% {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.menu-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.2rem 0.4rem 0.4rem 0.4rem;
		border-bottom: 1.5px solid var(--border-color);
	}

	.menu-title-group {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.menu-title-icon {
		font-size: 0.95rem;
	}

	.menu-title-text {
		font-family: 'Outfit', sans-serif;
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		color: var(--accent-color);
	}

	.menu-close-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 800;
		cursor: pointer;
		padding: 0.2rem 0.35rem;
		border-radius: 6px;
		transition: all 0.12s ease;
	}

	.menu-close-btn:hover {
		color: var(--text-color);
		background: var(--hover-bg);
	}

	.menu-section {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.menu-section-label {
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		padding: 0 0.4rem;
	}

	.menu-items-list {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.menu-item-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.38rem 0.55rem;
		border-radius: 10px;
		border: 1.5px solid transparent;
		background: transparent;
		color: var(--text-color);
		font-family: 'Outfit', sans-serif;
		font-size: 0.78rem;
		font-weight: 700;
		cursor: pointer;
		text-align: left;
		transition: all 0.12s ease;
		box-sizing: border-box;
		width: 100%;
	}

	.menu-item-btn:hover {
		background: var(--card-bg-subtle);
		border-color: var(--border-color);
		transform: translateX(2px);
	}

	.menu-item-btn.active {
		background: var(--active-nav-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
		font-weight: 800;
	}

	.menu-item-img {
		width: 18px;
		height: 18px;
		object-fit: contain;
		flex-shrink: 0;
	}

	.menu-item-name {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.active-dot {
		color: var(--accent-color);
		font-size: 0.6rem;
	}

	.menu-divider {
		height: 1px;
		background: var(--border-color);
		margin: 0.1rem 0.2rem;
	}

	.menu-actions-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.3rem;
	}

	.menu-action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.38rem 0.45rem;
		border-radius: 9px;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		color: var(--text-color);
		font-family: 'Outfit', sans-serif;
		font-size: 0.72rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.12s ease;
		white-space: nowrap;
	}

	.menu-action-btn:hover {
		border-color: var(--accent-color);
		background: var(--hover-bg);
	}

	.menu-action-btn.admin-action-btn {
		border-color: var(--purple-color);
		color: var(--purple-color);
	}
</style>
