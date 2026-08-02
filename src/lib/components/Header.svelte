<script lang="ts">
	import { onMount } from 'svelte';
	import { themeStore, THEME_OPTIONS, type ThemePreset } from '$lib/stores/themeStore';
	import { statsStore, type StatsData } from '$lib/stores/statsStore';

	let currentTheme = $state<ThemePreset>('dark');
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
			<img src="/emoji/triangular_flag_3d.png" alt="Bandiera" class="emoji-img flag-img" />
			<div class="title-group">
				<span class="app-title">
					Rai<span class="ll-rail-font">ll</span>ingo
				</span>
				<span class="app-subtitle">Rail Focus</span>
			</div>
		</a>

		<!-- Duolingo Top Stats Pill Row with Fluent UI 3D Emojis -->
		<div class="duo-top-stats">
			<!-- Streak Flame -->
			<div class="stat-pill streak" title="Giorni di slancio consecutivi">
				<img src="/emoji/fire_3d.png" alt="Serie" class="emoji-img pill-emoji" />
				<span class="pill-value">{stats.streakDays}</span>
			</div>

			<!-- Gems / Studied Cards -->
			<div class="stat-pill gems" title="Totale schede imparate">
				<img src="/emoji/gem_stone_3d.png" alt="Gemme" class="emoji-img pill-emoji" />
				<span class="pill-value">{stats.cardsStudied * 10 + 100}</span>
			</div>

			<!-- Energy / XP Hearts -->
			<div class="stat-pill energy" title="Punti XP guadagnati">
				<img src="/emoji/high_voltage_3d.png" alt="XP" class="emoji-img pill-emoji" />
				<span class="pill-value">{stats.quizCorrect * 15 + stats.cardsStudied * 5}</span>
			</div>
		</div>

		<!-- Action Buttons -->
		<div class="actions">
			<!-- Theme Selector Button -->
			<button
				class="duo-header-btn theme-btn"
				onclick={() => themeStore.setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
				aria-label="Cambia tema"
				title="Alterna Scuro/Chiaro"
			>
				<span class="theme-dot" style="background: {activeThemeObj.color}"></span>
				<span class="theme-name-text">{currentTheme === 'dark' ? 'Scuro' : 'Chiaro'}</span>
			</button>
		</div>
	</div>
</header>

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

	.emoji-img {
		object-fit: contain;
		display: inline-block;
	}

	.flag-img {
		width: 28px;
		height: 28px;
	}

	.pill-emoji {
		width: 22px;
		height: 22px;
	}

	.title-group {
		display: flex;
		flex-direction: column;
		line-height: 1;
	}

	.app-title {
		font-weight: 900;
		font-size: 1.25rem;
		letter-spacing: -0.03em;
		color: var(--accent-color);
	}

	.ll-rail-font {
		position: relative;
		display: inline-block;
		letter-spacing: 0.04em;
	}

	.ll-rail-font::after {
		content: '';
		position: absolute;
		left: 1px;
		right: 1px;
		top: 25%;
		bottom: 15%;
		background: linear-gradient(
			to bottom,
			currentColor 0%, currentColor 15%,
			transparent 15%, transparent 40%,
			currentColor 40%, currentColor 55%,
			transparent 55%, transparent 80%,
			currentColor 80%, currentColor 95%
		);
		opacity: 0.85;
		pointer-events: none;
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

