<script lang="ts">
	import { page } from '$app/state';

	const navItems = [
		{ href: '/', label: 'IMPARA', emoji: '/emoji/house_3d.png' },
		{ href: '/ripasso', label: 'FLASHCARD', emoji: '/emoji/open_book_3d.png' },
		{ href: '/quiz', label: 'CLASSIFICHE', emoji: '/emoji/shield_3d.png' },
		{ href: '/reels', label: 'MISSIONI', emoji: '/emoji/package_3d.png' },
		{ href: '/ripasso-foto', label: 'FOTO', emoji: '/emoji/camera_3d.png' },
		{ href: '/ripasso-inverso', label: 'INVERSO', emoji: '/emoji/counterclockwise_arrows_button_3d.png' },
		{ href: '/scrittura', label: 'SCRITTURA', emoji: '/emoji/writing_hand_3d_default.png' },
		{ href: '/wiki', label: 'WIKI', emoji: '/emoji/books_3d.png' }
	];
</script>

<nav class="duo-navigation">
	<!-- Desktop Sidebar Header Brand (Hidden on Mobile) -->
	<div class="sidebar-brand">
		<a href="/" class="brand-link">
			<img src="/emoji/triangular_flag_3d.png" alt="Bandiera" class="brand-emoji" />
			<span class="brand-title">
				Rai<svg class="ll-track-svg" viewBox="0 0 24 32" fill="currentColor" aria-hidden="true">
					<!-- Left Rail ('l') -->
					<rect x="2.5" y="2" width="4.5" height="28" rx="2.25" />
					<!-- Right Rail ('l') -->
					<rect x="17" y="2" width="4.5" height="28" rx="2.25" />
					<!-- Horizontal Track Ties (Traverse) -->
					<rect x="5.5" y="7" width="13" height="3" rx="1" opacity="0.8" />
					<rect x="5.5" y="14.5" width="13" height="3" rx="1" opacity="0.8" />
					<rect x="5.5" y="22" width="13" height="3" rx="1" opacity="0.8" />
				</svg>ingo
			</span>
		</a>
	</div>

	<div class="nav-container">
		<div class="nav-scroll-wrapper">
			{#each navItems as item}
				{@const isActive = page.url.pathname === item.href}
				<a
					href={item.href}
					class="nav-item"
					class:active={isActive}
				>
					<div class="icon-wrapper" class:active-outline={isActive}>
						<img src={item.emoji} alt={item.label} class="nav-emoji-img" />
					</div>
					<span class="nav-label">{item.label}</span>
				</a>
			{/each}
		</div>
	</div>
</nav>

<style>
	.sidebar-brand {
		display: none;
	}

	.duo-navigation {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 50;
		background: var(--nav-bg);
		border-top: 2px solid var(--border-color);
		padding: 0.35rem 0.25rem 0.4rem 0.25rem;
		box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.2);
	}

	.nav-container {
		width: 100%;
		margin: 0 auto;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	.nav-container::-webkit-scrollbar {
		display: none;
	}

	.nav-scroll-wrapper {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-width: min-content;
		padding: 0 0.25rem;
		gap: 0.1rem;
	}

	.nav-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		padding: 0.25rem 0.35rem;
		color: var(--text-muted);
		text-decoration: none;
		font-size: 0.68rem;
		font-weight: 800;
		transition: all 0.15s ease;
		flex-shrink: 0;
		min-width: 62px;
		text-align: center;
		background: none;
		border: none;
		cursor: pointer;
		user-select: none;
	}

	.icon-wrapper {
		width: 36px;
		height: 34px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 12px;
		border: 2px solid transparent;
		transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.icon-wrapper.active-outline {
		border-color: var(--accent-color);
		background-color: var(--accent-light-bg);
		transform: translateY(-2px);
	}

	.nav-emoji-img {
		width: 24px;
		height: 24px;
		object-fit: contain;
	}

	.nav-item:hover {
		color: var(--text-color);
	}

	.nav-item.active {
		color: var(--accent-color);
	}

	.nav-label {
		font-family: 'Outfit', sans-serif;
		font-weight: 800;
		font-size: 0.65rem;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}

	/* 🖥️ Desktop Sidebar Navigation (>= 1024px) */
	@media (min-width: 1024px) {
		.duo-navigation {
			top: 0;
			bottom: 0;
			right: auto;
			width: 240px;
			border-top: none;
			border-right: 2px solid var(--border-color);
			padding: 1.5rem 1rem;
			display: flex;
			flex-direction: column;
			gap: 1.5rem;
			box-shadow: none;
		}

		.sidebar-brand {
			display: block;
			padding: 0.5rem 0.5rem 0 0.5rem;
		}

		.brand-link {
			display: flex;
			align-items: center;
			gap: 0.6rem;
			text-decoration: none;
		}

		.brand-emoji {
			width: 32px;
			height: 32px;
			object-fit: contain;
		}

		.brand-title {
			font-family: 'Outfit', sans-serif;
			font-size: 1.8rem;
			font-weight: 900;
			color: var(--green-color);
			letter-spacing: -0.04em;
			display: inline-flex;
			align-items: center;
		}

		.ll-track-svg {
			height: 0.85em;
			width: auto;
			margin: 0 -0.03em;
			color: var(--green-color);
			vertical-align: middle;
		}

		.nav-container {
			overflow-x: visible;
		}

		.nav-scroll-wrapper {
			flex-direction: column;
			gap: 0.4rem;
			width: 100%;
			align-items: stretch;
			padding: 0;
		}

		.nav-item {
			flex-direction: row;
			align-items: center;
			gap: 0.85rem;
			min-width: 0;
			width: 100%;
			padding: 0.65rem 0.85rem;
			border-radius: 16px;
			border: 2px solid transparent;
			text-align: left;
			font-size: 0.82rem;
		}

		.nav-item.active {
			border-color: var(--accent-color);
			background-color: var(--accent-light-bg);
		}

		.icon-wrapper {
			width: 28px;
			height: 28px;
			background: none !important;
			border: none !important;
			transform: none !important;
		}

		.nav-emoji-img {
			width: 26px;
			height: 26px;
		}

		.nav-label {
			font-size: 0.8rem;
		}
	}
</style>


