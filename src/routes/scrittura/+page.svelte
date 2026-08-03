<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import FreeWriteExercise from '$lib/components/FreeWriteExercise.svelte';
	import CategoryFilterBar from '$lib/components/CategoryFilterBar.svelte';
	import type { Card, WritingSubMode } from '$lib/types/cards';

	let cards = $state<Card[]>([]);
	let selectedCategory = $state<string>('ALL');
	let currentIndex = $state(0);
	let selectedSubMode = $state<WritingSubMode>('title-to-desc');

	onMount(() => {
		const unsubscribe = cardsStore.subscribe((c) => (cards = c));
		return unsubscribe;
	});

	let activeCards = $derived.by<Card[]>(() => {
		if (selectedCategory === 'ALL') return cards;
		return cards.filter(
			(c) =>
				c.category === selectedCategory ||
				(c.categories && c.categories.includes(selectedCategory))
		);
	});

	function handleNext() {
		if (currentIndex < activeCards.length - 1) {
			currentIndex++;
		} else {
			currentIndex = 0;
		}
	}
</script>

<div class="scrittura-page-container">
	<CategoryFilterBar
		selectedCategory={selectedCategory}
		onSelectCategory={(cat) => {
			selectedCategory = cat;
			currentIndex = 0;
		}}
	/>

	<div class="duo-tab-bar">
		<button
			class="duo-tab-btn"
			class:active={selectedSubMode === 'title-to-desc'}
			onclick={() => { selectedSubMode = 'title-to-desc'; currentIndex = 0; }}
		>
			<img src="/emoji/writing_hand_3d_default.png" alt="Scrittura" class="tab-emoji" />
			ACRONIMO ➔ DESCRIZIONE
		</button>
		<button
			class="duo-tab-btn"
			class:active={selectedSubMode === 'desc-to-title'}
			onclick={() => { selectedSubMode = 'desc-to-title'; currentIndex = 0; }}
		>
			<img src="/emoji/counterclockwise_arrows_button_3d.png" alt="Inverso" class="tab-emoji" />
			DESCRIZIONE ➔ ACRONIMO
		</button>
		<button
			class="duo-tab-btn"
			class:active={selectedSubMode === 'photo-to-title'}
			onclick={() => { selectedSubMode = 'photo-to-title'; currentIndex = 0; }}
		>
			<img src="/emoji/camera_3d.png" alt="Foto" class="tab-emoji" />
			FOTO ➔ SCRITTURA
		</button>
	</div>

	{#if activeCards.length > 0}
		<FreeWriteExercise
			card={activeCards[currentIndex]}
			subMode={selectedSubMode}
			currentIndex={currentIndex}
			totalCards={activeCards.length}
			onNext={handleNext}
		/>
	{:else}
		<div class="duo-card empty-box">Nessuna scheda trovata per la categoria selezionata.</div>
	{/if}
</div>

<style>
	.scrittura-page-container {
		max-width: 600px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.duo-tab-bar {
		display: flex;
		gap: 0.35rem;
		background: var(--card-bg-subtle);
		padding: 0.4rem;
		border-radius: 18px;
		border: 2px solid var(--border-color);
	}

	.duo-tab-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.65rem 0.4rem;
		border-radius: 14px;
		border: 2px solid transparent;
		background: none;
		color: var(--text-muted);
		font-family: 'Outfit', sans-serif;
		font-weight: 800;
		font-size: 0.72rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.duo-tab-btn.active {
		background: var(--card-bg);
		color: var(--accent-color);
		border-color: var(--accent-color);
		box-shadow: 0 4px 12px var(--shadow-color);
	}

	.tab-emoji {
		width: 18px;
		height: 18px;
		object-fit: contain;
	}

	.empty-box {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
	}
</style>
