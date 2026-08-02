<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import PhotoStudy from '$lib/components/PhotoStudy.svelte';
	import type { Card } from '$lib/types/cards';

	let photoCards = $state<Card[]>([]);
	let currentIndex = $state(0);

	onMount(() => {
		const unsubscribe = cardsStore.subscribe(() => {
			photoCards = cardsStore.photoCards;
		});
		return unsubscribe;
	});

	function handleNext() {
		if (currentIndex < photoCards.length - 1) {
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
	{#if photoCards.length > 0}
		<PhotoStudy
			card={photoCards[currentIndex]}
			currentIndex={currentIndex}
			totalCards={photoCards.length}
			onNext={handleNext}
			onPrev={handlePrev}
		/>
	{:else}
		<div class="empty-box">
			<h2>📷 Nessuna scheda con immagine trovata</h2>
			<p>Aggiungi immagini alle schede dal pannello <strong>/admin</strong> per sbloccare questa modalità.</p>
			<a href="/admin" class="admin-btn">Vai al Pannello Admin</a>
		</div>
	{/if}
</div>

<style>
	.mode-page {
		padding: 1rem 0;
	}

	.empty-box {
		text-align: center;
		padding: 3rem 1.5rem;
		background: var(--card-bg);
		border-radius: 24px;
		border: 1px dashed var(--border-color);
		max-width: 500px;
		margin: 2rem auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: center;
	}

	.admin-btn {
		padding: 0.75rem 1.25rem;
		border-radius: 12px;
		background: var(--accent-color);
		color: white;
		text-decoration: none;
		font-weight: 700;
	}
</style>
