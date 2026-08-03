<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import MultipleChoiceQuiz from '$lib/components/MultipleChoiceQuiz.svelte';
	import CategoryFilterBar from '$lib/components/CategoryFilterBar.svelte';
	import type { Card } from '$lib/types/cards';

	let cards = $state<Card[]>([]);
	let selectedCategory = $state<string>('ALL');
	let currentIndex = $state(0);

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

<div class="quiz-page-container">
	<CategoryFilterBar
		selectedCategory={selectedCategory}
		onSelectCategory={(cat) => {
			selectedCategory = cat;
			currentIndex = 0;
		}}
	/>

	{#if activeCards.length >= 5}
		<MultipleChoiceQuiz
			targetCard={activeCards[currentIndex]}
			allCards={cards}
			currentIndex={currentIndex}
			totalCards={activeCards.length}
			onNext={handleNext}
		/>
	{:else if activeCards.length > 0}
		<div class="duo-card empty-box">
			Servono almeno 5 schede nella categoria selezionata per generare le opzioni del quiz. Attualmente ve ne sono {activeCards.length}.
		</div>
	{:else}
		<div class="duo-card empty-box">Nessuna scheda trovata per questa categoria.</div>
	{/if}
</div>

<style>
	.quiz-page-container {
		max-width: 600px;
		margin: 0 auto;
	}

	.empty-box {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
	}
</style>
