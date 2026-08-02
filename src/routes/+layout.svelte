<script lang="ts">
	import '../app.css';
	import Header from '$lib/components/Header.svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let { children } = $props();

	// Route sequence for lateral swipe navigation
	const routeOrder = ['/', '/ripasso', '/quiz', '/reels', '/scrittura', '/wiki'];

	let touchStartX = 0;
	let touchStartY = 0;
	let touchStartTime = 0;

	function handleTouchStart(e: TouchEvent) {
		const target = e.target as HTMLElement;
		// Don't swipe if typing in input/textarea, inside modals, or horizontal scroll boxes
		if (
			target.tagName === 'INPUT' ||
			target.tagName === 'TEXTAREA' ||
			target.closest('.search-modal-backdrop') ||
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

		// Fast swipe gesture (duration < 250ms) or distance > 45px with horizontal dominance
		const isFastSwipe = touchDuration < 250 && Math.abs(diffX) > 30;
		const isDistanceSwipe = Math.abs(diffX) > 45;

		if ((isFastSwipe || isDistanceSwipe) && Math.abs(diffX) > Math.abs(diffY) * 1.6) {
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
		touchStartTime = 0;
	}
</script>

<svelte:head>
	<title>Raillingo | Apprendimento Acronimi Ferroviari</title>
	<meta name="robots" content="noindex, nofollow" />
	<meta name="googlebot" content="noindex, nofollow" />
	<meta name="description" content="Raillingo - PWA in stile Duolingo per imparare e memorizzare gli acronimi e i concetti del corso ferroviario RFI." />
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
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
