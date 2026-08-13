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
</script>

{#if categories.length > 0 || onRefresh}
	<div class="category-filter-container duo-card">
		<div class="filter-left-section">
			{#if categories.length > 0}
				<span class="filter-label">🏷️ Categorie:</span>
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
		gap: 0.75rem;
		padding: 0.5rem 0.85rem;
		background: var(--card-bg);
		border-radius: 18px;
		border: 2px solid var(--border-color);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
		width: 100%;
		box-sizing: border-box;
	}

	.filter-left-section {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	.filter-label {
		font-size: 0.75rem;
		font-weight: 900;
		color: var(--text-muted);
		white-space: nowrap;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		flex-shrink: 0;
	}

	.categories-scroll {
		display: flex;
		gap: 0.35rem;
		overflow-x: auto;
		scrollbar-width: none;
		padding: 0.1rem 0;
		align-items: center;
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
		font-family: inherit;
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

	.compact-shuffle-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.85rem;
		font-size: 0.78rem;
		font-weight: 800;
		border-radius: 12px;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.shuffle-icon {
		font-size: 0.9rem;
	}

	@media (max-width: 540px) {
		.category-filter-container {
			flex-wrap: nowrap;
			gap: 0.5rem;
			padding: 0.45rem 0.65rem;
		}

		.filter-label {
			display: none; /* Hide 'CATEGORIE:' text on mobile to save space */
		}

		.shuffle-text {
			display: inline;
		}
	}
</style>
