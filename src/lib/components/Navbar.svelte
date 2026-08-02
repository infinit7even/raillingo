<script lang="ts">
	import { page } from '$app/state';

	const navItems = [
		{ href: '/', label: 'HOME', emoji: '/emoji/house_3d.png' },
		{ href: '/ripasso', label: 'FLASHCARD', emoji: '/emoji/open_book_3d.png' },
		{ href: '/quiz', label: 'QUIZ', emoji: '/emoji/star_3d.png' },
		{ href: '/reels', label: 'REELS', emoji: '/emoji/camera_3d.png' },
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
				Rai<span class="ll-track-box">l<img src="/emoji/railway_track_3d.png" alt="Binario" class="brand-track-img" />l</span>ingo
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
		z-index: 200;
		background: var(--card-bg);
		border-top: 2px solid var(--border-color);
		padding: 0.4rem 0.25rem;
		box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.25);
		backdrop-filter: blur(12px);
	}

	.nav-container {
		width: 100%;
		max-width: 600px;
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
		justify-content: space-around;
		width: 100%;
		padding: 0 0.2rem;
		gap: 0.1rem;
	}

	.nav-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.18rem;
		padding: 0.25rem 0.3rem;
		color: var(--text-muted);
		text-decoration: none;
		font-size: 0.65rem;
		font-weight: 800;
		transition: all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
		flex: 1;
		min-width: 52px;
		max-width: 72px;
		text-align: center;
		background: none;
		border: none;
		cursor: pointer;
		user-select: none;
	}

	.icon-wrapper {
		width: 38px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 14px;
		border: 2px solid transparent;
		transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.icon-wrapper.active-outline {
		border-color: var(--accent-color);
		background-color: var(--accent-light-bg);
		transform: translateY(-3px) scale(1.06);
		box-shadow: 0 4px 12px rgba(88, 204, 2, 0.25);
	}

	.nav-emoji-img {
		width: 26px;
		height: 26px;
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
			backdrop-filter: none;
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

		.ll-track-box {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			position: relative;
		}

		.brand-track-img {
			width: 0.75em;
			height: 0.75em;
			object-fit: contain;
			margin: 0 -0.08em;
		}

		.nav-container {
			overflow-x: visible;
			max-width: none;
		}

		.nav-scroll-wrapper {
			flex-direction: column;
			gap: 0.5rem;
			width: 100%;
			align-items: stretch;
			padding: 0;
		}

		.nav-item {
			flex-direction: row;
			align-items: center;
			gap: 0.85rem;
			min-width: 0;
			max-width: 100%;
			width: 100%;
			padding: 0.75rem 1rem;
			border-radius: 16px;
			border: 2px solid transparent;
			text-align: left;
			font-size: 0.85rem;
			box-sizing: border-box;
		}

		.nav-item.active {
			border: 2px solid var(--accent-color);
			border-bottom: 4px solid var(--accent-color);
			background-color: var(--accent-light-bg);
			color: var(--accent-color);
			font-weight: 900;
		}

		.icon-wrapper, .icon-wrapper.active-outline {
			width: 32px !important;
			height: 32px !important;
			background: none !important;
			border: none !important;
			transform: none !important;
			box-shadow: none !important;
		}

		.nav-emoji-img {
			width: 28px;
			height: 28px;
		}

		.nav-label {
			font-size: 0.85rem;
			font-weight: 900;
			letter-spacing: 0.04em;
		}
	}
</style>


