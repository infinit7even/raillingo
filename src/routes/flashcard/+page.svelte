<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import FlashCard from '$lib/components/FlashCard.svelte';
	import PhotoStudy from '$lib/components/PhotoStudy.svelte';
	import { statsStore } from '$lib/stores/statsStore';
	import type { Card } from '$lib/types/cards';

	import CategoryFilterBar from '$lib/components/CategoryFilterBar.svelte';

	let cards = $state<Card[]>([]);
	let selectedCategory = $state<string>('ALL');
	let subMode = $state<'standard' | 'foto' | 'inverso'>('standard');
	let currentIndex = $state(0);
	let revealed = $state(false);

	onMount(() => {
		const unsubscribe = cardsStore.subscribe((c) => (cards = c));
		return unsubscribe;
	});

	$effect(() => {
		// Reset state on card or mode change
		revealed = false;
	});

	let filteredCards = $derived.by<Card[]>(() => {
		if (selectedCategory === 'ALL') return cards;
		return cards.filter(
			(c) =>
				c.category === selectedCategory ||
				(c.categories && c.categories.includes(selectedCategory))
		);
	});

	let photoCards = $derived(filteredCards.filter((c) => c.images && c.images.length > 0));
	let activeCards = $derived(subMode === 'foto' ? photoCards : filteredCards);

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
	import ModeTabs from '$lib/components/ModeTabs.svelte';

	const flashcardTabs = [
		{ id: 'standard', label: 'FLASHCARD', emoji: '/emoji/open_book_3d.png' },
		{ id: 'foto', label: 'RIPASSO FOTO', emoji: '/emoji/camera_3d.png' },
		{ id: 'inverso', label: 'INVERSO', emoji: '/emoji/counterclockwise_arrows_button_3d.png' }
	];
</script>

<div class="ripasso-page-container">
	<!-- Category Filter Bar -->
	<CategoryFilterBar
		selectedCategory={selectedCategory}
		onSelectCategory={(cat) => {
			selectedCategory = cat;
			currentIndex = 0;
		}}
	/>

	<!-- Sub-mode Selector Bar -->
	<ModeTabs
		tabs={flashcardTabs}
		activeTab={subMode}
		onSelect={(id) => {
			subMode = id as 'standard' | 'foto' | 'inverso';
			currentIndex = 0;
		}}
	/>

	{#if subMode === 'standard'}
		{#if activeCards.length > 0}
			<FlashCard
				card={activeCards[currentIndex]}
				currentIndex={currentIndex}
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
				currentIndex={currentIndex}
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
			<div class="reverse-container duo-card">
				<div class="top-bar">
					<span class="duo-badge">Inverso</span>
					<span class="counter">{currentIndex + 1} / {activeCards.length}</span>
				</div>

				<div
					class="study-box duo-card"
					onclick={toggleReveal}
					role="button"
					tabindex="0"
					onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleReveal()}
				>
					<span class="label">Descrizione / A cosa serve:</span>
					<p class="description-text">{currentCard.description}</p>

					{#if !revealed}
						<div class="prompt-box">
							<span>🗣️ Di' a voce l'acronimo, poi <strong>tocca per verificare</strong></span>
						</div>
					{:else}
						<div class="reveal-box">
							<span class="reveal-label">Acronimo / Titolo:</span>
							<h2 class="revealed-title">{currentCard.title}</h2>
						</div>
					{/if}
				</div>

				<div class="controls">
					<button class="duo-btn duo-btn-gray nav-btn" onclick={handlePrev} disabled={currentIndex === 0}>
						← Indietro
					</button>
					<button class="duo-btn duo-btn-green action-btn" onclick={toggleReveal}>
						{revealed ? 'Nascondi' : 'Mostra Acronimo'}
					</button>
					<button class="duo-btn duo-btn-blue nav-btn" onclick={handleNext} disabled={currentIndex === activeCards.length - 1}>
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
		gap: 1.25rem;
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

	.counter {
		font-size: 0.85rem;
		font-weight: 800;
		color: var(--text-muted);
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
