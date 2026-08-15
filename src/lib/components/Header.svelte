<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { fly, fade } from 'svelte/transition';
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

	let currentPath = $derived(page.url.pathname);

	const pageHeaders: Record<
		string,
		{ title: string; subtitle?: string; icon: string; variant: 'green' | 'blue' | 'purple' | 'orange' | 'red' }
	> = {
		'/flashcard': {
			title: 'Ripasso & Flashcard',
			subtitle: 'Memoria visiva e concetti',
			icon: '/emoji/open_book_3d.png',
			variant: 'green'
		},
		'/quiz': {
			title: 'Quiz Scelta Multipla',
			subtitle: 'Metti alla prova la memoria',
			icon: '/emoji/star_3d.png',
			variant: 'purple'
		},
		'/reels': {
			title: 'Reels Ferroviari',
			subtitle: 'Feed dinamico schede visive',
			icon: '/emoji/camera_3d.png',
			variant: 'orange'
		},
		'/wiki': {
			title: 'Wiki & Dizionario',
			subtitle: 'Consultazione acronimi',
			icon: '/emoji/books_3d.png',
			variant: 'blue'
		},
		'/missions': {
			title: 'Missioni & Sfide',
			subtitle: 'Traguardi giornalieri',
			icon: '/emoji/bullseye_3d.png',
			variant: 'green'
		},
		'/admin': {
			title: 'Pannello Admin',
			subtitle: 'Gestione schede',
			icon: '/emoji/star_3d.png',
			variant: 'blue'
		},
		'/notes': {
			title: 'Appunti di Studio',
			subtitle: 'Quaderno digitale e sintesi concetti',
			icon: '/emoji/clipboard_3d.png',
			variant: 'orange'
		},
		'/privacy': {
			title: 'Privacy Policy',
			subtitle: 'Informazioni legali',
			icon: '/emoji/books_3d.png',
			variant: 'blue'
		}
	};

	let activeHeader = $derived(pageHeaders[currentPath] || null);

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

	<!-- Content Area in Header: Stats on Home ('/'), Colored Banner on Inner Pages -->
	<div class="header-dynamic-slot">
		{#key currentPath}
			{#if currentPath === '/'}
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
			{:else if activeHeader}
				<div
					class="header-page-banner duo-banner-{activeHeader.variant}"
					in:fly={{ y: 10, duration: 250, delay: 50 }}
					out:fade={{ duration: 100 }}
				>
					<img src={activeHeader.icon} alt="" width="26" height="26" decoding="async" class="banner-icon" />
					<div class="banner-text">
						<h1 class="banner-title">{activeHeader.title}</h1>
						{#if activeHeader.subtitle}
							<span class="banner-subtitle">{activeHeader.subtitle}</span>
						{/if}
					</div>
				</div>
			{/if}
		{/key}
	</div>
</header>

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

	/* Banner Colorati in Top Bar Header su Mobile */
	.header-page-banner {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.35rem 0.85rem;
		border-radius: 18px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
		box-sizing: border-box;
	}

	.duo-banner-green {
		background-color: var(--green-color);
		border: 2px solid var(--green-depth);
		border-bottom: 4px solid var(--green-depth);
		color: #ffffff;
	}

	.duo-banner-blue {
		background-color: var(--accent-color);
		border: 2px solid var(--accent-depth);
		border-bottom: 4px solid var(--accent-depth);
		color: #ffffff;
	}

	.duo-banner-purple {
		background-color: var(--purple-color);
		border: 2px solid var(--purple-depth);
		border-bottom: 4px solid var(--purple-depth);
		color: #ffffff;
	}

	.duo-banner-orange {
		background-color: var(--orange-color);
		border: 2px solid var(--orange-depth);
		border-bottom: 4px solid var(--orange-depth);
		color: #ffffff;
	}

	.duo-banner-red {
		background-color: #ff5e5b;
		border: 2px solid #d9423f;
		border-bottom: 4px solid #d9423f;
		color: #ffffff;
	}

	.banner-icon {
		width: 26px;
		height: 26px;
		object-fit: contain;
		flex-shrink: 0;
	}

	.banner-text {
		display: flex;
		flex-direction: column;
		justify-content: center;
		line-height: 1.1;
		min-width: 0;
	}

	.banner-title {
		font-size: 0.95rem;
		font-weight: 900;
		color: inherit;
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.banner-subtitle {
		font-size: 0.68rem;
		font-weight: 700;
		opacity: 0.9;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
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
