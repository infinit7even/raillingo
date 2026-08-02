<script lang="ts">
	import { onMount } from 'svelte';
	import { themeStore, type Theme } from '$lib/stores/themeStore';

	let currentTheme = $state<Theme>('dark');

	onMount(() => {
		const unsubscribe = themeStore.subscribe((t) => {
			currentTheme = t;
		});
		return unsubscribe;
	});

	function toggleTheme() {
		themeStore.toggle();
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
			<button class="theme-btn" onclick={toggleTheme} aria-label="Cambia tema">
				{#if currentTheme === 'dark'}
					<!-- Sole -->
					<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="5"></circle>
						<line x1="12" y1="1" x2="12" y2="3"></line>
						<line x1="12" y1="21" x2="12" y2="23"></line>
						<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
						<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
						<line x1="1" y1="12" x2="3" y2="12"></line>
						<line x1="21" y1="12" x2="23" y2="12"></line>
						<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
						<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
					</svg>
				{:else}
					<!-- Luna -->
					<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
					</svg>
				{/if}
			</button>

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
		box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
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

	.theme-btn, .admin-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.85rem;
		border-radius: 10px;
		background-color: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		color: var(--text-color);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		text-decoration: none;
		transition: all 0.2s ease;
	}

	.theme-btn:hover, .admin-link:hover {
		background-color: var(--hover-bg);
		border-color: var(--accent-color);
		transform: translateY(-1px);
	}

	.icon {
		width: 18px;
		height: 18px;
	}

	@media (max-width: 640px) {
		.admin-text {
			display: none;
		}
		.theme-btn, .admin-link {
			padding: 0.5rem;
			border-radius: 50%;
		}
	}
</style>
