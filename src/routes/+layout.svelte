<script lang="ts">
	import '../app.css';
	import Header from '$lib/components/Header.svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let { children } = $props();

	// Route sequence for lateral swipe navigation
	const routeOrder = ['/', '/ripasso', '/ripasso-foto', '/ripasso-inverso', '/quiz', '/scrittura', '/reels', '/wiki'];

	let touchStartX = 0;
	let touchStartY = 0;

	function handleTouchStart(e: TouchEvent) {
		const target = e.target as HTMLElement;
		// Don't swipe if typing in input/textarea or inside scrollable reels
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('.reels-feed-container')) {
			return;
		}
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
	}

	function handleTouchEnd(e: TouchEvent) {
		if (!touchStartX || !touchStartY) return;

		const touchEndX = e.changedTouches[0].clientX;
		const touchEndY = e.changedTouches[0].clientY;

		const diffX = touchEndX - touchStartX;
		const diffY = touchEndY - touchStartY;

		// Require horizontal swipe threshold > 60px and diffX dominating diffY
		if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
			const currentPath = page.url.pathname;
			const currentIndex = routeOrder.indexOf(currentPath);

			if (currentIndex !== -1) {
				if (diffX < 0 && currentIndex < routeOrder.length - 1) {
					// Swipe left -> Next route
					goto(routeOrder[currentIndex + 1]);
				} else if (diffX > 0 && currentIndex > 0) {
					// Swipe right -> Previous route
					goto(routeOrder[currentIndex - 1]);
				}
			}
		}

		touchStartX = 0;
		touchStartY = 0;
	}
</script>

<svelte:head>
	<title>RF - Rail Focus | Memorizzazione Acronimi Ferroviari</title>
	<meta name="robots" content="noindex, nofollow" />
	<meta name="googlebot" content="noindex, nofollow" />
	<meta name="description" content="Applicazione PWA per imparare e memorizzare gli acronimi e i concetti del corso ferroviario." />
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
	<meta name="theme-color" content="#0f172a" />
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="apple-touch-icon" href="/favicon.svg" />
</svelte:head>

<div
	class="layout-wrapper"
	role="presentation"
	ontouchstart={handleTouchStart}
	ontouchend={handleTouchEnd}
>
	<Header />
	
	<main class="main-content">
		{@render children()}
	</main>

	<Navbar />
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
		max-width: 1350px;
		margin: 0 auto;
		padding: 1rem 1rem 6rem 1rem;
		box-sizing: border-box;
	}

	@media (min-width: 1024px) {
		.layout-wrapper {
			padding-left: 240px;
		}

		.main-content {
			padding: 1.5rem 2rem 3rem 2rem;
		}
	}
</style>
