<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import FlashCard from '$lib/components/FlashCard.svelte';
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
		}
	}

	function handlePrev() {
		if (currentIndex > 0) {
			currentIndex--;
		}
	}
</script>

<div class="mode-page">
	{#if cards.length > 0}
		<FlashCard
			card={cards[currentIndex]}
			currentIndex={currentIndex}
			totalCards={cards.length}
			onNext={handleNext}
			onPrev={handlePrev}
		/>
	{:else}
		<div class="empty-box">Caricamento delle schede di ripasso...</div>
	{/if}
</div>

<style>
	.mode-page {
		padding: 1rem 0;
	}
	.empty-box {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
	}
</style>
