<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { ignoredCardsStore } from '$lib/stores/ignoredCardsStore';
	import FlashCard from '$lib/components/FlashCard.svelte';
	import PhotoStudy from '$lib/components/PhotoStudy.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ModeTabs from '$lib/components/ModeTabs.svelte';
	import CategoryFilter from '$lib/components/CategoryFilter.svelte';
	import { statsStore } from '$lib/stores/statsStore';
	import type { Card } from '$lib/types/cards';

	let rawCards = $state<Card[]>([]);
	let ignoredIds = $state<Set<string>>(new Set());
	let subMode = $state<'standard' | 'foto' | 'inverso'>('standard');
	let selectedCategory = $state('ALL');
	let currentIndex = $state(0);
	let revealed = $state(false);

	// Shuffled active cards deck
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
			refreshCards();
		});

		const unsubIgnored = ignoredCardsStore.subscribe((ids) => {
			ignoredIds = ids;
			refreshCards();
		});

		return () => {
			unsubCards();
			unsubIgnored();
		};
	});

	// Derive unique categories from available non-ignored cards
	let availableCategories = $derived.by<string[]>(() => {
		const set = new Set<string>();
		for (const c of rawCards) {
			if (c.category && c.category.trim()) {
				set.add(c.category.trim());
			}
		}
		return Array.from(set).sort();
	});

	// Filter out ignored cards & filter by category
	let validCards = $derived(
		rawCards.filter((c) => {
			const notIgnored = !ignoredIds.has(c.id);
			const matchesCategory =
				selectedCategory === 'ALL' || (c.category && c.category.trim() === selectedCategory);
			return notIgnored && matchesCategory;
		})
	);

	function refreshCards() {
		shuffledDeck = shuffleArray(validCards);
		currentIndex = 0;
		revealed = false;
	}

	$effect(() => {
		const _cat = selectedCategory;
		const _mode = subMode;
		refreshCards();
	});

	let photoCards = $derived(shuffledDeck.filter((c) => c.images && c.images.length > 0));
	let activeCards = $derived(subMode === 'foto' ? photoCards : shuffledDeck);

	function handleNext() {
		if (currentIndex < activeCards.length - 1) {
			currentIndex++;
		} else {
			currentIndex = 0;
		}
	}

	function handlePrev() {
		if (currentIndex > 0) {
			currentIndex--;
		}
	}

	function toggleReveal() {
		revealed = !revealed;
		if (revealed) {
			statsStore.recordStudySession();
		}
	}

	async function toggleIgnoredCurrentCard() {
		if (activeCards.length > 0) {
			const current = activeCards[currentIndex];
			await ignoredCardsStore.toggleIgnored(current.id);
		}
	}

	const flashcardTabs = [
		{ id: 'standard', label: 'TESTUALE', emoji: '/emoji/open_book_3d.png' },
		{ id: 'foto', label: 'VISIVO', emoji: '/emoji/camera_3d.png' },
		{ id: 'inverso', label: 'INVERSO', emoji: '/emoji/counterclockwise_arrows_button_3d.png' }
	];
</script>

<div class="ripasso-page-container">
	<!-- Page Header standard -->
	<PageHeader
		title="Ripasso e Flashcard"
		subtitle="Gira le card ed allenati con la memoria visiva delle foto."
		icon="/emoji/open_book_3d.png"
		variant="green"
	/>

	<!-- Sub-mode Selector Bar -->
	<ModeTabs
		tabs={flashcardTabs}
		activeTab={subMode}
		onSelect={(id) => {
			subMode = id as 'standard' | 'foto' | 'inverso';
			currentIndex = 0;
			refreshCards();
		}}
	/>

	<!-- Unified Category Filter & Rimescola Bar -->
	<CategoryFilter
		categories={availableCategories}
		{selectedCategory}
		onSelect={(cat) => (selectedCategory = cat)}
		onRefresh={refreshCards}
	/>

	{#if subMode === 'standard'}
		{#if activeCards.length > 0}
			<FlashCard
				card={activeCards[currentIndex]}
				mode="standard"
				{currentIndex}
				totalCards={activeCards.length}
				onNext={handleNext}
				onPrev={handlePrev}
			/>
		{:else}
			<div class="duo-card empty-box">Nessuna scheda di ripasso trovata per questa categoria.</div>
		{/if}
	{:else if subMode === 'foto'}
		{#if photoCards.length > 0}
			<FlashCard
				card={photoCards[currentIndex]}
				mode="foto"
				{currentIndex}
				totalCards={photoCards.length}
				onNext={handleNext}
				onPrev={handlePrev}
			/>
		{:else}
			<div class="duo-card empty-box">
				<h2>📷 Nessuna scheda con immagine trovata</h2>
				<p>Aggiungi immagini alle schede dal pannello admin per sbloccare questa modalità.</p>
			</div>
		{/if}
	{:else if subMode === 'inverso'}
		{#if activeCards.length > 0}
			<FlashCard
				card={activeCards[currentIndex]}
				mode="inverso"
				{currentIndex}
				totalCards={activeCards.length}
				onNext={handleNext}
				onPrev={handlePrev}
			/>
		{:else}
			<div class="duo-card empty-box">Nessuna scheda trovata per la categoria selezionata.</div>
		{/if}
	{/if}
</div>

<style>
	.ripasso-page-container {
		max-width: 600px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.empty-box {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
	}
</style>
