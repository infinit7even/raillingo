<script lang="ts">
	import { onMount } from 'svelte';
	import { themeStore, type ThemePreset } from '$lib/stores/themeStore';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { statsStore, type StatsData } from '$lib/stores/statsStore';
	import { pwaStore } from '$lib/stores/pwaStore';
	import { toggleDrawer } from '$lib/stores/drawerStore';
	import QuickAddCardModal from '$lib/components/QuickAddCardModal.svelte';
	import InstallAppModal from '$lib/components/InstallAppModal.svelte';
	import type { Card } from '$lib/types/cards';

	let currentTheme = $state<ThemePreset>('dark');
	let cards = $state<Card[]>([]);
	let isQuickAddOpen = $state(false);
	let isInstallModalOpen = $state(false);
	let canInstall = $state(false);
	let isStandalone = $state(false);

	let stats = $state<StatsData>({
		cardsStudied: 0,
		quizAnswered: 0,
		quizCorrect: 0,
		streakDays: 1,
		lastStudiedDate: '',
		favorites: []
	});

	onMount(() => {
		const unTheme = themeStore.subscribe((t) => (currentTheme = t));
		const unCards = cardsStore.subscribe((c) => (cards = c));
		const unStats = statsStore.subscribe((s) => (stats = s));
		const unPwa = pwaStore.subscribe(() => {
			canInstall = pwaStore.canInstall;
			isStandalone = pwaStore.isStandalone;
		});

		return () => {
			unTheme();
			unCards();
			unStats();
			unPwa();
		};
	});

	async function handleInstallApp() {
		if (canInstall) {
			const success = await pwaStore.promptInstall();
			if (!success) {
				isInstallModalOpen = true;
			}
		} else {
			isInstallModalOpen = true;
		}
	}
</script>

<header class="app-header">
	<div class="header-container">
		<div class="brand-group">
			<!-- Hamburger Menu Button (Mobile Drawer) -->
			<button
				class="duo-header-btn drawer-menu-btn"
				onclick={toggleDrawer}
				aria-label="Apri menu laterale"
				title="Menu nav"
			>
				<span class="hamburger-icon">☰</span>
			</button>

			<!-- Brand Logo & Flag -->
			<a href="/" class="brand">
				<img src="/emoji/triangular_flag_3d.png" alt="Bandiera" class="emoji-img flag-img" />
				<div class="title-group">
					<span class="app-title">
						Rai<span class="ll-track-box"
							>l<img
								src="/emoji/railway_track_3d.png"
								alt="Binario"
								class="brand-track-img-sm"
							/>l</span
						>ingo
					</span>
					<span class="app-subtitle">Rail Focus</span>
				</div>
			</a>
		</div>

		<!-- Action Buttons (Mobile Optimized) -->
		<div class="actions">
			<!-- PWA Install / Download Button -->
			{#if !isStandalone}
				<button
					class="duo-header-btn install-header-btn"
					onclick={handleInstallApp}
					aria-label="Scarica App"
					title="Scarica e Installa l'App"
				>
					<span class="btn-icon">📲</span>
					<span class="btn-text">SCARICA</span>
				</button>
			{/if}

			<!-- Theme Selector Button -->
			<button
				class="duo-header-btn theme-btn"
				onclick={() => themeStore.setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
				aria-label="Cambia tema"
				title="Alterna Scuro/Chiaro"
			>
				<span class="theme-icon-symbol">{currentTheme === 'dark' ? '🌙' : '☀️'}</span>
				<span class="theme-name-text">{currentTheme === 'dark' ? 'Scuro' : 'Chiaro'}</span>
			</button>
		</div>
	</div>
</header>

<!-- Quick 1-Click Add Card Modal -->
<QuickAddCardModal isOpen={isQuickAddOpen} onClose={() => (isQuickAddOpen = false)} {cards} />

<!-- Install App Instructions & Prompt Modal -->
<InstallAppModal isOpen={isInstallModalOpen} onClose={() => (isInstallModalOpen = false)} />

<style>
	.app-header {
		position: sticky;
		top: 0.5rem;
		z-index: 150;
		width: calc(100% - 1rem);
		max-width: 1200px;
		margin: 0.35rem auto 0 auto;
		background-color: var(--card-bg);
		border: 2px solid var(--border-color);
		border-bottom: 4px solid var(--border-depth-color);
		border-radius: 20px;
		box-shadow: 0 4px 16px var(--shadow-color);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		transition:
			background-color 0.3s ease,
			border-color 0.3s ease,
			transform 0.2s ease;
	}

	.header-container {
		padding: 0.45rem 0.75rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
	}

	.brand-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.drawer-menu-btn {
		padding: 0.35rem 0.55rem;
		background: var(--card-bg-subtle);
		border-color: var(--border-color);
	}

	.hamburger-icon {
		font-size: 1.1rem;
		line-height: 1;
		font-weight: 900;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		color: var(--text-color);
	}

	.emoji-img {
		object-fit: contain;
		display: inline-block;
	}

	.flag-img {
		width: 28px;
		height: 28px;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15));
	}

	.title-group {
		display: flex;
		flex-direction: column;
	}

	.app-title {
		font-size: 1.2rem;
		font-weight: 900;
		color: var(--green-color);
		letter-spacing: -0.03em;
		line-height: 1;
		display: inline-flex;
		align-items: center;
	}

	.ll-track-box {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	.brand-track-img-sm {
		width: 0.72em;
		height: 0.72em;
		object-fit: contain;
		margin: 0 -0.04em;
		vertical-align: middle;
	}

	.app-subtitle {
		font-size: 0.62rem;
		font-weight: 800;
		color: var(--accent-color);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.duo-header-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.4rem 0.65rem;
		border-radius: 14px;
		background-color: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-bottom: 3px solid var(--border-depth-color);
		color: var(--text-color);
		font-size: 0.78rem;
		font-weight: 800;
		cursor: pointer;
		text-decoration: none;
		transition:
			transform 0.1s ease,
			border-width 0.1s ease;
		white-space: nowrap;
		user-select: none;
	}

	.duo-header-btn:active {
		transform: translateY(2px);
		border-bottom-width: 1.5px;
	}

	.install-header-btn {
		background: rgba(88, 204, 2, 0.18);
		border-color: var(--green-color);
		border-bottom-color: var(--green-depth);
		color: var(--green-color);
		font-weight: 900;
	}

	.btn-icon,
	.theme-icon-symbol {
		font-size: 0.95rem;
		line-height: 1;
	}

	@media (min-width: 1024px) {
		.app-header {
			display: none;
		}
	}

	@media (max-width: 480px) {
		.app-subtitle {
			display: none;
		}
		.header-container {
			padding: 0.4rem 0.6rem;
		}
		.flag-img {
			width: 24px;
			height: 24px;
		}
		.app-title {
			font-size: 1.1rem;
		}
		.duo-header-btn {
			padding: 0.35rem 0.55rem;
			font-size: 0.75rem;
		}
		.theme-name-text {
			display: none;
		}
	}
</style>
