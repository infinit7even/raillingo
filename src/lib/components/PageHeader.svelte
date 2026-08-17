<script lang="ts">
	import type { Snippet } from 'svelte';
	import { navStore } from '$lib/stores/navStore';
	import { toastStore } from '$lib/stores/toastStore';

	let {
		title,
		subtitle = '',
		badge = '',
		icon = '',
		variant = 'green',
		mobileOpenNav = true,
		children
	} = $props<{
		title: string;
		subtitle?: string;
		badge?: string;
		icon?: string;
		variant?: 'brand' | 'green' | 'blue' | 'purple' | 'orange' | 'red';
		/** Se true, toccare il banner su mobile apre il menu laterale */
		mobileOpenNav?: boolean;
		children?: Snippet;
	}>();

	async function toggleFullscreen() {
		if (typeof document === 'undefined') return;
		try {
			if (!document.fullscreenElement) {
				if (document.documentElement.requestFullscreen) {
					await document.documentElement.requestFullscreen();
					toastStore.show({ message: 'Modalità Schermo Intero', type: 'info' });
				}
			} else {
				if (document.exitFullscreen) {
					await document.exitFullscreen();
					toastStore.show({ message: 'Schermo Intero disattivato', type: 'info' });
				}
			}
		} catch (e) {
			console.warn('Impossibile passare allo Schermo Intero:', e);
		}
	}

	function handleClick() {
		if (typeof window !== 'undefined') {
			if (window.innerWidth < 1024) {
				if (mobileOpenNav) {
					navStore.open();
				}
			} else {
				toggleFullscreen();
			}
		}
	}
</script>

<button
	type="button"
	class="page-header-banner duo-banner-{variant}"
	class:mobile-tappable={mobileOpenNav}
	onclick={handleClick}
	aria-label="Banner {title}"
	title="Tocca su mobile per aprire il menu o clicca su desktop per lo Schermo Intero"
>
	<div class="header-content-group">
		{#if mobileOpenNav}
			<!-- ☰ Hamburger Lines on Left for Mobile -->
			<span class="mobile-nav-hint" aria-hidden="true">
				<span class="nav-hint-bar"></span>
				<span class="nav-hint-bar"></span>
				<span class="nav-hint-bar"></span>
			</span>
		{/if}

		{#if icon}
			<img src={icon} alt="" width="36" height="36" decoding="async" class="header-icon-img" />
		{/if}

		<div class="header-text-box">
			{#if badge}
				<span class="header-badge-tag">{badge}</span>
			{/if}
			<h1 class="header-title-heading">{title}</h1>
			{#if subtitle}
				<p class="header-subtitle-text">{subtitle}</p>
			{/if}
		</div>
	</div>

	{#if children}
		<div class="header-actions-slot">
			{@render children()}
		</div>
	{/if}
</button>

<style>
	.page-header-banner {
		border-radius: 16px;
		padding: 0.75rem 1.15rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.85rem;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
		transition:
			transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
			box-shadow 0.18s ease,
			filter 0.18s ease;
		box-sizing: border-box;
		width: 100%;
		max-width: 600px;
		margin-left: auto;
		margin-right: auto;
		margin-top: 0;
		margin-bottom: 0.75rem;
		animation: slideUpFade 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	/* Reset button element default styles */
	button.page-header-banner {
		font-family: inherit;
		text-align: left;
		cursor: pointer;
	}

	/* 🖱️ Hover animation (desktop) */
	@media (hover: hover) {
		.page-header-banner:hover {
			transform: translateY(-3px) scale(1.012);
			box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
			filter: brightness(1.08);
		}
		.page-header-banner:active {
			transform: translateY(1px) scale(0.998);
			box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
			filter: brightness(0.96);
		}
	}

	/* 📱 Mobile tap feedback */
	.mobile-tappable {
		cursor: pointer;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
	}
	.mobile-tappable:active {
		transform: scale(0.97);
		filter: brightness(0.92);
		transition:
			transform 0.08s ease,
			filter 0.08s ease;
	}

	.mobile-nav-hint {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		width: 18px;
		height: 14px;
		flex-shrink: 0;
		margin-right: 0.2rem;
	}

	.nav-hint-bar {
		display: block;
		width: 100%;
		height: 2.2px;
		background-color: currentColor;
		border-radius: 2px;
		opacity: 0.95;
	}

	@media (min-width: 1024px) {
		.mobile-nav-hint {
			display: none !important;
		}
	}

	.duo-banner-green {
		background-color: var(--green-color, #58cc02);
		border: 2px solid var(--green-depth, #46a302);
		border-bottom: 4px solid var(--green-depth, #46a302);
		color: #ffffff;
	}

	.duo-banner-brand {
		background-color: var(--brand-color, var(--green-color, #58cc02));
		border: 2px solid var(--brand-depth, var(--green-depth, #46a302));
		border-bottom: 4px solid var(--brand-depth, var(--green-depth, #46a302));
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

	.header-content-group {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.header-icon-img {
		width: 36px;
		height: 36px;
		object-fit: contain;
		flex-shrink: 0;
		animation: gentleWobble 0.6s ease;
	}

	.header-text-box {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.header-badge-tag {
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.95;
	}

	.header-title-heading {
		font-size: 1.25rem;
		font-weight: 900;
		color: inherit;
		margin: 0;
		line-height: 1.1;
	}

	.header-subtitle-text {
		font-size: 0.8rem;
		font-weight: 600;
		opacity: 0.92;
		margin: 0;
		line-height: 1.25;
	}

	.header-actions-slot {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	@media (max-width: 1023px) {
		.header-subtitle-text {
			display: none;
		}

		.page-header-banner {
			margin-top: 0.15rem;
			margin-bottom: 0.65rem;
			padding: 0.65rem 0.9rem;
		}
	}
</style>
