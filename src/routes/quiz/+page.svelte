<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import MultipleChoiceQuiz from '$lib/components/MultipleChoiceQuiz.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import type { Card } from '$lib/types/cards';

	let cards = $state<Card[]>([]);
	let currentIndex = $state(0);

	onMount(() => {
		const unsubscribe = cardsStore.subscribe((c) => (cards = c));
		return unsubscribe;
	});

	function handleNext() {
		if (currentIndex < cards.length - 1) {
			currentIndex++;
		} else {
			currentIndex = 0;
		}
	}
</script>

<div class="quiz-page-container">
	<PageHeader
		title="Quiz a Scelta Multipla"
		subtitle="Metti alla prova la tua memoria selezionando la risposta corretta tra 5 opzioni."
		icon="/emoji/star_3d.png"
		variant="purple"
	/>

	{#if cards.length >= 5}
		<MultipleChoiceQuiz
			targetCard={cards[currentIndex]}
			allCards={cards}
			{currentIndex}
			totalCards={cards.length}
			onNext={handleNext}
		/>
	{:else if cards.length > 0}
		<div class="duo-card empty-box">
			Servono almeno 5 schede per generare le opzioni del quiz. Attualmente ve ne sono {cards.length}.
		</div>
	{:else}
		<div class="duo-card empty-box">Nessuna scheda trovata.</div>
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
