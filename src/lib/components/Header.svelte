<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { navStore } from '$lib/stores/navStore';

	let isNavOpen = $state(false);
	let currentPath = $derived(page.url.pathname);

	onMount(() => {
		const unNav = navStore.subscribe((o) => (isNavOpen = o));
		return () => unNav();
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

		<div class="header-brand-title">
			<img src="/emoji/triangular_flag_3d.png" alt="Bandiera" width="24" height="24" decoding="async" />
			<span class="brand-title">
				Rai<span class="ll-track-box"
					>l<img src="/emoji/railway_track_3d.png" alt="Binario" width="16" height="16" decoding="async" class="brand-track-img" />l</span
				>ingo
			</span>
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
		gap: 0.75rem;
	}

	.menu-toggle-btn {
		padding: 0.55rem 0.65rem;
		height: 44px;
		width: 44px;
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

	.header-brand-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.brand-title {
		font-family: "Outfit", sans-serif;
		font-size: 1.35rem;
		font-weight: 900;
		color: var(--text-color);
		letter-spacing: -0.02em;
	}

	.ll-track-box {
		position: relative;
		display: inline-block;
		color: var(--brand-color, var(--green-color));
	}

	.brand-track-img {
		position: absolute;
		top: 52%;
		left: 50%;
		transform: translate(-50%, -50%);
		pointer-events: none;
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
		cursor: pointer;
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
