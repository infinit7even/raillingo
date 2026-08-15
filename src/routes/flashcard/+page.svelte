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

	function setWritingMode(val: boolean) {
		isWritingMode = val;
		if (browser) {
			localStorage.setItem('rf_flashcard_writing', String(isWritingMode));
		}
	}

	function toggleWritingMode() {
		setWritingMode(!isWritingMode);
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

	<!-- 🎛️ Unified Bar: SubModes (TESTUALE, VISIVO, INVERSO) + Method Switch (🃏 Gira vs ✍️ Scrivi) -->
	<div class="flashcard-nav-bar duo-card">
		<div class="submode-tabs-group">
			{#each flashcardTabs as tab}
				{@const isActive = subMode === tab.id}
				<button
					type="button"
					class="submode-tab-btn"
					class:active={isActive}
					onclick={() => {
						subMode = tab.id as 'standard' | 'foto' | 'inverso';
						currentIndex = 0;
						refreshCards();
					}}
				>
					<img src={tab.emoji} alt="" class="tab-emoji-mini" />
					<span class="tab-lbl-text">{tab.label}</span>
				</button>
			{/each}
		</div>

		<div class="bar-divider"></div>

		<div class="method-toggle-inline">
			<button
				type="button"
				class="method-btn-mini"
				class:active={!isWritingMode}
				onclick={() => setWritingMode(false)}
				title="Modalità Gira Card (3D Flip)"
			>
				<span>🃏</span>
				<span class="method-label">Gira</span>
			</button>
			<button
				type="button"
				class="method-btn-mini"
				class:active={isWritingMode}
				class:writing-active={isWritingMode}
				onclick={() => setWritingMode(true)}
				title="Modalità Digitazione/Scrittura"
			>
				<span>✍️</span>
				<span class="method-label">Scrivi</span>
			</button>
		</div>
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

	/* 🎛️ Unified Flashcard Navigation Bar */
	.flashcard-nav-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
		padding: 0.35rem 0.45rem;
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		border-bottom: 4px solid var(--border-depth-color);
		border-radius: 18px;
		width: 100%;
		box-sizing: border-box;
	}

	.submode-tabs-group {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex: 1;
		min-width: 0;
	}

	.submode-tab-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.55rem 0.4rem;
		border-radius: 12px;
		border: 1.5px solid transparent;
		background: transparent;
		color: var(--text-muted);
		font-family: 'Outfit', sans-serif;
		font-weight: 800;
		font-size: 0.72rem;
		letter-spacing: 0.02em;
		cursor: pointer;
		user-select: none;
		transition: all 0.15s ease;
		min-width: 0;
	}

	.submode-tab-btn:hover {
		color: var(--text-color);
	}

	.submode-tab-btn.active {
		background: var(--card-bg-subtle);
		color: var(--accent-color);
		border-color: var(--accent-color);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
	}

	.tab-emoji-mini {
		width: 18px;
		height: 18px;
		object-fit: contain;
		flex-shrink: 0;
	}

	.bar-divider {
		width: 1.5px;
		height: 24px;
		background: var(--border-color);
		flex-shrink: 0;
		margin: 0 0.15rem;
	}

	.method-toggle-inline {
		display: flex;
		align-items: center;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 12px;
		padding: 2px;
		gap: 2px;
		flex-shrink: 0;
	}

	.method-btn-mini {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.35rem 0.55rem;
		border-radius: 10px;
		border: none;
		background: transparent;
		color: var(--text-muted);
		font-size: 0.72rem;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.15s ease;
		user-select: none;
	}

	.method-btn-mini:hover {
		color: var(--text-color);
	}

	.method-btn-mini.active {
		background: var(--green-color);
		color: #ffffff;
		box-shadow: 0 2px 6px rgba(34, 197, 94, 0.3);
	}

	.method-btn-mini.active.writing-active {
		background: var(--purple-color);
		box-shadow: 0 2px 6px rgba(168, 85, 247, 0.3);
	}

	@media (max-width: 480px) {
		.tab-lbl-text {
			font-size: 0.65rem;
		}

		.method-label {
			display: none;
		}

		.method-btn-mini {
			padding: 0.35rem 0.45rem;
			font-size: 0.85rem;
		}

		.submode-tab-btn {
			padding: 0.5rem 0.25rem;
		}
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
