<script lang="ts">
	import { onMount } from 'svelte';
	import { navStore } from '$lib/stores/navStore';
	import { statsStore, type StatsData } from '$lib/stores/statsStore';

	let isNavOpen = $state(false);
	let stats = $state<StatsData>({
		cardsStudied: 0,
		quizAnswered: 0,
		quizCorrect: 0,
		streakDays: 1,
		lastStudiedDate: '',
		favorites: []
	});

	let totalXP = $derived(stats.quizCorrect * 15 + stats.cardsStudied * 5);
	let gems = $derived(stats.quizCorrect * 10 + 100);

	onMount(() => {
		const unNav = navStore.subscribe((o) => (isNavOpen = o));
		const unStats = statsStore.subscribe((s) => (stats = s));

		return () => {
			unNav();
			unStats();
		};
	});
</script>

<header class="app-header">
	<!-- Hamburger Menu Toggle Button (Mobile) -->
	<button
		type="button"
		class="duo-header-btn menu-toggle-btn"
		onclick={() => navStore.toggle()}
		aria-label="Menu navigazione"
		title="Apri menu navigazione"
	>
		<div class="hamburger-icon" class:open={isNavOpen}>
			<span></span>
			<span></span>
			<span></span>
		</div>
	</button>

	<!-- Statistiche (Serie, Gemme, XP) -->
	<a href="/missioni" class="header-stats" title="Clicca per aprire le Missioni ed i Dettagli">
		<div class="hstat-item streak">
			<img src="/emoji/fire_3d.png" alt="Serie" class="hstat-emoji" />
			<div class="hstat-text">
				<span class="hstat-lbl">Serie</span>
				<span class="hstat-val">{stats.streakDays}</span>
			</div>
		</div>
		<div class="hstat-item gems">
			<img src="/emoji/gem_stone_3d.png" alt="Gemme" class="hstat-emoji" />
			<div class="hstat-text">
				<span class="hstat-lbl">Gemme</span>
				<span class="hstat-val">{gems}</span>
			</div>
		</div>
		<div class="hstat-item hearts">
			<img src="/emoji/high_voltage_3d.png" alt="XP" class="hstat-emoji" />
			<div class="hstat-text">
				<span class="hstat-lbl">XP</span>
				<span class="hstat-val">{totalXP}</span>
			</div>
		</div>
	</a>
</header>

<style>
	.app-header {
		position: sticky;
		top: 0.65rem;
		z-index: 150;
		width: calc(100% - 1.25rem);
		max-width: 1200px;
		margin: 0.5rem auto 0 auto;
		display: flex;
		align-items: stretch;
		gap: 0.6rem;
	}

	.menu-toggle-btn {
		padding: 0.45rem 0.55rem;
	}

	.hamburger-icon {
		width: 18px;
		height: 14px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.hamburger-icon span {
		display: block;
		height: 2.2px;
		width: 100%;
		background-color: var(--text-color);
		border-radius: 2px;
		transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
		transform-origin: center;
	}

	.hamburger-icon.open span:nth-child(1) {
		transform: translateY(6px) rotate(45deg);
	}

	.hamburger-icon.open span:nth-child(2) {
		opacity: 0;
		transform: scaleX(0);
	}

	.hamburger-icon.open span:nth-child(3) {
		transform: translateY(-6px) rotate(-45deg);
	}

	.header-stats {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: space-around;
		gap: 0.5rem;
		text-decoration: none;
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		border-bottom: 4px solid var(--border-depth-color);
		border-radius: 20px;
		padding: 0.6rem 0.75rem;
	}

	.hstat-item {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-weight: 900;
		font-size: 0.95rem;
	}

	.hstat-item.streak { color: var(--orange-color); }
	.hstat-item.gems { color: var(--accent-color); }
	.hstat-item.hearts { color: var(--pink-color); }

	.hstat-emoji {
		width: 24px;
		height: 24px;
		object-fit: contain;
	}

	.hstat-text {
		display: flex;
		flex-direction: column;
		line-height: 1;
	}

	.hstat-lbl {
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		opacity: 0.8;
	}

	.hstat-val {
		font-size: 1.05rem;
		font-weight: 900;
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

	@media (min-width: 1024px) {
		.app-header {
			display: none;
		}
	}

	@media (max-width: 640px) {
		.app-header {
			gap: 0.5rem;
		}
		.duo-header-btn {
			padding: 0.4rem 0.6rem;
			font-size: 0.78rem;
		}
		.header-stats {
			padding: 0.5rem 0.5rem;
			gap: 0.25rem;
			border-radius: 16px;
		}
		.hstat-emoji {
			width: 20px;
			height: 20px;
		}
		.hstat-item {
			gap: 0.3rem;
			font-size: 0.9rem;
		}
		.hstat-lbl {
			font-size: 0.58rem;
		}
	}
</style>
