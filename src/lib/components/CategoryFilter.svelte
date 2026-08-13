<script lang="ts">
	let {
		categories = [],
		selectedCategory = 'ALL',
		onSelect
	} = $props<{
		categories: string[];
		selectedCategory: string;
		onSelect: (category: string) => void;
	}>();
</script>

{#if categories.length > 0}
	<div class="category-filter-container duo-card">
		<span class="filter-label">🏷️ Filtra Categoria:</span>
		<div class="categories-scroll">
			<button
				type="button"
				class="category-chip"
				class:active={selectedCategory === 'ALL'}
				onclick={() => onSelect('ALL')}
			>
				Tutte ({categories.length})
			</button>
			{#each categories as cat}
				<button
					type="button"
					class="category-chip"
					class:active={selectedCategory === cat}
					onclick={() => onSelect(cat)}
				>
					{cat}
				</button>
			{/each}
		</div>
	</div>
{/if}

<style>
	.category-filter-container {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.65rem 1rem;
		background: var(--card-bg);
		border-radius: 16px;
		border: 1px solid var(--border-color);
		margin-bottom: 0.5rem;
	}

	.filter-label {
		font-size: 0.78rem;
		font-weight: 900;
		color: var(--text-muted);
		white-space: nowrap;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.categories-scroll {
		display: flex;
		gap: 0.4rem;
		overflow-x: auto;
		scrollbar-width: none;
		padding: 0.1rem 0;
	}

	.categories-scroll::-webkit-scrollbar {
		display: none;
	}

	.category-chip {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		color: var(--text-muted);
		padding: 0.3rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.78rem;
		font-weight: 800;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s ease;
	}

	.category-chip:hover {
		border-color: var(--accent-color);
		color: var(--text-color);
	}

	.category-chip.active {
		background: var(--accent-color);
		color: #ffffff;
		border-color: var(--accent-color);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	@media (max-width: 600px) {
		.category-filter-container {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.4rem;
			padding: 0.6rem 0.85rem;
		}

		.categories-scroll {
			width: 100%;
		}
	}
</style>
