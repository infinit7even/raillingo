<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import FreeWriteExercise from '$lib/components/FreeWriteExercise.svelte';
	import type { Card, WritingSubMode } from '$lib/types/cards';

	let cards = $state<Card[]>([]);
	let currentIndex = $state(0);
	let selectedSubMode = $state<WritingSubMode>('title-to-desc');

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

<div class="mode-page">
	<div class="submode-selector">
		<button
			class="submode-btn"
			class:active={selectedSubMode === 'title-to-desc'}
			onclick={() => { selectedSubMode = 'title-to-desc'; currentIndex = 0; }}
		>
			📝 Acronimo ➔ Descrizione
		</button>
		<button
			class="submode-btn"
			class:active={selectedSubMode === 'desc-to-title'}
			onclick={() => { selectedSubMode = 'desc-to-title'; currentIndex = 0; }}
		>
			🔄 Descrizione ➔ Acronimo
		</button>
		<button
			class="submode-btn"
			class:active={selectedSubMode === 'photo-to-title'}
			onclick={() => { selectedSubMode = 'photo-to-title'; currentIndex = 0; }}
		>
			📷 Foto ➔ Scrittura
		</button>
	</div>

	{#if cards.length > 0}
		<FreeWriteExercise
			card={cards[currentIndex]}
			subMode={selectedSubMode}
			currentIndex={currentIndex}
			totalCards={cards.length}
			onNext={handleNext}
		/>
	{:else}
		<div class="empty-box">Caricamento esercizio...</div>
	{/if}
</div>

<style>
	.mode-page {
		padding: 1rem 0;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.submode-selector {
		display: flex;
		gap: 0.5rem;
		justify-content: center;
		flex-wrap: wrap;
		max-width: 600px;
		margin: 0 auto;
	}

	.submode-btn {
		padding: 0.6rem 1rem;
		border-radius: 12px;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.submode-btn:hover {
		color: var(--text-color);
		border-color: var(--accent-color);
	}

	.submode-btn.active {
		background: var(--accent-light-bg);
		color: var(--accent-color);
		border-color: var(--accent-color);
	}

	.empty-box {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
	}
</style>
