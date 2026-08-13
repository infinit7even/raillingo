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
		// When validCards change or selectedCategory change, re-shuffle deck
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
	<div class="top-controls-row">
		<ModeTabs
			tabs={flashcardTabs}
			activeTab={subMode}
			onSelect={(id) => {
				subMode = id as 'standard' | 'foto' | 'inverso';
				currentIndex = 0;
				refreshCards();
			}}
		/>

		<!-- Refresh / Rimescola Button -->
		<button
			class="duo-btn duo-btn-purple refresh-btn"
			onclick={refreshCards}
			title="Rimescola tutte le card"
		>
			🔄 Rimescola
		</button>
	</div>

	<!-- Category Filter -->
	<CategoryFilter
		categories={availableCategories}
		{selectedCategory}
		onSelect={(cat) => (selectedCategory = cat)}
	/>

	{#if subMode === 'standard'}
		{#if activeCards.length > 0}
			<FlashCard
				card={activeCards[currentIndex]}
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
			<PhotoStudy
				card={photoCards[currentIndex]}
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
			{@const currentCard = activeCards[currentIndex]}
			{@const isCurrentIgnored = ignoredCardsStore.isIgnored(currentCard.id)}

			<div class="reverse-container duo-card">
				<div class="top-bar">
					<span class="duo-badge">Modalità Inversa</span>
					<div class="top-actions">
						<span class="counter">{currentIndex + 1} / {activeCards.length}</span>
						<button
							class="star-ignored-btn"
							class:ignored={isCurrentIgnored}
							onclick={toggleIgnoredCurrentCard}
							title="Ignora card"
						>
							★
						</button>
					</div>
				</div>

				<div
					class="study-box duo-card"
					onclick={toggleReveal}
					role="button"
					tabindex="0"
					onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleReveal()}
				>
					<span class="label">Come si chiama:</span>
					<p class="description-text">{currentCard.description}</p>

					{#if !revealed}
						<div class="prompt-box">
							<span>🗣️ Di' a voce l'acronimo/titolo, poi <strong>tocca per verificare</strong></span>
						</div>
					{:else}
						<div class="reveal-box">
							<span class="reveal-label">Acronimo / Titolo:</span>
							<h2 class="revealed-title">{currentCard.title}</h2>
							{#if currentCard.fullName}
								<p class="revealed-fullname">{currentCard.fullName}</p>
							{/if}
						</div>
					{/if}
				</div>

				<div class="controls">
					<button
						class="duo-btn duo-btn-gray nav-btn"
						onclick={handlePrev}
						disabled={currentIndex === 0}
					>
						← Indietro
					</button>
					<button class="duo-btn duo-btn-green action-btn" onclick={toggleReveal}>
						{revealed ? 'Nascondi' : 'Mostra Acronimo & Titolo'}
					</button>
					<button
						class="duo-btn duo-btn-blue nav-btn"
						onclick={handleNext}
						disabled={currentIndex === activeCards.length - 1}
					>
						Avanti →
					</button>
				</div>
			</div>
		{:else}
			<div class="duo-card empty-box">Nessuna scheda trovata per questa categoria.</div>
		{/if}
	{/if}
</div>

<style>
	.ripasso-page-container {
		max-width: 600px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.top-controls-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.refresh-btn {
		font-size: 0.8rem;
		padding: 0.55rem 0.85rem;
		white-space: nowrap;
	}

	.reverse-container {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.top-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.top-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.counter {
		font-size: 0.85rem;
		font-weight: 800;
		color: var(--text-muted);
	}

	.star-ignored-btn {
		background: none;
		border: none;
		font-size: 1.6rem;
		color: var(--text-muted);
		cursor: pointer;
		line-height: 1;
		padding: 0;
		transition: transform 0.2s ease, color 0.2s ease;
	}

	.star-ignored-btn.ignored {
		color: var(--yellow-color);
		transform: scale(1.25);
	}

	.study-box {
		background: var(--card-bg-subtle);
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		cursor: pointer;
		min-height: 260px;
		justify-content: space-between;
	}

	.label {
		font-size: 0.75rem;
		font-weight: 900;
		text-transform: uppercase;
		color: var(--accent-color);
	}

	.description-text {
		font-size: 1.1rem;
		line-height: 1.6;
		color: var(--text-color);
		margin: 0;
	}

	.prompt-box {
		background: var(--card-bg);
		border: 1.5px dashed var(--accent-color);
		padding: 0.85rem;
		border-radius: 14px;
		text-align: center;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.reveal-box {
		background: var(--card-bg);
		border: 2px solid var(--accent-color);
		padding: 1rem;
		border-radius: 14px;
		text-align: center;
	}

	.reveal-label {
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		color: var(--accent-color);
		display: block;
	}

	.revealed-title {
		font-size: 2.2rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0.25rem 0 0 0;
	}

	.revealed-fullname {
		font-size: 1rem;
		font-weight: 800;
		color: var(--green-color);
		margin: 0.25rem 0 0 0;
	}

	.controls {
		display: flex;
		gap: 0.65rem;
	}

	.nav-btn {
		font-size: 0.85rem;
	}

	.action-btn {
		flex: 1;
		font-size: 0.9rem;
	}

	.empty-box {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
	}
</style>
