<script lang="ts">
	import { globalCategoryStore } from '$lib/stores/globalCategoryStore';
	import { fade, scale } from 'svelte/transition';

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

	let isModalOpen = $state(false);
	let filterSearch = $state('');

	let selectedList = $derived(
		selectedCategory === 'ALL' || !selectedCategory
			? []
			: selectedCategory.split(',').map((s: string) => s.trim())
	);

	let isFiltered = $derived(selectedCategory !== 'ALL' && selectedList.length > 0);

	let filteredCategories = $derived.by(() => {
		const q = filterSearch.toLowerCase().trim();
		if (!q) return categories;
		return categories.filter((c: string) => c.toLowerCase().includes(q));
	});

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

	function removeCategory(cat: string, e?: MouseEvent) {
		if (e) e.stopPropagation();
		toggleCategory(cat);
	}

	function handleResetAll() {
		globalCategoryStore.reset();
		onSelect('ALL');
	}

	function handleSelectAll() {
		globalCategoryStore.reset();
		onSelect('ALL');
	}
</script>

{#if categories.length > 0 || onRefresh}
	<div class="category-filter-bar duo-card">
		<!-- Trigger button to open the Category Picker -->
		<button
			type="button"
			class="cat-picker-trigger-btn"
			class:active={isFiltered}
			onclick={() => (isModalOpen = true)}
			title="Apri selettore avanzato categorie con ricerca"
		>
			<div class="trigger-left">
				<span class="trigger-ico">🏷️</span>
				<span class="trigger-label">Categorie</span>
			</div>
			<div class="trigger-right">
				<span class="trigger-badge">
					{#if !isFiltered}
						Tutte ({categories.length})
					{:else}
						{selectedList.length} attive
					{/if}
				</span>
				<span class="trigger-arrow">▾</span>
			</div>
		</button>



		<!-- Right Side Actions: Reset (✕) & Shuffle (🔄) -->
		<div class="filter-right-actions">
			{#if isFiltered}
				<button
					type="button"
					class="clear-category-btn"
					onclick={handleResetAll}
					title="Azzera tutti i filtri categoria (✕)"
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

	<!-- 🎛️ Category Multi-Select Search Modal / Sheet -->
	{#if isModalOpen}
		<div
			class="modal-backdrop"
			onclick={() => (isModalOpen = false)}
			onkeydown={(e) => e.key === 'Escape' && (isModalOpen = false)}
			role="button"
			tabindex="0"
			aria-label="Chiudi selettore categorie"
			transition:fade={{ duration: 120 }}
		></div>

		<div
			class="category-picker-modal duo-card"
			transition:scale={{ start: 0.95, duration: 150 }}
		>
			<div class="modal-header">
				<div class="modal-title-group">
					<span class="modal-ico">🏷️</span>
					<div class="modal-title-text">
						<h3 class="modal-heading">Filtro Categorie</h3>
						<span class="modal-sub">
							{#if !isFiltered}
								Tutte le {categories.length} categorie attive
							{:else}
								{selectedList.length} di {categories.length} selezionate
							{/if}
						</span>
					</div>
				</div>
				<button
					type="button"
					class="modal-close-btn"
					onclick={() => (isModalOpen = false)}
					aria-label="Chiudi"
				>
					✕
				</button>
			</div>

			<!-- Live Search Filter for Categories -->
			<div class="modal-search-box">
				<span class="msearch-ico">🔍</span>
				<input
					type="text"
					bind:value={filterSearch}
					placeholder="Cerca tra le {categories.length} categorie..."
					class="msearch-input"
				/>
				{#if filterSearch}
					<button
						type="button"
						class="msearch-clear"
						onclick={() => (filterSearch = '')}
					>
						✕
					</button>
				{/if}
			</div>

			<!-- Quick Batch Actions -->
			<div class="modal-batch-actions">
				<button
					type="button"
					class="batch-btn"
					class:active-batch={!isFiltered}
					onclick={handleSelectAll}
				>
					🏷️ Tutte
				</button>
				<button
					type="button"
					class="batch-btn"
					onclick={handleResetAll}
				>
					✕ Azzera selezione
				</button>
			</div>

			<!-- Scrollable Category Checkboxes List -->
			<div class="category-checkbox-list">
				{#if filteredCategories.length === 0}
					<div class="empty-cat-search">
						<p>Nessuna categoria trovata per "{filterSearch}"</p>
					</div>
				{:else}
					{#each filteredCategories as cat}
						{@const isSelected = selectedList.includes(cat)}
						<button
							type="button"
							class="cat-check-item"
							class:checked={isSelected}
							onclick={() => toggleCategory(cat)}
						>
							<div class="checkbox-box" class:checked={isSelected}>
								{#if isSelected}✓{/if}
							</div>
							<span class="cat-check-name">{cat}</span>
						</button>
					{/each}
				{/if}
			</div>

			<!-- Footer Apply / Close Button -->
			<div class="modal-footer">
				<button
					type="button"
					class="duo-btn duo-btn-green apply-cat-btn"
					onclick={() => (isModalOpen = false)}
				>
					✓ CONFERMA ({isFiltered ? `${selectedList.length} attive` : 'Tutte'})
				</button>
			</div>
		</div>
	{/if}
{/if}

<style>
	.category-filter-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.4rem 0.65rem;
		background: var(--card-bg);
		border-radius: 18px;
		border: 2px solid var(--border-color);
		border-bottom: 4px solid var(--border-depth-color);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
		width: 100%;
		box-sizing: border-box;
	}

	/* Main Category Trigger Button */
	.cat-picker-trigger-btn {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.42rem 0.8rem;
		border-radius: 12px;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-bottom: 2.5px solid var(--border-depth-color);
		color: var(--text-color);
		font-family: 'Outfit', sans-serif;
		font-size: 0.8rem;
		font-weight: 800;
		cursor: pointer;
		white-space: nowrap;
		min-width: 0;
		box-sizing: border-box;
		transition: all 0.12s ease;
	}

	.cat-picker-trigger-btn:hover {
		background: var(--hover-bg);
		border-color: var(--accent-color);
	}

	.cat-picker-trigger-btn:active {
		transform: translateY(1.5px);
		border-bottom-width: 1px;
	}

	.cat-picker-trigger-btn.active {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.trigger-left {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.trigger-right {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.trigger-ico {
		font-size: 0.85rem;
	}

	.trigger-badge {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		padding: 0.1rem 0.4rem;
		font-size: 0.68rem;
		font-weight: 900;
		color: var(--accent-color);
	}

	.trigger-arrow {
		font-size: 0.75rem;
		opacity: 0.6;
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

	.compact-shuffle-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.65rem;
		font-size: 0.76rem;
		font-weight: 800;
		border-radius: 10px;
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

	/* 🎛️ Category Modal / Popover Styles */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		z-index: 500;
	}

	.category-picker-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 90vw;
		max-width: 460px;
		max-height: 82vh;
		background: var(--card-bg);
		border-radius: 24px;
		border: 2px solid var(--border-color);
		border-bottom: 6px solid var(--border-depth-color);
		box-shadow: 0 20px 48px rgba(0, 0, 0, 0.4);
		z-index: 510;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		box-sizing: border-box;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.5rem;
		border-bottom: 2px solid var(--border-color);
	}

	.modal-title-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.modal-ico {
		font-size: 1.3rem;
	}

	.modal-heading {
		font-family: 'Outfit', sans-serif;
		font-size: 1.1rem;
		font-weight: 900;
		margin: 0;
		color: var(--text-color);
	}

	.modal-sub {
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--text-muted);
	}

	.modal-close-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 10px;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 900;
		cursor: pointer;
	}

	.modal-search-box {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-radius: 14px;
		padding: 0.45rem 0.75rem;
	}

	.msearch-ico {
		font-size: 0.95rem;
		color: var(--text-muted);
	}

	.msearch-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-color);
		font-family: 'Outfit', sans-serif;
		font-size: 0.88rem;
		font-weight: 700;
	}

	.msearch-clear {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 0.85rem;
		cursor: pointer;
	}

	.modal-batch-actions {
		display: flex;
		gap: 0.4rem;
	}

	.batch-btn {
		flex: 1;
		padding: 0.4rem 0.6rem;
		border-radius: 10px;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		color: var(--text-muted);
		font-family: 'Outfit', sans-serif;
		font-size: 0.75rem;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.batch-btn:hover {
		color: var(--text-color);
		border-color: var(--accent-color);
	}

	.batch-btn.active-batch {
		background: var(--accent-light-bg);
		color: var(--accent-color);
		border-color: var(--accent-color);
	}

	/* Scrollable Checkbox List */
	.category-checkbox-list {
		flex: 1;
		overflow-y: auto;
		max-height: 240px;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding-right: 0.2rem;
	}

	.empty-cat-search {
		padding: 1.5rem;
		text-align: center;
		color: var(--text-muted);
		font-size: 0.82rem;
	}

	.cat-check-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.75rem;
		border-radius: 12px;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		color: var(--text-color);
		cursor: pointer;
		text-align: left;
		transition: all 0.12s ease;
		user-select: none;
	}

	.cat-check-item:hover {
		background: var(--hover-bg);
		border-color: var(--accent-color);
	}

	.cat-check-item.checked {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.checkbox-box {
		width: 20px;
		height: 20px;
		border-radius: 6px;
		border: 2px solid var(--border-color);
		background: var(--card-bg);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 900;
		color: #ffffff;
		flex-shrink: 0;
		transition: all 0.12s ease;
	}

	.checkbox-box.checked {
		background: var(--accent-color);
		border-color: var(--accent-color);
	}

	.cat-check-name {
		font-family: 'Outfit', sans-serif;
		font-size: 0.85rem;
		font-weight: 800;
		flex: 1;
	}

	.modal-footer {
		padding-top: 0.3rem;
		border-top: 1.5px solid var(--border-color);
	}

	.apply-cat-btn {
		width: 100%;
		padding: 0.75rem;
		font-size: 0.88rem;
		font-weight: 900;
		justify-content: center;
	}

	@media (max-width: 480px) {
		.cat-picker-trigger-btn {
			font-size: 0.74rem;
			padding: 0.35rem 0.55rem;
		}

		.category-picker-modal {
			width: 94vw;
			padding: 1rem;
			gap: 0.65rem;
		}

		.category-checkbox-list {
			max-height: 200px;
		}
	}
</style>
