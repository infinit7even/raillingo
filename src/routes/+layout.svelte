<script lang="ts">
	import '../app.css';
	import Header from '$lib/components/Header.svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { fade } from 'svelte/transition';
	import { onNavigate } from '$app/navigation';

	import QuickAddCardModal from '$lib/components/QuickAddCardModal.svelte';

	let { data, children } = $props();

	let isQuickAddOpen = $state(false);
	let user = $derived(data?.user);

	// Route sequence for lateral swipe navigation
	const routeOrder = ['/', '/flashcard', '/quiz', '/reels', '/scrittura', '/wiki'];

	let touchStartX = 0;
	let touchStartY = 0;
	let touchStartTime = 0;

	function handleTouchStart(e: TouchEvent) {
		const target = e.target as HTMLElement;
		// Don't swipe if typing in input/textarea, inside modals, or horizontal scroll boxes
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
	<title>Raillingo</title>
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

	{#if user && (user.isAdmin || user.role === 'admin')}
		<button
			type="button"
			class="fab-quick-add"
			onclick={() => (isQuickAddOpen = true)}
			aria-label="Aggiungi Scheda Rapida"
			title="⚡ AGGIUNGI SCHEDA RAPIDA"
		>
			<span class="fab-icon">⚡</span>
			<span class="fab-label">AGGIUNGI SCHEDA</span>
		</button>
	{/if}

	<Navbar />
</div>

<QuickAddCardModal
	isOpen={isQuickAddOpen}
	onClose={() => (isQuickAddOpen = false)}
/>

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
		padding: 0.85rem 0.85rem 4.5rem 0.85rem;
		box-sizing: border-box;
		contain: layout style;
	}

	.page-transition-wrapper {
		width: 100%;
	}

	/* ⚡ Floating Action Button (FAB) Sovraimpresso in Basso a Destra */
	.fab-quick-add {
		position: fixed;
		bottom: calc(4.5rem + var(--safe-area-bottom, 0px));
		right: 1.25rem;
		z-index: 180;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.8rem 1.2rem;
		border-radius: 9999px;
		background-color: var(--green-color);
		color: #ffffff;
		border: 2px solid var(--green-depth);
		border-bottom: 4px solid var(--green-depth);
		font-family: 'Outfit', sans-serif;
		font-size: 0.85rem;
		font-weight: 900;
		letter-spacing: 0.04em;
		cursor: pointer;
		box-shadow: 0 8px 24px rgba(88, 204, 2, 0.4);
		transition: transform 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
		user-select: none;
	}

	.fab-quick-add:hover {
		background-color: #61df02;
		transform: translateY(-2px);
		box-shadow: 0 10px 28px rgba(88, 204, 2, 0.5);
	}

	.fab-quick-add:active {
		transform: translateY(2px);
		border-bottom-width: 2px;
		box-shadow: 0 4px 12px rgba(88, 204, 2, 0.3);
	}

	.fab-icon {
		font-size: 1.1rem;
		line-height: 1;
	}

	@media (min-width: 1024px) {
		.layout-wrapper {
			padding-left: 240px;
		}

		.main-content {
			padding: 1.5rem 2rem 1.5rem 2rem;
		}

		.fab-quick-add {
			bottom: 2rem;
			right: 2rem;
			padding: 0.9rem 1.4rem;
			font-size: 0.9rem;
		}
	}
</style>
