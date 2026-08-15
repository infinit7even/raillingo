<script lang="ts">
	import { globalCategoryStore } from '$lib/stores/globalCategoryStore';

	let {
		categories = [],
		selectedCategory = 'ALL',
		onSelect,
		onRefresh = undefined
	} = $props<{
		categories: string[];
		selectedCategory?: string;
		onSelect: (category: string) => void;
		onRefresh?: () => void;
	}>();

	let selectedList = $derived(
		selectedCategory === 'ALL' || !selectedCategory
			? []
			: selectedCategory.split(',').map((s: string) => s.trim())
	);

	let isFiltered = $derived(selectedCategory !== 'ALL' && selectedList.length > 0);

	function toggleCategory(cat: string) {
		if (cat === 'ALL') {
			globalCategoryStore.reset();
			onSelect('ALL');
			return;
		}

		let current = [...selectedList];
		if (current.includes(cat)) {
			current = current.filter((c) => c !== cat);
		} else {
			current.push(cat);
		}

		if (current.length === 0 || current.length === categories.length) {
			globalCategoryStore.reset();
			onSelect('ALL');
		} else {
			const newValue = current.join(',');
			globalCategoryStore.setCategory(newValue);
			onSelect(newValue);
		}
	}

	function handleResetAll() {
		globalCategoryStore.reset();
		onSelect('ALL');
	}
</script>

{#if categories.length > 0 || onRefresh}
	<div class="category-filter-bar duo-card" class:is-active-filter={isFiltered}>
		<div class="filter-pills-scroll">
			<button
				type="button"
				class="cat-chip-pill"
				class:active={!isFiltered}
				onclick={() => toggleCategory('ALL')}
			>
				🏷️ Tutte ({categories.length})
			</button>

			{#each categories as cat}
				{@const isCatSelected = selectedList.includes(cat)}
				<button
					type="button"
					class="cat-chip-pill"
					class:active={isCatSelected}
					onclick={() => toggleCategory(cat)}
				>
					{cat}
				</button>
			{/each}
		</div>

		<div class="filter-right-actions">
			{#if isFiltered}
				<button
					type="button"
					class="clear-category-btn"
					onclick={handleResetAll}
					title="Azzera filtri categoria (✕)"
					aria-label="Azzera filtri categoria"
				>
					✕
				</button>
			{/if}

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
	</div>
{/if}

<style>
	.category-filter-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0.4rem 0.65rem;
		background: var(--card-bg);
		border-radius: 18px;
		border: 2px solid var(--border-color);
		border-bottom: 4px solid var(--border-depth-color);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
		width: 100%;
		box-sizing: border-box;
		transition: border-color 0.2s ease;
	}

	.category-filter-bar.is-active-filter {
		border-color: var(--accent-color);
	}

	.filter-pills-scroll {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		overflow-x: auto;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
		flex: 1;
		min-width: 0;
		padding: 2px 0;
	}

	.filter-pills-scroll::-webkit-scrollbar {
		display: none;
	}

	.cat-chip-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.75rem;
		border-radius: 12px;
		border: 1.5px solid var(--border-color);
		background: var(--card-bg-subtle);
		color: var(--text-muted);
		font-family: 'Outfit', sans-serif;
		font-size: 0.78rem;
		font-weight: 800;
		white-space: nowrap;
		cursor: pointer;
		user-select: none;
		transition: all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
		flex-shrink: 0;
	}

	.cat-chip-pill:hover {
		color: var(--text-color);
		border-color: var(--accent-color);
	}

	.cat-chip-pill:active {
		transform: scale(0.95);
	}

	.cat-chip-pill.active {
		background: var(--accent-light-bg);
		color: var(--accent-color);
		border-color: var(--accent-color);
		font-weight: 900;
		box-shadow: 0 2px 8px var(--shadow-color);
	}

	.filter-right-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.clear-category-btn {
		width: 32px;
		height: 32px;
		border-radius: 10px;
		border: 1.5px solid var(--border-color);
		background: var(--card-bg-subtle);
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 900;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.clear-category-btn:hover {
		background: rgba(255, 94, 91, 0.15);
		color: #ff5e5b;
		border-color: #ff5e5b;
	}

	.clear-category-btn:active {
		transform: scale(0.92);
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
		display: inline-block;
		transition: transform 0.4s ease;
	}

	.compact-shuffle-btn:active .shuffle-icon {
		transform: rotate(360deg);
	}

	@media (max-width: 480px) {
		.cat-chip-pill {
			font-size: 0.75rem;
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
