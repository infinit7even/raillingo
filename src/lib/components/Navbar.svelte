<script lang="ts">
	import { page } from '$app/state';

	const navItems = [
		{ href: '/', label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
		{ href: '/ripasso', label: 'Ripasso', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
		{ href: '/ripasso-foto', label: 'Foto', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
		{ href: '/ripasso-inverso', label: 'Inverso', icon: 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4' },
		{ href: '/quiz', label: 'Quiz (5)', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
		{ href: '/scrittura', label: 'Scrittura', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
		{ href: '/reels', label: 'Reels', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
		{ href: '/wiki', label: 'Wiki (A-Z)', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' }
	];
</script>

<nav class="bottom-nav">
	<div class="nav-container">
		{#each navItems as item}
			<a
				href={item.href}
				class="nav-item"
				class:active={page.url.pathname === item.href}
			>
				<svg class="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
				</svg>
				<span class="nav-label">{item.label}</span>
			</a>
		{/each}
	</div>
</nav>

<style>
	.bottom-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 50;
		background: var(--nav-bg);
		backdrop-filter: blur(16px);
		border-top: 1px solid var(--border-color);
		padding: 0.35rem 0.5rem;
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
	}

	.nav-container {
		max-width: 600px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-around;
	}

	.nav-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		padding: 0.4rem 0.6rem;
		border-radius: 12px;
		color: var(--text-muted);
		text-decoration: none;
		font-size: 0.7rem;
		font-weight: 600;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		flex: 1;
		max-width: 80px;
		text-align: center;
	}

	.nav-icon {
		width: 22px;
		height: 22px;
		transition: transform 0.2s ease;
	}

	.nav-item:hover {
		color: var(--text-color);
	}

	.nav-item.active {
		color: var(--accent-color);
		background-color: var(--active-nav-bg);
	}

	.nav-item.active .nav-icon {
		transform: translateY(-2px) scale(1.1);
	}

	@media (min-width: 768px) {
		.bottom-nav {
			top: 61px;
			bottom: auto;
			border-top: none;
			border-bottom: 1px solid var(--border-color);
			padding: 0.25rem 1rem;
		}
		.nav-container {
			max-width: 900px;
		}
		.nav-item {
			flex-direction: row;
			gap: 0.4rem;
			font-size: 0.85rem;
			max-width: none;
			padding: 0.5rem 0.85rem;
		}
		.nav-icon {
			width: 18px;
			height: 18px;
		}
	}
</style>
