<script lang="ts">
	import { onMount } from 'svelte';
	import { themeStore, THEME_OPTIONS, type ThemePreset } from '$lib/stores/themeStore';
	import { statsStore, type StatsData } from '$lib/stores/statsStore';
	import ThemeModal from '$lib/components/ThemeModal.svelte';

	let currentTheme = $state<ThemePreset>('dark');
	let isThemeModalOpen = $state(false);
	let stats = $state<StatsData>({
		cardsStudied: 0,
		quizAnswered: 0,
		quizCorrect: 0,
		streakDays: 1,
		lastStudiedDate: '',
		favorites: []
	});

	onMount(() => {
		const unTheme = themeStore.subscribe((t) => {
			currentTheme = t;
		});
		const unStats = statsStore.subscribe((s) => {
			stats = s;
		});
		return () => {
			unTheme();
			unStats();
		};
	});

	let activeThemeObj = $derived(THEME_OPTIONS.find((t) => t.id === currentTheme) || THEME_OPTIONS[0]);
</script>

<header class="app-header">
	<div class="header-container">
		<!-- Brand Logo & Flag -->
		<a href="/" class="brand">
			<span class="flag-icon" title="Corso Italiano RFI">🇮🇹</span>
			<div class="title-group">
				<span class="app-title">RF</span>
				<span class="app-subtitle">Rail Focus</span>
			</div>
		</a>

		<!-- Duolingo Top Stats Pill Row -->
		<div class="duo-top-stats">
			<!-- Streak Flame -->
			<div class="stat-pill streak" title="Giorni di slancio consecutivi">
				<span class="pill-icon">🔥</span>
				<span class="pill-value">{stats.streakDays}</span>
			</div>

			<!-- Gems / Studied Cards -->
			<div class="stat-pill gems" title="Totale schede imparate">
				<span class="pill-icon">💎</span>
				<span class="pill-value">{stats.cardsStudied * 10 + 100}</span>
			</div>

			<!-- Energy / XP Hearts -->
			<div class="stat-pill energy" title="Punti XP guadagnati">
				<span class="pill-icon">⚡</span>
				<span class="pill-value">{stats.quizCorrect * 15 + stats.cardsStudied * 5}</span>
			</div>
		</div>

		<!-- Action Buttons -->
		<div class="actions">
			<!-- Theme Selector Button -->
			<button
				class="duo-header-btn theme-btn"
				onclick={() => (isThemeModalOpen = true)}
				aria-label="Scegli tema"
				title="Personalizza Tema"
			>
				<span class="theme-dot" style="background: {activeThemeObj.color}"></span>
				<span class="theme-name-text">{activeThemeObj.name}</span>
			</button>

			<a href="/admin" class="duo-header-btn admin-link" aria-label="Pannello Amministratore" title="Admin">
				<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>
					<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
				</svg>
			</a>
		</div>
	</div>
</header>

<ThemeModal
	isOpen={isThemeModalOpen}
	onClose={() => (isThemeModalOpen = false)}
/>

<style>
	.app-header {
		position: sticky;
		top: 0;
		z-index: 50;
		background-color: var(--header-bg);
		border-bottom: 2px solid var(--border-color);
		transition: background-color 0.3s ease, border-color 0.3s ease;
	}

	.header-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0.6rem 1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		text-decoration: none;
		color: var(--text-color);
	}

	.flag-icon {
		font-size: 1.6rem;
		line-height: 1;
		padding: 0.2rem;
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		border-radius: 8px;
	}

	.title-group {
		display: flex;
		flex-direction: column;
		line-height: 1;
	}

	.app-title {
		font-weight: 900;
		font-size: 1.2rem;
		letter-spacing: -0.02em;
		color: var(--accent-color);
	}

	.app-subtitle {
		font-size: 0.65rem;
		font-weight: 800;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	/* Duolingo Top Stats */
	.duo-top-stats {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.stat-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.65rem;
		border-radius: 12px;
		font-weight: 800;
		font-size: 0.9rem;
		user-select: none;
		border: 1.5px solid transparent;
	}

	.stat-pill.streak {
		color: var(--orange-color);
	}

	.stat-pill.gems {
		color: var(--accent-color);
	}

	.stat-pill.energy {
		color: var(--pink-color);
	}

	.pill-icon {
		font-size: 1.1rem;
		line-height: 1;
	}

	.pill-value {
		font-family: 'Outfit', sans-serif;
		font-weight: 900;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.duo-header-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.75rem;
		border-radius: 12px;
		background-color: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-bottom: 3px solid var(--border-depth-color);
		color: var(--text-color);
		font-size: 0.8rem;
		font-weight: 800;
		cursor: pointer;
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.duo-header-btn:hover {
		background-color: var(--hover-bg);
		border-color: var(--accent-color);
	}

	.duo-header-btn:active {
		transform: translateY(1px);
		border-bottom-width: 1.5px;
	}

	.theme-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.icon {
		width: 18px;
		height: 18px;
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
			padding: 0.5rem 0.75rem;
		}
		.stat-pill {
			padding: 0.25rem 0.45rem;
			font-size: 0.8rem;
		}
	}
</style>

