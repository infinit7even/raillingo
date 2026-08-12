<script lang="ts">
	import { onMount } from 'svelte';
	import { themeStore, type ThemePreset } from '$lib/stores/themeStore';
	import { cardsStore } from '$lib/stores/cardsStore';
	import QuickAddCardModal from '$lib/components/QuickAddCardModal.svelte';
	import WikiSearchModal from '$lib/components/WikiSearchModal.svelte';
	import type { Card } from '$lib/types/cards';

	let currentTheme = $state<ThemePreset>('dark');
	let cards = $state<Card[]>([]);
	let isQuickAddOpen = $state(false);
	let isWikiSearchOpen = $state(false);

	onMount(() => {
		const unTheme = themeStore.subscribe((t) => (currentTheme = t));
		const unCards = cardsStore.subscribe((c) => (cards = c));
		return () => {
			unTheme();
			unCards();
		};
	});
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

		<!-- Action Buttons (Mobile Accessible) -->
		<div class="actions">
			<!-- Quick Search Button -->
			<button
				class="duo-header-btn search-btn"
				onclick={() => (isWikiSearchOpen = true)}
				aria-label="Cerca acronimi"
				title="Ricerca Rapida Wiki"
			>
				<span class="btn-icon">🔍</span>
				<span class="btn-text">Wiki</span>
			</button>

			<!-- Quick Add Card Button -->
			<button
				class="duo-header-btn add-btn"
				onclick={() => (isQuickAddOpen = true)}
				aria-label="Aggiungi Scheda"
				title="Aggiungi Scheda Rapida"
			>
				<span class="btn-icon">⚡</span>
				<span class="btn-text">+ Scheda</span>
			</button>

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

<!-- Global Modals triggered from Header -->
<QuickAddCardModal
	isOpen={isQuickAddOpen}
	onClose={() => (isQuickAddOpen = false)}
	{cards}
/>

<WikiSearchModal
	isOpen={isWikiSearchOpen}
	onClose={() => (isWikiSearchOpen = false)}
	{cards}
/>

<style>
	.app-header {
		position: sticky;
		top: 0;
		z-index: 150;
		background-color: var(--header-bg);
		border-bottom: 2px solid var(--border-color);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
		backdrop-filter: blur(12px);
		transition: background-color 0.3s ease, border-color 0.3s ease;
	}

	.header-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0.5rem 0.85rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
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
	}

	.app-subtitle {
		font-size: 0.68rem;
		font-weight: 800;
		color: var(--accent-color);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.duo-header-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.4rem 0.6rem;
		border-radius: 12px;
		background-color: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-bottom: 3px solid var(--border-depth-color);
		color: var(--text-color);
		font-size: 0.78rem;
		font-weight: 800;
		cursor: pointer;
		text-decoration: none;
		transition: all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
		white-space: nowrap;
	}

	.duo-header-btn:active {
		transform: translateY(2px);
		border-bottom-width: 1.5px;
	}

	.add-btn {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.search-btn {
		background: var(--card-bg-subtle);
		border-color: var(--border-color);
	}

	.btn-icon, .theme-icon-symbol {
		font-size: 0.95rem;
		line-height: 1;
	}

	@media (min-width: 1024px) {
		.app-header {
			display: none;
		}
	}

	@media (max-width: 640px) {
		.app-subtitle, .theme-name-text {
			display: none;
		}
		.header-container {
			padding: 0.35rem 0.5rem;
		}
		.flag-img {
			width: 24px;
			height: 24px;
		}
		.app-title {
			font-size: 1.05rem;
		}
		.duo-header-btn {
			padding: 0.35rem 0.45rem;
			font-size: 0.75rem;
		}
	}
</style>

