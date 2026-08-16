<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { fly, fade } from 'svelte/transition';
	import { navStore } from '$lib/stores/navStore';
	import { statsStore, type StatsData } from '$lib/stores/statsStore';
	import { themeStore, LIVERY_OPTIONS, type TrainLivery } from '$lib/stores/themeStore';

	let isNavOpen = $state(false);
	let currentLivery = $state<TrainLivery>('regionale');
	let activeLivery = $derived(LIVERY_OPTIONS.find((l) => l.id === currentLivery) ?? LIVERY_OPTIONS[0]);

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

	let currentPath = $derived(page.url.pathname);

	onMount(() => {
		const unNav = navStore.subscribe((o) => (isNavOpen = o));
		const unStats = statsStore.subscribe((s) => (stats = s));
		const unTheme = themeStore.subscribe((st) => (currentLivery = st.livery));

		return () => {
			unNav();
			unStats();
			unTheme();
		};
	});
</script>

{#if currentPath === '/'}
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

		<!-- Pulsante Rapido Cambio Livrea Treno (Mobile) -->
		<button
			type="button"
			class="duo-header-btn livery-quick-btn"
			onclick={() => themeStore.cycleLivery()}
			aria-label="Cambia livrea treno: {activeLivery.name}"
			title="Livrea attiva: {activeLivery.name} ({activeLivery.trainModel}) — Tocca per cambiare"
		>
			<span class="livery-train-emoji">{currentLivery === 'frecciarossa' ? '🚄' : currentLivery === 'intercity' ? '🚆' : '🟢'}</span>
			<div class="livery-text-col">
				<span class="livery-sub-lbl">LIVREA</span>
				<span class="livery-btn-lbl">{activeLivery.name}</span>
			</div>
		</button>

		<!-- Content Area in Header: Stats on Home ('/') -->
		<div class="header-dynamic-slot">
			<a
				href="/missions"
				class="header-stats"
				title="Clicca per aprire le Missioni ed i Dettagli"
				in:fly={{ y: -10, duration: 250, delay: 50 }}
				out:fade={{ duration: 100 }}
			>
				<div class="hstat-item streak">
					<img src="/emoji/fire_3d.png" alt="Serie" width="22" height="22" decoding="async" class="hstat-emoji" />
					<div class="hstat-text">
						<span class="hstat-lbl">Serie</span>
						<span class="hstat-val">{stats.streakDays}</span>
					</div>
				</div>
				<div class="hstat-item gems">
					<img src="/emoji/gem_stone_3d.png" alt="Gemme" width="22" height="22" decoding="async" class="hstat-emoji" />
					<div class="hstat-text">
						<span class="hstat-lbl">Gemme</span>
						<span class="hstat-val">{gems}</span>
					</div>
				</div>
				<div class="hstat-item hearts">
					<img src="/emoji/high_voltage_3d.png" alt="XP" width="22" height="22" decoding="async" class="hstat-emoji" />
					<div class="hstat-text">
						<span class="hstat-lbl">XP</span>
						<span class="hstat-val">{totalXP}</span>
					</div>
				</div>
			</a>
		</div>
	</header>
{/if}

<style>
	.app-header {
		position: relative;
		z-index: 100;
		width: 100%;
		max-width: 600px;
		margin: 0.5rem auto 0.75rem auto;
		padding: 0 0.85rem;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.menu-toggle-btn {
		padding: 0.55rem 0.65rem;
		height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.livery-quick-btn {
		padding: 0.35rem 0.55rem;
		height: 48px;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-shrink: 0;
		border-color: var(--brand-depth);
		border-bottom-color: var(--brand-depth);
		background-color: var(--brand-light-bg);
		transition: transform 0.1s ease, border-color 0.2s ease, background-color 0.2s ease;
	}

	.livery-train-emoji {
		font-size: 1.15rem;
		line-height: 1;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
	}

	.livery-text-col {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		line-height: 1;
		gap: 0.1rem;
	}

	.livery-sub-lbl {
		font-size: 0.55rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.75;
		color: var(--text-color);
	}

	.livery-btn-lbl {
		font-size: 0.75rem;
		font-weight: 900;
		color: var(--brand-color);
		letter-spacing: 0.03em;
		text-transform: uppercase;
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

	.header-dynamic-slot {
		flex: 1;
		position: relative;
		height: 48px;
		display: flex;
		align-items: center;
	}

	.header-stats {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: space-around;
		gap: 0.4rem;
		text-decoration: none;
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		border-bottom: 4px solid var(--border-depth-color);
		border-radius: 18px;
		padding: 0.35rem 0.6rem;
		box-sizing: border-box;
	}

	.hstat-item {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-weight: 900;
		font-size: 0.9rem;
	}

	.hstat-item.streak {
		color: var(--orange-color);
	}
	.hstat-item.gems {
		color: var(--accent-color);
	}
	.hstat-item.hearts {
		color: var(--pink-color);
	}

	.hstat-emoji {
		width: 22px;
		height: 22px;
		object-fit: contain;
	}

	.hstat-text {
		display: flex;
		flex-direction: column;
		line-height: 1;
	}

	.hstat-lbl {
		font-size: 0.6rem;
		font-weight: 800;
		text-transform: uppercase;
		opacity: 0.8;
	}

	.hstat-val {
		font-size: 1rem;
		font-weight: 900;
	}

	.duo-header-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
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
</style>
