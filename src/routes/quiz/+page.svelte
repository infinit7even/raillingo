<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { ignoredCardsStore } from '$lib/stores/ignoredCardsStore';
	import MultipleChoiceQuiz from '$lib/components/MultipleChoiceQuiz.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import CategoryFilter from '$lib/components/CategoryFilter.svelte';
	import type { Card } from '$lib/types/cards';

	import { globalCategoryStore, matchesCategory } from '$lib/stores/globalCategoryStore';

	let rawCards = $state<Card[]>([]);
	let ignoredIds = $state<Set<string>>(new Set());
	let selectedCategory = $state('ALL');
	let currentIndex = $state(0);
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
			refreshQuiz();
		});

		const unsubIgnored = ignoredCardsStore.subscribe((ids) => {
			ignoredIds = ids;
			refreshQuiz();
		});

		const unsubCategory = globalCategoryStore.subscribe((cat) => {
			if (selectedCategory !== cat) {
				selectedCategory = cat;
				refreshQuiz();
			}
		});

		return () => {
			unsubCards();
			unsubIgnored();
			unsubCategory();
		};
	});

	let availableCategories = $derived.by<string[]>(() => {
		const set = new Set<string>();
		for (const c of rawCards) {
			if (c.description && c.description.trim() && c.category && c.category.trim()) {
				set.add(c.category.trim());
			}
		}
		return Array.from(set).sort();
	});

	let validCards = $derived(
		rawCards.filter((c) => {
			const hasDescription = Boolean(c.description && c.description.trim() !== '');
			const notIgnored = !ignoredIds.has(c.id);
			const matchesCat = matchesCategory(c.category, selectedCategory);
			return hasDescription && notIgnored && matchesCat;
		})
	);

	function refreshQuiz() {
		shuffledDeck = shuffleArray(validCards);
		currentIndex = 0;
	}

	$effect(() => {
		const _cat = selectedCategory;
		refreshQuiz();
	});

	function handleNext() {
		if (currentIndex < shuffledDeck.length - 1) {
			currentIndex++;
		} else {
			refreshQuiz();
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

	<!-- Single Unified Category & Shuffle Bar -->
	<CategoryFilter
		categories={availableCategories}
		{selectedCategory}
		onSelect={(cat) => (selectedCategory = cat)}
		onRefresh={refreshQuiz}
	/>

	<!-- Duolingo Progress Track -->
	{#if shuffledDeck.length > 0}
		<div class="duo-progress-track">
			<div
				class="duo-progress-fill"
				style="width: {((currentIndex + 1) / shuffledDeck.length) * 100}%"
			></div>
		</div>
	{/if}

	{#if shuffledDeck.length >= 5}
		<MultipleChoiceQuiz
			targetCard={shuffledDeck[currentIndex]}
			allCards={validCards}
			{currentIndex}
			totalCards={shuffledDeck.length}
			onNext={handleNext}
		/>
	{:else if shuffledDeck.length > 0}
		<div class="duo-card empty-box">
			Servono almeno 5 schede valide per generare le opzioni del quiz. Attualmente ve ne sono {shuffledDeck.length}.
		</div>
	{:else}
		<div class="duo-card empty-box">Nessuna scheda trovata per i filtri selezionati.</div>
	{/if}
</div>

<style>
	.quiz-page-container {
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
