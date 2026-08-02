<script lang="ts">
	import { onMount } from 'svelte';
	import { themeStore, THEME_OPTIONS, type ThemePreset } from '$lib/stores/themeStore';

	let currentTheme = $state<ThemePreset>('dark');
	let showThemeMenu = $state(false);

	onMount(() => {
		const unsubscribe = themeStore.subscribe((t) => {
			currentTheme = t;
		});
		return unsubscribe;
	});

	function selectTheme(themeId: ThemePreset) {
		themeStore.setTheme(themeId);
		showThemeMenu = false;
	}
</script>

<header class="app-header">
	<div class="header-container">
		<a href="/" class="brand">
			<div class="logo-box">
				<svg class="logo-icon" viewBox="0 0 512 512" fill="none" stroke="currentColor">
					<path d="M160 140 C160 110, 352 110, 352 140 L368 320 C368 350, 340 370, 256 370 C172 370, 144 350, 144 320 Z" fill="currentColor" opacity="0.9"/>
					<circle cx="192" cy="300" r="18" fill="#f59e0b" />
					<circle cx="320" cy="300" r="18" fill="#f59e0b" />
				</svg>
			</div>
			<div class="title-group">
				<span class="app-title">RF</span>
				<span class="app-subtitle">Rail Focus</span>
			</div>
		</a>

		<div class="actions">
			<!-- Theme Selector Dropdown Trigger -->
			<div class="theme-dropdown-wrapper">
				<button
					class="theme-btn"
					onclick={() => (showThemeMenu = !showThemeMenu)}
					aria-label="Scegli tema"
				>
					<span class="palette-icon">🎨</span>
					<span class="theme-name-text">Temi</span>
				</button>

				{#if showThemeMenu}
					<div class="theme-popover">
						<div class="popover-title">Scegli il Tema</div>
						<div class="theme-list">
							{#each THEME_OPTIONS as option}
								<button
									class="theme-option-btn"
									class:selected={currentTheme === option.id}
									onclick={() => selectTheme(option.id)}
								>
									<span class="theme-swatch" style="background: {option.color}"></span>
									<span class="theme-label">{option.name}</span>
									{#if currentTheme === option.id}
										<span class="check-mark">✓</span>
									{/if}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<a href="/admin" class="admin-link" aria-label="Pannello Amministratore">
				<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>
					<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
				</svg>
				<span class="admin-text">Admin</span>
			</a>
		</div>
	</div>
</header>

<style>
	.app-header {
		position: sticky;
		top: 0;
		z-index: 50;
		backdrop-filter: blur(12px);
		background-color: var(--header-bg);
		border-bottom: 1px solid var(--border-color);
		transition: background-color 0.3s ease, border-color 0.3s ease;
	}

	.header-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0.75rem 1.25rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		text-decoration: none;
		color: var(--text-color);
	}

	.logo-box {
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: linear-gradient(135deg, var(--accent-color), #0284c7);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}

	.logo-icon {
		width: 26px;
		height: 26px;
	}

	.title-group {
		display: flex;
		flex-direction: column;
		line-height: 1.1;
	}

	.app-title {
		font-weight: 900;
		font-size: 1.25rem;
		letter-spacing: -0.02em;
		background: linear-gradient(135deg, var(--accent-color), var(--accent-light));
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.app-subtitle {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.theme-dropdown-wrapper {
		position: relative;
	}

	.theme-btn, .admin-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.85rem;
		border-radius: 12px;
		background-color: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		color: var(--text-color);
		font-size: 0.875rem;
		font-weight: 700;
		cursor: pointer;
		text-decoration: none;
		transition: all 0.2s ease;
	}

	.theme-btn:hover, .admin-link:hover {
		background-color: var(--hover-bg);
		border-color: var(--accent-color);
		transform: translateY(-1px);
	}

	.palette-icon {
		font-size: 1rem;
	}

	.icon {
		width: 18px;
		height: 18px;
	}

	.theme-popover {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 18px;
		padding: 0.85rem;
		box-shadow: 0 12px 36px var(--shadow-color);
		min-width: 200px;
		z-index: 100;
		animation: fadeIn 0.2s ease;
	}

	.popover-title {
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 0.6rem;
		padding-left: 0.4rem;
	}

	.theme-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.theme-option-btn {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 0.75rem;
		border-radius: 10px;
		background: transparent;
		border: 1px solid transparent;
		color: var(--text-color);
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s ease;
	}

	.theme-option-btn:hover {
		background: var(--card-bg-subtle);
	}

	.theme-option-btn.selected {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.theme-swatch {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.theme-label {
		flex: 1;
	}

	.check-mark {
		font-weight: 900;
	}

	@media (max-width: 640px) {
		.admin-text {
			display: none;
		}
		.theme-btn, .admin-link {
			padding: 0.5rem 0.65rem;
		}
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
