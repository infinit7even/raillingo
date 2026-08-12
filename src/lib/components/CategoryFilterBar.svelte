<script lang="ts">
	import { cardsStore } from '$lib/stores/cardsStore';
	import type { Card } from '$lib/types/cards';

	let { selectedCategory, onSelectCategory } = $props<{
		selectedCategory: string;
		onSelectCategory: (category: string) => void;
	}>();

	let cards = $state<Card[]>([]);

	$effect(() => {
		const unsubscribe = cardsStore.subscribe((c) => (cards = c));
		return unsubscribe;
	});

	// Compute category counts
	let categoryCounts = $derived.by<Record<string, number>>(() => {
		const map: Record<string, number> = {};
		for (const card of cards) {
			const cats: string[] = [];
			if (card.category) cats.push(card.category);
			if (card.categories) cats.push(...card.categories);

			const uniqueCats = Array.from(new Set(cats));
			for (const cat of uniqueCats) {
				if (cat && cat.trim()) {
					const trimmed = cat.trim();
					map[trimmed] = (map[trimmed] || 0) + 1;
				}
			}
		}
		return map;
	});

	let sortedCategories = $derived.by<string[]>(() => {
		return Object.keys(categoryCounts).sort();
	});
</script>

<div class="category-filter-bar duo-card">
	<div class="filter-header">
		<span class="filter-icon">📁</span>
		<span class="filter-title">Filtra Categoria:</span>
	</div>

	<div class="chips-scroll-container">
		<button
			type="button"
			class="filter-chip"
			class:active={selectedCategory === 'ALL'}
			onclick={() => onSelectCategory('ALL')}
		>
			<span class="chip-label">Tutte le Categorie</span>
			<span class="chip-count">{cards.length}</span>
		</button>

		{#each sortedCategories as cat}
			<button
				type="button"
				class="filter-chip"
				class:active={selectedCategory === cat}
				onclick={() => onSelectCategory(cat)}
			>
				<span class="chip-label">{cat}</span>
				<span class="chip-count">{categoryCounts[cat] || 0}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.category-filter-bar {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.75rem;
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		border-radius: 16px;
		margin-bottom: 1rem;
		width: 100%;
		box-sizing: border-box;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
	}

	.filter-header {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		white-space: nowrap;
	}

	.filter-icon {
		font-size: 0.95rem;
	}

	.filter-title {
		font-size: 0.78rem;
		font-weight: 900;
		color: var(--accent-color);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.chips-scroll-container {
		display: flex;
		gap: 0.4rem;
		overflow-x: auto;
		scrollbar-width: none;
		-ms-overflow-style: none;
		padding: 0.2rem 0;
		width: 100%;
		-webkit-overflow-scrolling: touch;
	}

	.chips-scroll-container::-webkit-scrollbar {
		display: none;
		width: 0;
		height: 0;
	}

	.filter-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		white-space: nowrap;
		font-size: 0.78rem;
		font-weight: 800;
		padding: 0.35rem 0.75rem;
		border-radius: 12px;
		border: 1.5px solid var(--border-color);
		background: var(--card-bg-subtle);
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
		user-select: none;
	}

	.filter-chip:hover {
		border-color: var(--accent-color);
		color: var(--text-color);
	}

	.filter-chip:active {
		transform: scale(0.96);
	}

	.filter-chip.active {
		background: var(--accent-light-bg);
		color: var(--accent-color);
		border-color: var(--accent-color);
		box-shadow: 0 2px 8px rgba(168, 85, 247, 0.15);
	}

	@media (max-width: 580px) {
		.filter-title {
			display: none;
		}
		.category-filter-bar {
			padding: 0.4rem 0.5rem;
			margin-bottom: 0.75rem;
			gap: 0.4rem;
		}
		.filter-chip {
			font-size: 0.75rem;
			padding: 0.3rem 0.6rem;
		}
	}
</style>
