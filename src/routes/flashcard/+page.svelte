<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { ignoredCardsStore } from '$lib/stores/ignoredCardsStore';
	import FlashCard from '$lib/components/FlashCard.svelte';
	import FreeWriteExercise from '$lib/components/FreeWriteExercise.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ModeTabs from '$lib/components/ModeTabs.svelte';
	import CategoryFilter from '$lib/components/CategoryFilter.svelte';
	import type { Card } from '$lib/types/cards';

	import { globalCategoryStore } from '$lib/stores/globalCategoryStore';

	let rawCards = $state<Card[]>([]);
	let ignoredIds = $state<Set<string>>(new Set());
	let subMode = $state<'standard' | 'foto' | 'inverso'>('standard');
	let isWritingMode = $state(false);
	let selectedCategory = $state('ALL');
	let currentIndex = $state(0);

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
		if (browser) {
			const urlParam = page.url.searchParams.get('writing');
			const urlMode = page.url.searchParams.get('mode');
			if (urlParam === 'true' || urlParam === '1') {
				isWritingMode = true;
			} else {
				const savedWriting = localStorage.getItem('rf_flashcard_writing');
				if (savedWriting !== null) {
					isWritingMode = savedWriting === 'true';
				}
			}

			if (urlMode === 'foto' || urlMode === 'inverso' || urlMode === 'standard') {
				subMode = urlMode;
			}
		}

		const unsubCards = cardsStore.subscribe((c) => {
			rawCards = c;
			refreshCards();
		});

		const unsubIgnored = ignoredCardsStore.subscribe((ids) => {
			ignoredIds = ids;
			refreshCards();
		});

		const unsubCategory = globalCategoryStore.subscribe((cat) => {
			if (selectedCategory !== cat) {
				selectedCategory = cat;
				refreshCards();
			}
		});

		return () => {
			unsubCards();
			unsubIgnored();
			unsubCategory();
		};
	});

	function toggleWritingMode() {
		isWritingMode = !isWritingMode;
		if (browser) {
			localStorage.setItem('rf_flashcard_writing', String(isWritingMode));
		}
	}

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
	}

	$effect(() => {
		const _cat = selectedCategory;
		const _mode = subMode;
		const _write = isWritingMode;
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
		subtitle="Gira le card o digita le risposte per allenare la memoria visiva e motoria."
		icon="/emoji/open_book_3d.png"
		variant="green"
	/>

	<!-- Unified Category Filter & Rimescola Bar -->
	<CategoryFilter
		categories={availableCategories}
		{selectedCategory}
		onSelect={(cat) => (selectedCategory = cat)}
		onRefresh={refreshCards}
	/>

	<!-- Duolingo Progress Track -->
	{#if activeCards.length > 0}
		<div class="duo-progress-track">
			<div
				class="duo-progress-fill"
				style="width: {((currentIndex + 1) / activeCards.length) * 100}%"
			></div>
		</div>
	{/if}

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

	<!-- ✍️ Opzione Modalità Scrittura Toggle -->
	<div class="options-bar">
		<button
			type="button"
			class="duo-btn writing-mode-toggle"
			class:active-writing={isWritingMode}
			onclick={toggleWritingMode}
			aria-pressed={isWritingMode}
		>
			<span class="toggle-icon">{isWritingMode ? '✍️' : '🗣️'}</span>
			<span class="toggle-text">
				Esercizio di Scrittura: <strong>{isWritingMode ? 'ATTIVO (Digitazione)' : 'DISATTIVATO (Gira Card)'}</strong>
			</span>
			<span class="toggle-pill" class:pill-on={isWritingMode}>
				{isWritingMode ? 'ON' : 'OFF'}
			</span>
		</button>
	</div>

	<!-- Main Exercise / FlashCard Display -->
	{#if isWritingMode}
		<!-- Modalità Scrittura (Digitazione Risposta) -->
		{#if subMode === 'standard'}
			{#if activeCards.length > 0}
				<FreeWriteExercise
					card={activeCards[currentIndex]}
					subMode="title-to-desc"
					{currentIndex}
					totalCards={activeCards.length}
					onNext={handleNext}
				/>
			{:else}
				<div class="duo-card empty-box">Nessuna scheda di ripasso trovata per questa categoria.</div>
			{/if}
		{:else if subMode === 'foto'}
			{#if photoCards.length > 0}
				<FreeWriteExercise
					card={photoCards[currentIndex]}
					subMode="photo-to-title"
					{currentIndex}
					totalCards={photoCards.length}
					onNext={handleNext}
				/>
			{:else}
				<div class="duo-card empty-box">
					<h2>📷 Nessuna scheda con immagine trovata</h2>
					<p>Aggiungi immagini alle schede dal pannello admin per sbloccare questa modalità.</p>
				</div>
			{/if}
		{:else if subMode === 'inverso'}
			{#if activeCards.length > 0}
				<FreeWriteExercise
					card={activeCards[currentIndex]}
					subMode="desc-to-title"
					{currentIndex}
					totalCards={activeCards.length}
					onNext={handleNext}
				/>
			{:else}
				<div class="duo-card empty-box">Nessuna scheda trovata per la categoria selezionata.</div>
			{/if}
		{/if}
	{:else}
		<!-- Modalità Tradizionale FlashCard (3D Flip) -->
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

	.options-bar {
		display: flex;
		justify-content: center;
		width: 100%;
	}

	.writing-mode-toggle {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.65rem 1rem;
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		border-radius: 16px;
		color: var(--text-color);
		font-size: 0.88rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.writing-mode-toggle:hover {
		border-color: var(--accent-color);
		background: var(--card-bg-subtle);
	}

	.writing-mode-toggle.active-writing {
		background: rgba(168, 85, 247, 0.12);
		border-color: var(--purple-color);
		color: var(--text-color);
	}

	.toggle-icon {
		font-size: 1.15rem;
	}

	.toggle-text {
		flex: 1;
		text-align: left;
		margin: 0 0.75rem;
		font-size: 0.85rem;
	}

	.toggle-text strong {
		color: var(--accent-color);
	}

	.active-writing .toggle-text strong {
		color: var(--purple-color);
	}

	.toggle-pill {
		font-size: 0.75rem;
		font-weight: 900;
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
		background: var(--card-bg-subtle);
		color: var(--text-muted);
		border: 1px solid var(--border-color);
		transition: all 0.2s ease;
	}

	.toggle-pill.pill-on {
		background: var(--purple-color);
		color: #ffffff;
		border-color: var(--purple-color);
		box-shadow: 0 2px 8px rgba(168, 85, 247, 0.4);
	}

	.duo-progress-track {
		width: 100%;
		height: 10px;
		background: var(--card-bg-subtle);
		border-radius: 9999px;
		overflow: hidden;
		border: 1.5px solid var(--border-color);
	}

	.duo-progress-fill {
		height: 100%;
		background: var(--green-color);
		border-radius: 9999px;
		transition: width 0.3s ease;
	}

	.empty-box {
		text-align: center;
		padding: 3rem 1.5rem;
		color: var(--text-muted);
		border-radius: 20px;
	}
</style>
