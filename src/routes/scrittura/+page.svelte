<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import FreeWriteExercise from '$lib/components/FreeWriteExercise.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ModeTabs from '$lib/components/ModeTabs.svelte';
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

	const writingTabs = [
		{ id: 'title-to-desc', label: 'ACRONIMO ➔ DESCRIZIONE', emoji: '/emoji/writing_hand_3d_default.png' },
		{ id: 'desc-to-title', label: 'DESCRIZIONE ➔ ACRONIMO', emoji: '/emoji/counterclockwise_arrows_button_3d.png' },
		{ id: 'photo-to-title', label: 'FOTO ➔ SCRITTURA', emoji: '/emoji/camera_3d.png' }
	];
</script>

<div class="scrittura-page-container">
	<!-- Page Header standard -->
	<PageHeader
		title="Scrittura Libera"
		subtitle="Digita l'acronimo, il significato esteso o la spiegazione per fissare la memorizzazione motoria."
		badge="Modalità Scrittura"
		icon="/emoji/writing_hand_3d_default.png"
		variant="blue"
	/>

	<ModeTabs
		tabs={writingTabs}
		activeTab={selectedSubMode}
		onSelect={(id) => {
			selectedSubMode = id as WritingSubMode;
			currentIndex = 0;
		}}
	/>

	{#if cards.length > 0}
		<FreeWriteExercise
			card={cards[currentIndex]}
			subMode={selectedSubMode}
			currentIndex={currentIndex}
			totalCards={cards.length}
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

	.empty-box {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
	}
</style>
