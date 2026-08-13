<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { ignoredCardsStore } from '$lib/stores/ignoredCardsStore';
	import FreeWriteExercise from '$lib/components/FreeWriteExercise.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ModeTabs from '$lib/components/ModeTabs.svelte';
	import CategoryFilter from '$lib/components/CategoryFilter.svelte';
	import type { Card, WritingSubMode } from '$lib/types/cards';

	let rawCards = $state<Card[]>([]);
	let ignoredIds = $state<Set<string>>(new Set());
	let selectedCategory = $state('ALL');
	let currentIndex = $state(0);
	let selectedSubMode = $state<WritingSubMode>('title-to-desc');

	let shuffledDeck = $state<Card[]>([]);

	function shuffleArray<T>(array: T[]): T[] {
		const result = [...array];
		for (let i = result.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[result[i], result[j]] = [result[j], result[i]];
		}
		return result;
	}

	onMount(() => {
		const unsubCards = cardsStore.subscribe((c) => {
			rawCards = c;
			refreshDeck();
		});

		const unsubIgnored = ignoredCardsStore.subscribe((ids) => {
			ignoredIds = ids;
			refreshDeck();
		});

		return () => {
			unsubCards();
			unsubIgnored();
		};
	});

	let availableCategories = $derived.by<string[]>(() => {
		const set = new Set<string>();
		for (const c of rawCards) {
			if (c.category && c.category.trim()) {
				set.add(c.category.trim());
			}
		}
		return Array.from(set).sort();
	});

	let validCards = $derived(
		rawCards.filter((c) => {
			const notIgnored = !ignoredIds.has(c.id);
			const matchesCategory =
				selectedCategory === 'ALL' || (c.category && c.category.trim() === selectedCategory);
			return notIgnored && matchesCategory;
		})
	);

	function refreshDeck() {
		shuffledDeck = shuffleArray(validCards);
		currentIndex = 0;
	}

	$effect(() => {
		const _cat = selectedCategory;
		const _subMode = selectedSubMode;
		refreshDeck();
	});

	let activeCards = $derived(
		selectedSubMode === 'photo-to-title'
			? shuffledDeck.filter((c) => c.images && c.images.length > 0)
			: shuffledDeck
	);

	function handleNext() {
		if (currentIndex < activeCards.length - 1) {
			currentIndex++;
		} else {
			currentIndex = 0;
		}
	}

	const writingTabs = [
		{
			id: 'title-to-desc',
			label: 'ACRO ➔ DESC',
			emoji: '/emoji/writing_hand_3d_default.png'
		},
		{
			id: 'desc-to-title',
			label: 'DESC ➔ ACRO',
			emoji: '/emoji/counterclockwise_arrows_button_3d.png'
		},
		{ id: 'photo-to-title', label: 'FOTO ➔ DESCR', emoji: '/emoji/camera_3d.png' }
	];
</script>

<div class="scrittura-page-container">
	<!-- Page Header standard -->
	<PageHeader
		title="Scrittura Libera"
		subtitle="Digita l'acronimo, il titolo o la spiegazione per fissare la memorizzazione motoria."
		icon="/emoji/writing_hand_3d_default.png"
		variant="red"
	/>

	<ModeTabs
		tabs={writingTabs}
		activeTab={selectedSubMode}
		onSelect={(id) => {
			selectedSubMode = id as WritingSubMode;
			currentIndex = 0;
			refreshDeck();
		}}
	/>

	<!-- Single Unified Category Filter & Rimescola Bar -->
	<CategoryFilter
		categories={availableCategories}
		{selectedCategory}
		onSelect={(cat) => (selectedCategory = cat)}
		onRefresh={refreshDeck}
	/>

	{#if activeCards.length > 0}
		<FreeWriteExercise
			card={activeCards[currentIndex]}
			subMode={selectedSubMode}
			{currentIndex}
			totalCards={activeCards.length}
			onNext={handleNext}
		/>
	{:else}
		<div class="duo-card empty-box">
			{#if selectedSubMode === 'photo-to-title'}
				Nessuna scheda con foto trovata per i filtri selezionati.
			{:else}
				Nessuna scheda trovata per la categoria selezionata.
			{/if}
		</div>
	{/if}
</div>

<style>
	.scrittura-page-container {
		max-width: 600px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.empty-box {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
	}
</style>
