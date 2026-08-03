<script lang="ts">
	import { cardsStore } from '$lib/stores/cardsStore';

	let { selectedCategory, onSelectCategory } = $props<{
		selectedCategory: string;
		onSelectCategory: (category: string) => void;
	}>();

	let categories = $derived(cardsStore.categories);
</script>

<div class="category-filter-bar">
	<div class="filter-label">📁 Categoria:</div>
	<div class="chips-container">
		<button
			class="filter-chip"
			class:active={selectedCategory === 'ALL'}
			onclick={() => onSelectCategory('ALL')}
		>
			Tutte
		</button>
		{#each categories as cat}
			<button
				class="filter-chip"
				class:active={selectedCategory === cat}
				onclick={() => onSelectCategory(cat)}
			>
				{cat}
			</button>
		{/each}
	</div>
</div>

<style>
	.category-filter-bar {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.4rem 0.65rem;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 16px;
		margin-bottom: 0.85rem;
		width: 100%;
		box-sizing: border-box;
		backdrop-filter: blur(10px);
	}

	.filter-label {
		font-size: 0.75rem;
		font-weight: 900;
		color: var(--accent-color);
		white-space: nowrap;
	}

	.chips-container {
		display: flex;
		gap: 0.35rem;
		overflow-x: auto;
		scrollbar-width: thin;
		padding-bottom: 0.15rem;
		width: 100%;
	}

	.filter-chip {
		white-space: nowrap;
		font-size: 0.72rem;
		font-weight: 800;
		padding: 0.25rem 0.6rem;
		border-radius: 10px;
		border: 1.5px solid var(--border-color);
		background: var(--card-bg);
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.filter-chip:active {
		transform: scale(0.95);
	}

	.filter-chip.active {
		background: var(--accent-light-bg);
		color: var(--accent-color);
		border-color: var(--accent-color);
	}
</style>
