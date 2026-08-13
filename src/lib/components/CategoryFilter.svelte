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

				<div class="select-pill-wrapper" class:is-filtered={isFiltered}>
					<select
						class="category-select-pill"
						value={selectedCategory}
						onchange={(e) => onSelect((e.target as HTMLSelectElement).value)}
						aria-label="Seleziona Categoria"
					>
						<option value="ALL">Tutte le Categorie ({categories.length})</option>
						{#each categories as cat}
							<option value={cat}>{cat}</option>
						{/each}
					</select>
					<span class="select-arrow">▼</span>
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
		gap: 0.6rem;
		padding: 0.35rem 0.75rem;
		background: var(--card-bg);
		border-radius: 16px;
		border: 2px solid var(--border-color);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
		width: 100%;
		box-sizing: border-box;
	}

	.filter-left-section {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex: 1;
		min-width: 0;
	}

	.filter-icon {
		font-size: 0.95rem;
		flex-shrink: 0;
	}

	.select-pill-wrapper {
		position: relative;
		display: inline-flex;
		align-items: center;
		max-width: 100%;
	}

	.category-select-pill {
		appearance: none;
		-webkit-appearance: none;
		-moz-appearance: none;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		color: var(--text-color);
		font-family: inherit;
		font-weight: 800;
		font-size: 0.8rem;
		padding: 0.3rem 1.6rem 0.3rem 0.75rem;
		border-radius: 9999px;
		cursor: pointer;
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
		max-width: 220px;
		transition: all 0.15s ease;
	}

	.select-pill-wrapper.is-filtered .category-select-pill {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.category-select-pill:hover,
	.category-select-pill:focus {
		outline: none;
		border-color: var(--accent-color);
	}

	.select-arrow {
		position: absolute;
		right: 0.6rem;
		top: 50%;
		transform: translateY(-50%);
		font-size: 0.55rem;
		color: var(--text-muted);
		pointer-events: none;
	}

	.select-pill-wrapper.is-filtered .select-arrow {
		color: var(--accent-color);
	}

	.compact-shuffle-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.32rem 0.75rem;
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
		.category-select-pill {
			max-width: 150px;
			font-size: 0.76rem;
		}

		.compact-shuffle-btn {
			padding: 0.3rem 0.6rem;
			font-size: 0.75rem;
		}

		.shuffle-text {
			font-size: 0.75rem;
		}
	}
</style>
