<script lang="ts">
	import { page } from '$app/state';

	const primaryNavItems = [
		{ href: '/', label: 'Home', emoji: '🏠', activeColor: '#ffc800' },
		{ href: '/ripasso', label: 'Ripasso', emoji: '👄', activeColor: '#ff4b4b' },
		{ href: '/quiz', label: 'Esercizi', emoji: '🏋️', activeColor: '#1cb0f6' },
		{ href: '/reels', label: 'Reels', emoji: '🎬', activeColor: '#ce82ff' },
		{ href: '/wiki', label: 'Indice', emoji: '🏆', activeColor: '#ff9600' }
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
			{@const isActive = page.url.pathname === item.href}
			<a
				href={item.href}
				class="nav-item"
				class:active={isActive}
				onclick={() => (showMoreMenu = false)}
			>
				<div class="icon-wrapper" class:active-outline={isActive}>
					<span class="nav-emoji">{item.emoji}</span>
				</div>
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
				<div class="icon-wrapper" class:active-outline={isMoreActive || showMoreMenu}>
					<span class="nav-emoji">💬</span>
				</div>
				<span class="nav-label">Altro</span>
			</button>

			<!-- Popover Drawer for More Options -->
			{#if showMoreMenu}
				<div class="more-popover duo-card">
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
		border-top: 2px solid var(--border-color);
		padding: 0.35rem 0.5rem 0.5rem 0.5rem;
		box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.2);
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
		gap: 0.15rem;
		padding: 0.25rem 0.4rem;
		color: var(--text-muted);
		text-decoration: none;
		font-size: 0.75rem;
		font-weight: 800;
		transition: all 0.15s ease;
		flex: 1;
		max-width: 80px;
		text-align: center;
		background: none;
		border: none;
		cursor: pointer;
		user-select: none;
	}

	.icon-wrapper {
		width: 42px;
		height: 38px;
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

	.nav-emoji {
		font-size: 1.4rem;
		line-height: 1;
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
		font-size: 0.72rem;
		letter-spacing: 0.02em;
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
		border-bottom: 2px solid var(--border-color);
	}

	.close-pop-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 0.9rem;
		cursor: pointer;
		font-weight: 800;
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
		padding: 0.65rem 0.85rem;
		border-radius: 14px;
		text-decoration: none;
		color: var(--text-color);
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-bottom-width: 3px;
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
		font-size: 1.25rem;
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
			top: 57px;
			bottom: auto;
			border-top: none;
			border-bottom: 2px solid var(--border-color);
			padding: 0.25rem 1rem;
		}
		.nav-container {
			max-width: 900px;
		}
		.nav-item {
			flex-direction: row;
			gap: 0.5rem;
			font-size: 0.85rem;
			max-width: none;
			padding: 0.4rem 0.85rem;
		}
		.icon-wrapper {
			width: 34px;
			height: 34px;
		}
		.nav-emoji {
			font-size: 1.15rem;
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

