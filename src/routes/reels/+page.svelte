<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { ignoredCardsStore } from '$lib/stores/ignoredCardsStore';
	import { statsStore } from '$lib/stores/statsStore';
	import { globalCategoryStore, matchesCategory } from '$lib/stores/globalCategoryStore';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import CategoryFilter from '$lib/components/CategoryFilter.svelte';
	import type { Card } from '$lib/types/cards';

	let rawCards = $state<Card[]>([]);
	let ignoredIds = $state<Set<string>>(new Set());
	let selectedCategory = $state('ALL');
	let flippedMap = $state<Record<string, boolean>>({});
	let imageIndexMap = $state<Record<string, number>>({});
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
			refreshReels();
		});
		const unsubIgnored = ignoredCardsStore.subscribe((ids) => {
			ignoredIds = ids;
			refreshReels();
		});
		const unsubCategory = globalCategoryStore.subscribe((cat) => {
			if (selectedCategory !== cat) {
				selectedCategory = cat;
				refreshReels();
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
			if (c.images && c.images.length > 0 && c.category && c.category.trim()) {
				set.add(c.category.trim());
			}
		}
		return Array.from(set).sort();
	});

	// Tutte le card valide CON immagini e NON ignorate
	let validReelCards = $derived(
		rawCards.filter((c) => {
			const hasImg = c.images && c.images.length > 0;
			const notIgnored = !ignoredIds.has(c.id);
			const matchesCat = matchesCategory(c.category, selectedCategory);
			return hasImg && notIgnored && matchesCat;
		})
	);

	function refreshReels() {
		shuffledDeck = shuffleArray(validReelCards);
		flippedMap = {};
		imageIndexMap = {};
	}

	$effect(() => {
		const _cat = selectedCategory;
		const _cards = validReelCards;
		if (shuffledDeck.length === 0 && _cards.length > 0) {
			refreshReels();
		}
	});

	function toggleFlip(cardId: string) {
		flippedMap[cardId] = !flippedMap[cardId];
		if (flippedMap[cardId]) {
			statsStore.recordStudySession();
		}
	}

	async function toggleIgnored(e: MouseEvent, cardId: string) {
		e.stopPropagation();
		await ignoredCardsStore.toggleIgnored(cardId);
	}

	function nextImage(e: MouseEvent, card: Card) {
		e.stopPropagation();
		if (card.images && card.images.length > 0) {
			const curr = imageIndexMap[card.id] || 0;
			imageIndexMap[card.id] = (curr + 1) % card.images.length;
		}
	}

	function prevImage(e: MouseEvent, card: Card) {
		e.stopPropagation();
		if (card.images && card.images.length > 0) {
			const curr = imageIndexMap[card.id] || 0;
			imageIndexMap[card.id] = (curr - 1 + card.images.length) % card.images.length;
		}
	}
</script>

<div class="reels-clean-container">
	<!-- Page Header -->
	<PageHeader
		title="Reels Ferroviari"
		subtitle="Scorri le schede visive ed esplora foto e descrizioni in un feed dinamico."
		icon="/emoji/camera_3d.png"
		variant="purple"
		mobileOpenNav={true}
	/>

	<!-- Category Filter (Senza tasto rimescola) -->
	<CategoryFilter
		categories={availableCategories}
		{selectedCategory}
		onSelect={(cat) => {
			selectedCategory = cat;
			refreshReels();
		}}
	/>

	<!-- Reels Snap Feed Instagram-Style -->
	{#if shuffledDeck.length > 0}
		<div class="reels-viewport duo-card">
			<div class="reels-scroll-feed">
				{#each shuffledDeck as card (card.id)}
					{@const isFlipped = flippedMap[card.id] || false}
					{@const imgIdx = imageIndexMap[card.id] || 0}
					{@const isIgnoredCard = ignoredIds.has(card.id)}
					{@const displayTitle = card.title?.trim() || card.fullName?.trim() || ''}
					{@const hasDistinctFullName = Boolean(
						card.fullName &&
							card.title &&
							card.fullName.trim().toLowerCase() !== card.title.trim().toLowerCase()
					)}

					<div class="reel-card-slide">
						<!-- Top Action Bar -->
						<div class="reel-header-bar">
							{#if card.images!.length > 1}
								<div class="reel-multi-photo-controls">
									<button
										class="photo-nav-btn prev-btn"
										onclick={(e) => prevImage(e, card)}
										title="Foto precedente"
									>
										◀
									</button>
									<span class="photo-counter-badge">
										📷 {imgIdx + 1} / {card.images!.length}
									</span>
									<button
										class="photo-nav-btn next-btn"
										onclick={(e) => nextImage(e, card)}
										title="Foto successiva"
									>
										▶
									</button>
								</div>
							{:else}
								<div></div>
							{/if}

							<button
								class="star-ignored-btn"
								class:ignored={isIgnoredCard}
								onclick={(e) => toggleIgnored(e, card.id)}
								title={isIgnoredCard ? 'Card ignorata' : 'Ignora card durante il ripasso'}
							>
								★
							</button>
						</div>

						<!-- 3D Flip Card Container -->
						<div
							class="flip-scene"
							onclick={() => toggleFlip(card.id)}
							role="button"
							tabindex="0"
							onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleFlip(card.id)}
						>
							<div class="flip-card-inner" class:is-flipped={isFlipped}>
								<!-- FRONT FACE (Visual Picture + Ambient Blurred Background + Overlay Badge) -->
								<div class="face front-face">
									<!-- Ambient blurred background -->
									<img
										src={card.images![imgIdx]}
										alt=""
										class="reel-ambient-bg"
										aria-hidden="true"
									/>

									<!-- Main Visual Image -->
									<div class="reel-img-wrapper">
										<img
											src={card.images![imgIdx]}
											alt={displayTitle || 'Foto reel'}
											class="front-main-img"
											loading="lazy"
											decoding="async"
										/>
									</div>

									<!-- Bottom Title Badge Overlay -->
									<div class="front-bottom-badge">
										{#if displayTitle}
											<h2 class="reel-title">{displayTitle}</h2>
										{/if}

										{#if hasDistinctFullName}
											<p class="reel-fullname-sub">{card.fullName}</p>
										{/if}

										<div class="tap-hint-pill">
											<span>👇 Tocca per girare la scheda e leggere i dettagli</span>
										</div>
									</div>
								</div>

								<!-- BACK FACE (Full Description & Details) -->
								<div class="face back-face">
									<div class="back-body">
										<div class="back-top">
											{#if displayTitle}
												<h3 class="back-title">{displayTitle}</h3>
											{/if}
											{#if hasDistinctFullName}
												<span class="back-fullname-badge">{card.fullName}</span>
											{/if}
										</div>

										<div class="back-desc-container duo-card">
											<p class="back-desc-text">{card.description}</p>
										</div>

										{#if card.tags && card.tags.length > 0}
											<div class="back-tags-row">
												{#each card.tags as tag}
													<span class="reel-tag-pill">#{tag}</span>
												{/each}
											</div>
										{/if}

										<div class="tap-hint-pill back-hint">
											<span>🔄 Tocca per tornare alla foto</span>
										</div>
									</div>
								</div>
							</div>
						</div>

					</div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="duo-card empty-reels-box">
			<span class="empty-emoji">📷</span>
			<h3>Nessun Reel trovato per questa categoria</h3>
			<p>Aggiungi nuove schede con immagini o cambia il filtro di categoria.</p>
		</div>
	{/if}
</div>

<style>
	.reels-clean-container {
		width: 100%;
		max-width: 600px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		box-sizing: border-box;
	}

	.reels-viewport {
		padding: 0;
		overflow: hidden;
		border-radius: 24px;
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		width: 100%;
		box-sizing: border-box;
	}

	.reels-scroll-feed {
		width: 100%;
		height: clamp(460px, 68vh, 620px);
		overflow-y: scroll;
		scroll-snap-type: y mandatory;
		scroll-behavior: smooth;
		scrollbar-width: none;
	}

	.reels-scroll-feed::-webkit-scrollbar {
		display: none;
	}

	.reel-card-slide {
		width: 100%;
		height: 100%;
		flex-shrink: 0;
		scroll-snap-align: start;
		scroll-snap-stop: always;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 0.75rem 0.85rem;
		box-sizing: border-box;
		position: relative;
		overflow: hidden;
		content-visibility: auto;
		contain-intrinsic-size: 500px;
	}

	.reel-header-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		z-index: 10;
		height: 32px;
		flex-shrink: 0;
	}

	.star-ignored-btn {
		background: none;
		border: none;
		font-size: 1.6rem;
		color: rgba(255, 255, 255, 0.65);
		cursor: pointer;
		line-height: 1;
		padding: 0.25rem;
		transition: transform 0.2s ease, color 0.2s ease;
	}

	.star-ignored-btn.ignored {
		color: var(--yellow-color);
		transform: scale(1.25);
		filter: drop-shadow(0 0 8px rgba(250, 204, 21, 0.6));
	}

	/* 3D FLIP CARD */
	.flip-scene {
		flex: 1;
		width: 100%;
		min-height: 0;
		perspective: 1200px;
		cursor: pointer;
		margin: 0.25rem 0;
	}

	.flip-card-inner {
		width: 100%;
		height: 100%;
		position: relative;
		transform-style: preserve-3d;
		transition: transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
		border-radius: 20px;
	}

	.flip-card-inner.is-flipped {
		transform: rotateY(180deg);
	}

	.face {
		position: absolute;
		inset: 0;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		border-radius: 20px;
		padding: 0.75rem;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* FRONT FACE */
	.front-face {
		background: #080c14;
		border: 2px solid var(--border-color);
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem;
	}

	.reel-ambient-bg {
		position: absolute;
		inset: -20px;
		width: calc(100% + 40px);
		height: calc(100% + 40px);
		object-fit: cover;
		filter: blur(28px) brightness(0.4);
		opacity: 0.8;
		z-index: 1;
	}

	.reel-img-wrapper {
		position: relative;
		z-index: 2;
		flex: 1;
		min-height: 0;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		border-radius: 14px;
		padding: 0.35rem;
		box-sizing: border-box;
	}

	.front-main-img {
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
		display: block;
		border-radius: 12px;
		filter: drop-shadow(0 6px 20px rgba(0, 0, 0, 0.7));
	}

	.front-bottom-badge {
		position: relative;
		z-index: 4;
		width: 100%;
		background: rgba(10, 15, 25, 0.85);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1.5px solid rgba(255, 255, 255, 0.15);
		border-radius: 16px;
		padding: 0.65rem 0.85rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		text-align: center;
		box-sizing: border-box;
		flex-shrink: 0;
		margin-top: 0.4rem;
	}

	.reel-title {
		font-size: 1.35rem;
		font-weight: 900;
		color: #ffffff;
		margin: 0;
		line-height: 1.25;
		letter-spacing: -0.01em;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
	}

	.reel-fullname-sub {
		font-size: 0.82rem;
		font-weight: 800;
		color: var(--green-color);
		margin: 0;
		line-height: 1.2;
		display: -webkit-box;
		-webkit-line-clamp: 1;
		line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.tap-hint-pill {
		margin-top: 0.25rem;
		padding: 0.2rem 0.65rem;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.9);
		font-size: 0.68rem;
		font-weight: 800;
	}

	.reel-multi-photo-controls {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		background: rgba(0, 0, 0, 0.65);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 14px;
		padding: 0.15rem 0.45rem;
		backdrop-filter: blur(8px);
	}

	.photo-nav-btn {
		background: transparent;
		border: none;
		color: #ffffff;
		font-size: 0.72rem;
		cursor: pointer;
		padding: 0.15rem 0.35rem;
		border-radius: 4px;
		transition: background 0.15s ease;
	}

	.photo-nav-btn:hover {
		background: rgba(255, 255, 255, 0.25);
	}

	.photo-counter-badge {
		font-size: 0.7rem;
		font-weight: 800;
		color: #ffffff;
		white-space: nowrap;
	}

	/* BACK FACE */
	.back-face {
		background: var(--card-bg-subtle);
		border: 2px solid var(--accent-color);
		transform: rotateY(180deg);
		padding: 1.25rem 1rem;
		box-sizing: border-box;
	}

	.back-body {
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.65rem;
	}

	.back-top {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.25rem;
	}

	.back-title {
		font-size: 1.5rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
		line-height: 1.2;
	}

	.back-fullname-badge {
		font-size: 0.88rem;
		font-weight: 800;
		color: var(--green-color);
	}

	.back-desc-container {
		flex: 1;
		overflow-y: auto;
		padding: 0.85rem;
		border-radius: 14px;
		box-sizing: border-box;
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
	}

	.back-desc-text {
		font-size: 0.95rem;
		line-height: 1.55;
		color: var(--text-color);
		margin: 0;
		font-weight: 600;
		white-space: pre-line;
	}

	.back-tags-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.reel-tag-pill {
		font-size: 0.68rem;
		font-weight: 800;
		color: var(--accent-color);
		background: var(--accent-light-bg);
		border-radius: 6px;
		padding: 0.15rem 0.4rem;
	}

	.back-hint {
		align-self: center;
		margin-top: 0;
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		color: var(--text-muted);
	}

	.empty-reels-box {
		text-align: center;
		padding: 2.5rem 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
	}

	.empty-emoji {
		font-size: 2.5rem;
	}

	@media (max-width: 600px) {
		.reel-title {
			font-size: 1.2rem;
		}

		.reel-card-slide {
			padding: 0.6rem;
		}
	}
</style>
