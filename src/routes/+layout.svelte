<script lang="ts">
	import '../app.css';
	import Header from '$lib/components/Header.svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import { goto, onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { fade } from 'svelte/transition';
	import { navStore } from '$lib/stores/navStore';

	let { data, children } = $props();

	let user = $derived(data?.user);

	// Chiudi la tendina mobile ad ogni navigazione
	onNavigate(() => {
		navStore.close();
	});

	// Route sequence for lateral swipe navigation
	const routeOrder = ['/', '/flashcard', '/quiz', '/reels', '/scrittura', '/wiki'];
	const swipeRoutes = [
		{ href: '/', label: 'Home', color: 'var(--accent-color)' },
		{ href: '/flashcard', label: 'Flashcard', color: 'var(--green-color)' },
		{ href: '/quiz', label: 'Quiz', color: 'var(--purple-color)' },
		{ href: '/reels', label: 'Reels', color: 'var(--orange-color)' },
		{ href: '/scrittura', label: 'Scrittura', color: '#ff5e5b' },
		{ href: '/wiki', label: 'Wiki', color: 'var(--accent-color)' }
	];

	let activeSwipeIndex = $derived(routeOrder.indexOf(page.url.pathname));

	let touchStartX = 0;
	let touchStartY = 0;
	let touchStartTime = 0;

	function handleTouchStart(e: TouchEvent) {
		const target = e.target as HTMLElement;
		// Don't swipe if typing in input/textarea, inside modals or scroll boxes
		if (
			target.tagName === 'INPUT' ||
			target.tagName === 'TEXTAREA' ||
			target.closest('.modal-backdrop') ||
			target.closest('.nav-scroll-wrapper')
		) {
			return;
		}
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
		touchStartTime = Date.now();
	}

	function handleTouchEnd(e: TouchEvent) {
		if (!touchStartX || !touchStartY) return;

		const touchEndX = e.changedTouches[0].clientX;
		const touchEndY = e.changedTouches[0].clientY;
		const touchDuration = Date.now() - touchStartTime;

		const diffX = touchEndX - touchStartX;
		const diffY = touchEndY - touchStartY;

		const isHorizontalSwipe = Math.abs(diffX) > Math.abs(diffY) * 1.5;
		const isFastSwipe = touchDuration < 300 && Math.abs(diffX) > 25;
		const isDistanceSwipe = Math.abs(diffX) > 40;

		if ((isFastSwipe || isDistanceSwipe) && isHorizontalSwipe) {
			// Swipe da bordo sinistro (primi 50px) verso destra -> Apri Tendina
			if (diffX > 0 && touchStartX <= 50) {
				navStore.open();
				touchStartX = 0;
				touchStartY = 0;
				return;
			}

			const currentPath = page.url.pathname;
			const currentIndex = routeOrder.indexOf(currentPath);

			if (currentIndex !== -1) {
				if (diffX < 0 && currentIndex < routeOrder.length - 1) {
					// Swipe verso sinistra -> Pagina successiva
					goto(routeOrder[currentIndex + 1]);
				} else if (diffX > 0 && currentIndex > 0 && touchStartX > 50) {
					// Swipe verso destra (fuori dal bordo sinistro) -> Pagina precedente
					goto(routeOrder[currentIndex - 1]);
				}
			}
		}

		touchStartX = 0;
		touchStartY = 0;
		touchStartTime = 0;
	}
</script>

<svelte:head>
	<title>Raillingo</title>
	<meta name="robots" content="noindex, nofollow" />
	<meta name="googlebot" content="noindex, nofollow" />
	<meta
		name="description"
		content="Raillingo - PWA in stile Duolingo per imparare e memorizzare gli acronimi e i concetti del corso ferroviario RFI."
	/>
	<meta
		name="viewport"
		content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
	/>
	<meta name="theme-color" content="#0f172a" />
	<link rel="shortcut icon" href="/favicon.ico" />
	<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
	<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
	<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
	<link rel="apple-touch-icon" sizes="180x180" href="/apple-icon-180x180.png" />
	<link rel="apple-touch-icon" href="/apple-icon.png" />
	<link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

<div
	class="layout-wrapper"
	role="presentation"
	ontouchstart={handleTouchStart}
	ontouchend={handleTouchEnd}
>
	<Header />

	<main class="main-content">
		{#key page.url.pathname}
			<div
				in:fade={{ duration: 120, delay: 40 }}
				out:fade={{ duration: 80 }}
				class="page-transition-wrapper"
			>
				{@render children()}
			</div>
		{/key}
	</main>

	<!-- 📍 Indicatore di Navigazione Swipe per Mobile -->
	{#if activeSwipeIndex !== -1}
		<nav class="mobile-swipe-indicator" aria-label="Pagine dello swipe">
			{#each swipeRoutes as route, idx}
				<a
					href={route.href}
					class="swipe-dot"
					class:active={idx === activeSwipeIndex}
					style="--dot-color: {route.color}"
					aria-label="Vai alla pagina {route.label}"
					title={route.label}
				></a>
			{/each}
		</nav>
	{/if}

	<Navbar {user} />
</div>

<style>
	.layout-wrapper {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.main-content {
		flex: 1;
		width: 100%;
		max-width: 600px;
		margin: 0 auto;
		padding: 0.6rem 0.85rem 1.5rem 0.85rem;
		box-sizing: border-box;
		contain: layout style;
	}

	.page-transition-wrapper {
		width: 100%;
	}

	/* 📍 Floating Mobile Swipe Pagination Indicator */
	.mobile-swipe-indicator {
		position: fixed;
		bottom: calc(0.65rem + var(--safe-area-bottom, 0px));
		left: 50%;
		transform: translateX(-50%);
		z-index: 140;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.65rem;
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		border-radius: 9999px;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		transition:
			background-color 0.3s ease,
			border-color 0.3s ease;
	}

	.swipe-dot {
		width: 7px;
		height: 7px;
		border-radius: 9999px;
		background-color: var(--text-muted);
		opacity: 0.4;
		transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
		display: block;
		text-decoration: none;
	}

	.swipe-dot:hover {
		opacity: 0.75;
	}

	.swipe-dot.active {
		width: 22px;
		background-color: var(--dot-color, var(--accent-color));
		opacity: 1;
		box-shadow: 0 2px 8px color-mix(in srgb, var(--dot-color, var(--accent-color)) 45%, transparent);
	}

	@media (min-width: 1024px) {
		.layout-wrapper {
			padding-left: 240px;
		}

		.main-content {
			max-width: 1200px;
			padding: 1rem 1.5rem 1.5rem 1.5rem;
		}

		.mobile-swipe-indicator {
			display: none !important;
		}
	}
</style>
