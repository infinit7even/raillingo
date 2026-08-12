<script lang="ts">
	import { onMount } from 'svelte';
	import { themeStore, type ThemePreset } from '$lib/stores/themeStore';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { pwaStore } from '$lib/stores/pwaStore';
	import QuickAddCardModal from '$lib/components/QuickAddCardModal.svelte';
	import type { Card } from '$lib/types/cards';

	let currentTheme = $state<ThemePreset>('dark');
	let cards = $state<Card[]>([]);
	let isQuickAddOpen = $state(false);
	let canInstall = $state(false);

	onMount(() => {
		const unTheme = themeStore.subscribe((t) => (currentTheme = t));
		const unCards = cardsStore.subscribe((c) => (cards = c));
		const unPwa = pwaStore.subscribe(() => {
			canInstall = pwaStore.canInstall;
		});

		return () => {
			unTheme();
			unCards();
			unPwa();
		};
	});

	async function handleInstallApp() {
		await pwaStore.promptInstall();
	}
</script>

<header class="app-header">
	<div class="header-container">
		<!-- Brand Logo & Flag -->
		<a href="/" class="brand">
			<img src="/emoji/triangular_flag_3d.png" alt="Bandiera" class="emoji-img flag-img" />
			<div class="title-group">
				<span class="app-title">
					Rai<span class="ll-track-box">l<img src="/emoji/railway_track_3d.png" alt="Binario" class="brand-track-img-sm" />l</span>ingo
				</span>
				<span class="app-subtitle">Rail Focus</span>
			</div>
		</a>

		<!-- Action Buttons (Mobile Optimized) -->
		<div class="actions">
			{#if canInstall}
				<button
					class="duo-header-btn install-header-btn"
					onclick={handleInstallApp}
					aria-label="Installa App"
					title="Installa l'App"
				>
					<span class="btn-icon">📲</span>
					<span class="btn-text">INSTALLA</span>
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
<QuickAddCardModal
	isOpen={isQuickAddOpen}
	onClose={() => (isQuickAddOpen = false)}
	{cards}
/>

<style>
	.app-header {
		position: sticky;
		top: 0.65rem;
		z-index: 150;
		width: calc(100% - 1.25rem);
		max-width: 1200px;
		margin: 0.5rem auto 0 auto;
		background-color: var(--card-bg);
		border: 2px solid var(--border-color);
		border-bottom: 4px solid var(--border-depth-color);
		border-radius: 24px;
		box-shadow: none;
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		transition: background-color 0.3s ease, border-color 0.3s ease, transform 0.2s ease;
	}

	.header-container {
		padding: 0.5rem 0.85rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		text-decoration: none;
		color: var(--text-color);
	}

	.emoji-img {
		object-fit: contain;
		display: inline-block;
	}

	.flag-img {
		width: 30px;
		height: 30px;
		filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));
	}

	.title-group {
		display: flex;
		flex-direction: column;
	}

	.app-title {
		font-size: 1.25rem;
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
		font-size: 0.65rem;
		font-weight: 800;
		color: var(--accent-color);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.duo-header-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.45rem 0.75rem;
		border-radius: 14px;
		background-color: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-bottom: 3px solid var(--border-depth-color);
		color: var(--text-color);
		font-size: 0.8rem;
		font-weight: 800;
		cursor: pointer;
		text-decoration: none;
		transition: transform 0.1s ease, border-width 0.1s ease;
		white-space: nowrap;
		user-select: none;
	}

	.duo-header-btn:active {
		transform: translateY(2px);
		border-bottom-width: 1.5px;
	}

	.install-header-btn {
		background: rgba(88, 204, 2, 0.15);
		border-color: var(--green-color);
		color: var(--green-color);
	}

	.btn-icon, .theme-icon-symbol {
		font-size: 1rem;
		line-height: 1;
	}

	@media (min-width: 1024px) {
		.app-header {
			display: none;
		}
	}

	@media (max-width: 640px) {
		.app-subtitle {
			display: none;
		}
		.header-container {
			padding: 0.45rem 0.75rem;
		}
		.flag-img {
			width: 26px;
			height: 26px;
		}
		.app-title {
			font-size: 1.15rem;
		}
		.duo-header-btn {
			padding: 0.4rem 0.65rem;
			font-size: 0.78rem;
		}
		.theme-name-text {
			display: none;
		}
	}
</style>
