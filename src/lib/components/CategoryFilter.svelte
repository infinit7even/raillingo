<script lang="ts">
	let {
		categories = [],
		selectedCategory = 'ALL',
		onSelect,
		onRefresh = undefined
	} = $props<{
		categories: string[];
		selectedCategory: string;
		onSelect: (category: string) => void;
		onRefresh?: () => void;
	}>();

	let isFiltered = $derived(selectedCategory !== 'ALL');
</script>

{#if categories.length > 0 || onRefresh}
	<div class="category-filter-container duo-card">
		<div class="filter-left-section">
			{#if categories.length > 0}
				<span class="filter-icon">🏷️</span>
				<select
					class="duo-input category-select"
					class:is-filtered={isFiltered}
					value={selectedCategory}
					onchange={(e) => onSelect((e.target as HTMLSelectElement).value)}
					aria-label="Seleziona Categoria"
				>
					<option value="ALL">Tutte le Categorie ({categories.length})</option>
					{#each categories as cat}
						<option value={cat}>{cat}</option>
					{/each}
				</select>
			{/if}
		</div>

		{#if onRefresh}
			<button
				type="button"
				class="duo-btn duo-btn-purple compact-shuffle-btn"
				onclick={onRefresh}
				title="Rimescola le card"
			>
				<span class="shuffle-icon">🔄</span>
				<span class="shuffle-text">Rimescola</span>
			</button>
		{/if}
	</div>
{/if}

<style>
	.category-filter-container {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0.45rem 0.75rem;
		background: var(--card-bg);
		border-radius: 18px;
		border: 2px solid var(--border-color);
		border-bottom: 4px solid var(--border-depth-color);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
		width: 100%;
		box-sizing: border-box;
	}

	.filter-left-section {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		min-width: 0;
	}

	.filter-icon {
		font-size: 0.95rem;
		flex-shrink: 0;
	}

	.category-select {
		flex: 1;
		min-width: 0;
		padding: 0.4rem 0.85rem;
		border-radius: 12px;
		font-size: 0.82rem;
		font-weight: 800;
		cursor: pointer;
		background-color: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		color: var(--text-color);
		transition: all 0.15s ease;
	}

	.category-select option {
		background-color: var(--card-bg);
		color: var(--text-color);
		padding: 0.5rem;
	}

	.category-select.is-filtered {
		background-color: var(--accent-light-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.compact-shuffle-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.75rem;
		font-size: 0.78rem;
		font-weight: 800;
		border-radius: 12px;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.shuffle-icon {
		font-size: 0.85rem;
	}

	@media (max-width: 480px) {
		.category-select {
			font-size: 0.78rem;
			padding: 0.35rem 0.65rem;
		}

		.compact-shuffle-btn {
			padding: 0.35rem 0.6rem;
			font-size: 0.75rem;
		}

		.shuffle-text {
			font-size: 0.75rem;
		}
	}
</style>
