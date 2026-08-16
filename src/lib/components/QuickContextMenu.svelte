<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let isOpen = $state(false);
	let menuX = $state(0);
	let menuY = $state(0);

	const MENU_WIDTH = 195;
	const MENU_APPROX_HEIGHT = 310;
	const PADDING = 10;

	const navItems = [
		{ href: '/', label: 'Home', icon: '/emoji/house_3d.png' },
		{ href: '/flashcard', label: 'Flashcard', icon: '/emoji/open_book_3d.png' },
		{ href: '/quiz', label: 'Quiz', icon: '/emoji/star_3d.png' },
		{ href: '/reels', label: 'Reels', icon: '/emoji/camera_3d.png' },
		{ href: '/wiki', label: 'Wiki', icon: '/emoji/books_3d.png' },
		{ href: '/notes', label: 'Appunti', icon: '/emoji/clipboard_3d.png' },
		{ href: '/missions', label: 'Missioni', icon: '/emoji/package_3d.png' }
	];

	onMount(() => {
		function handleContextMenu(e: MouseEvent) {
			// Se ci troviamo nella sezione /notes, non mostrare il menu globale di navigazione
			// poiché /notes dispone del suo menu contestuale personalizzato dedicato (elimina, copia, incolla, ecc.)
			if (page.url.pathname.startsWith('/notes')) {
				return;
			}

			// Disabilita il menu contestuale predefinito del browser
			e.preventDefault();

			const clientX = e.clientX;
			const clientY = e.clientY;

			// Calcola le coordinate per mantenere il menu sempre completamente visibile
			const maxX = window.innerWidth - MENU_WIDTH - PADDING;
			const maxY = window.innerHeight - MENU_APPROX_HEIGHT - PADDING;

			menuX = Math.max(PADDING, Math.min(clientX, maxX));
			menuY = Math.max(PADDING, Math.min(clientY, maxY));

			isOpen = true;
		}

		function handleGlobalClick(e: MouseEvent) {
			if (!isOpen) return;
			const target = e.target as HTMLElement;
			if (!target.closest('.quick-nav-menu')) {
				isOpen = false;
			}
		}

		function handleGlobalKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape' && isOpen) {
				isOpen = false;
			}
		}

		function handleGlobalScroll() {
			if (isOpen) {
				isOpen = false;
			}
		}

		window.addEventListener('contextmenu', handleContextMenu, { capture: true });
		window.addEventListener('click', handleGlobalClick, { capture: true });
		window.addEventListener('keydown', handleGlobalKeyDown);
		window.addEventListener('scroll', handleGlobalScroll, { passive: true });

		return () => {
			window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
			window.removeEventListener('click', handleGlobalClick, { capture: true });
			window.removeEventListener('keydown', handleGlobalKeyDown);
			window.removeEventListener('scroll', handleGlobalScroll);
		};
	});

	function navigateTo(path: string) {
		isOpen = false;
		goto(path);
	}
</script>

{#if isOpen}
	<!-- Backdrop trasparente -->
	<div
		class="quick-nav-backdrop"
		onclick={() => (isOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (isOpen = false)}
		role="presentation"
	></div>

	<!-- Menu Rapido Minimale per Navigazione -->
	<div
		class="quick-nav-menu duo-card"
		style="left: {menuX}px; top: {menuY}px;"
		role="menu"
		tabindex="-1"
	>
		<div class="quick-nav-list">
			{#each navItems as item}
				{@const isActive = page.url.pathname === item.href}
				<button
					type="button"
					class="quick-nav-item"
					class:active={isActive}
					onclick={() => navigateTo(item.href)}
				>
					<img src={item.icon} alt="" width="20" height="20" class="nav-ico-img" />
					<span class="nav-label-text">{item.label}</span>
					{#if isActive}
						<span class="active-dot-indicator">●</span>
					{/if}
				</button>
			{/each}
		</div>
	</div>
{/if}

<style>
	.quick-nav-backdrop {
		position: fixed;
		inset: 0;
		z-index: 9998;
		background: transparent;
	}

	.quick-nav-menu {
		position: fixed;
		z-index: 9999;
		width: 195px;
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		border-bottom: 3.5px solid var(--border-depth-color);
		border-radius: 16px;
		padding: 0.35rem;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		box-sizing: border-box;
		animation: navPop 0.14s cubic-bezier(0.34, 1.56, 0.64, 1);
		user-select: none;
	}

	@keyframes navPop {
		0% {
			opacity: 0;
			transform: scale(0.92) translateY(3px);
		}
		100% {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.quick-nav-list {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.quick-nav-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.45rem 0.65rem;
		border-radius: 11px;
		border: 1.5px solid transparent;
		background: transparent;
		color: var(--text-color);
		font-family: 'Outfit', sans-serif;
		font-size: 0.85rem;
		font-weight: 800;
		cursor: pointer;
		text-align: left;
		transition: all 0.1s ease;
		box-sizing: border-box;
		width: 100%;
	}

	.quick-nav-item:hover {
		background: var(--card-bg-subtle);
		border-color: var(--border-color);
		transform: translateX(2px);
	}

	.quick-nav-item.active {
		background: var(--active-nav-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
		font-weight: 900;
	}

	.nav-ico-img {
		width: 20px;
		height: 20px;
		object-fit: contain;
		flex-shrink: 0;
	}

	.nav-label-text {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.active-dot-indicator {
		color: var(--accent-color);
		font-size: 0.6rem;
	}
</style>
