<script lang="ts">
	import { page } from '$app/state';

	const primaryNavItems = [
		{ href: '/', label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
		{ href: '/ripasso', label: 'Ripasso', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
		{ href: '/quiz', label: 'Quiz', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
		{ href: '/reels', label: 'Reels', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
		{ href: '/wiki', label: 'Wiki', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' }
	];

	const moreNavItems = [
		{ href: '/ripasso-foto', label: 'Ripasso Foto', icon: '📷', desc: 'Identifica il termine dall\'immagine' },
		{ href: '/ripasso-inverso', label: 'Ripasso Inverso', icon: '🔄', desc: 'Dalla descrizione all\'acronimo' },
		{ href: '/scrittura', label: 'Scrittura Libera', icon: '✍️', desc: 'Digitazione e autocontrollo' },
		{ href: '/admin', label: 'Pannello Admin', icon: '⚙️', desc: 'Aggiungi o modifica schede' }
	];

	let showMoreMenu = $state(false);

	let isMoreActive = $derived(
		moreNavItems.some((item) => page.url.pathname === item.href)
	);
</script>

<nav class="bottom-nav">
	<div class="nav-container">
		{#each primaryNavItems as item}
			<a
				href={item.href}
				class="nav-item"
				class:active={page.url.pathname === item.href}
				onclick={() => (showMoreMenu = false)}
			>
				<svg class="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
				</svg>
				<span class="nav-label">{item.label}</span>
			</a>
		{/each}

		<!-- More Menu Button -->
		<div class="more-menu-wrapper">
			<button
				class="nav-item more-btn"
				class:active={isMoreActive || showMoreMenu}
				onclick={() => (showMoreMenu = !showMoreMenu)}
			>
				<svg class="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
				</svg>
				<span class="nav-label">Altro</span>
			</button>

			<!-- Popover Drawer for More Options -->
			{#if showMoreMenu}
				<div class="more-popover">
					<div class="popover-header">
						<span>Altre Modalità e Strumenti</span>
						<button class="close-pop-btn" onclick={() => (showMoreMenu = false)}>✕</button>
					</div>

					<div class="popover-grid">
						{#each moreNavItems as subItem}
							<a
								href={subItem.href}
								class="more-sub-item"
								class:active={page.url.pathname === subItem.href}
								onclick={() => (showMoreMenu = false)}
							>
								<span class="sub-icon">{subItem.icon}</span>
								<div class="sub-text">
									<span class="sub-label">{subItem.label}</span>
									<span class="sub-desc">{subItem.desc}</span>
								</div>
							</a>
						{/each}
					</div>
				</div>
			{/if}
		</div>
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
		font-size: 0.75rem;
		font-weight: 700;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		flex: 1;
		max-width: 80px;
		text-align: center;
		background: none;
		border: none;
		cursor: pointer;
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

	.more-menu-wrapper {
		position: relative;
		display: flex;
		flex: 1;
		max-width: 80px;
	}

	.more-btn {
		width: 100%;
	}

	.more-popover {
		position: absolute;
		bottom: calc(100% + 12px);
		right: 0;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 20px;
		padding: 1rem;
		box-shadow: 0 -12px 36px var(--shadow-color);
		min-width: 270px;
		z-index: 100;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		animation: slideUp 0.2s ease;
	}

	.popover-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		color: var(--text-muted);
		padding-bottom: 0.4rem;
		border-bottom: 1px solid var(--border-color);
	}

	.close-pop-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 0.9rem;
		cursor: pointer;
	}

	.popover-grid {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.more-sub-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 0.75rem;
		border-radius: 12px;
		text-decoration: none;
		color: var(--text-color);
		background: var(--card-bg-subtle);
		border: 1px solid transparent;
		transition: all 0.15s ease;
	}

	.more-sub-item:hover {
		border-color: var(--accent-color);
		transform: translateX(2px);
	}

	.more-sub-item.active {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.sub-icon {
		font-size: 1.2rem;
	}

	.sub-text {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}

	.sub-label {
		font-weight: 800;
		font-size: 0.85rem;
	}

	.sub-desc {
		font-size: 0.7rem;
		color: var(--text-muted);
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
		.more-popover {
			bottom: auto;
			top: calc(100% + 8px);
		}
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(6px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
