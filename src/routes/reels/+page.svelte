<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { ignoredCardsStore } from '$lib/stores/ignoredCardsStore';
	import { statsStore } from '$lib/stores/statsStore';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import CategoryFilter from '$lib/components/CategoryFilter.svelte';
	import type { Card } from '$lib/types/cards';
	import { globalCategoryStore } from '$lib/stores/globalCategoryStore';

	let rawCards = $state<Card[]>([]);
	let ignoredIds = $state<Set<string>>(new Set());
	let selectedCategory = $state('ALL');
	let flippedMap = $state<Record<string, boolean>>({});
	let imageIndexMap = $state<Record<string, number>>({});

	onMount(() => {
		const unsubCards = cardsStore.subscribe((c) => (rawCards = c));
		const unsubIgnored = ignoredCardsStore.subscribe((ids) => (ignoredIds = ids));
		const unsubCategory = globalCategoryStore.subscribe((cat) => (selectedCategory = cat));
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

	// Solo card CON immagini e NON ignorate
	let reelCards = $derived(
		rawCards.filter((c) => {
			const hasImg = c.images && c.images.length > 0;
			const notIgnored = !ignoredIds.has(c.id);
			const matchesCategory =
				selectedCategory === 'ALL' || (c.category && c.category.trim() === selectedCategory);
			return hasImg && notIgnored && matchesCategory;
		})
	);

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
		variant="orange"
	/>

	<!-- Category Filter -->
	<CategoryFilter
		categories={availableCategories}
		{selectedCategory}
		onSelect={(cat) => (selectedCategory = cat)}
	/>

	<!-- Reels Snap Feed -->
	{#if reelCards.length > 0}
		<div class="reels-viewport duo-card">
			<div class="reels-scroll-feed">
				{#each reelCards as card (card.id)}
					{@const isFlipped = flippedMap[card.id] || false}
					{@const imgIdx = imageIndexMap[card.id] || 0}
					{@const isIgnoredCard = ignoredIds.has(card.id)}

					<div class="reel-card-slide">
						<!-- Top Action Bar -->
						<div class="reel-header-bar">
							{#if card.category}
								<span class="reel-category-tag">📁 {card.category}</span>
							{/if}

							<button
								class="star-ignored-btn"
								class:ignored={isIgnoredCard}
								onclick={(e) => toggleIgnored(e, card.id)}
								title={isIgnoredCard ? 'Card ignorata' : 'Ignora card durante il mescolaggio'}
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
								<!-- FRONT FACE (Visual Image + Ambient Blur + Text Overlay) -->
								<div class="face front-face">
									<!-- Ambient blurred background -->
									<img
										src={card.images![imgIdx]}
										alt=""
										class="reel-ambient-bg"
										aria-hidden="true"
									/>

									<!-- Main Image Frame -->
									<div class="reel-img-container">
										<img
											src={card.images![imgIdx]}
											alt={card.title || 'Foto reel'}
											class="front-bg-img"
											loading="lazy"
											decoding="async"
										/>
									</div>

									<div class="front-img-overlay"></div>

									<!-- Multi-photo Carousel Controls -->
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
									{/if}

									<!-- Title & Info Overlay -->
									<div class="front-body">
										{#if card.title}
											<h2 class="reel-title">{card.title}</h2>
										{/if}
										{#if card.fullName}
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
											{#if card.title}
												<h3 class="back-title">{card.title}</h3>
											{/if}
											{#if card.fullName}
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

						<div class="scroll-down-notice">
							<span>Scorri in verticale ⬇️</span>
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
		max-width: 620px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
		box-sizing: border-box;
	}

	.reels-viewport {
		padding: 0;
		overflow: hidden;
		border-radius: 24px;
		box-shadow: 0 12px 36px rgba(0, 0, 0, 0.25);
		background: var(--card-bg);
		border: 2px solid var(--border-color);
	}

	.reels-scroll-feed {
		width: 100%;
		height: calc(100vh - 210px);
		min-height: 340px;
		max-height: 580px;
		overflow-y: scroll;
		scroll-snap-type: y mandatory;
		scrollbar-width: none;
	}

	@media (max-width: 1023px) {
		.reels-clean-container {
			gap: 0.5rem;
		}

		.reels-viewport {
			border-radius: 20px;
		}

		.reels-scroll-feed {
			height: calc(100vh - 135px);
			max-height: none;
			min-height: 460px;
		}

		.reel-card-slide {
			padding: 0.75rem;
		}

		.reel-title {
			font-size: 2.3rem;
		}
	}

	.reels-scroll-feed::-webkit-scrollbar {
		display: none;
	}

	.reel-card-slide {
		width: 100%;
		height: 100%;
		scroll-snap-align: start;
		scroll-snap-stop: always;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 0.85rem;
		box-sizing: border-box;
		position: relative;
	}

	.reel-header-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		z-index: 10;
		gap: 0.5rem;
	}

	.reel-category-tag {
		font-size: 0.72rem;
		font-weight: 900;
		color: var(--accent-color);
		background: rgba(20, 20, 30, 0.75);
		backdrop-filter: blur(8px);
		border: 1px solid var(--border-color);
		border-radius: 10px;
		padding: 0.25rem 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.star-ignored-btn {
		background: none;
		border: none;
		font-size: 1.6rem;
		color: rgba(255, 255, 255, 0.65);
		cursor: pointer;
		line-height: 1;
		padding: 0;
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
		perspective: 1000px;
		cursor: pointer;
		margin: 0.4rem 0;
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
		border-radius: 20px;
		padding: 1.25rem;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		overflow: hidden;
	}

	/* FRONT FACE */
	.front-face {
		background: #080c14;
		border: 2px solid var(--border-color);
		text-align: center;
		position: relative;
	}

	.reel-ambient-bg {
		position: absolute;
		inset: -25px;
		width: calc(100% + 50px);
		height: calc(100% + 50px);
		object-fit: cover;
		filter: blur(32px) brightness(0.45);
		opacity: 0.85;
		z-index: 1;
	}

	.reel-img-container {
		position: absolute;
		inset: 0;
		bottom: 110px;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2;
		padding: 0.85rem;
		box-sizing: border-box;
	}

	.front-bg-img {
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
		display: block;
		border-radius: 14px;
		filter: drop-shadow(0 10px 28px rgba(0, 0, 0, 0.65));
	}

	.front-img-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to top,
			rgba(8, 12, 20, 0.96) 0%,
			rgba(8, 12, 20, 0.6) 35%,
			rgba(8, 12, 20, 0.1) 70%,
			rgba(8, 12, 20, 0.35) 100%
		);
		z-index: 3;
		pointer-events: none;
	}

	.reel-multi-photo-controls {
		position: absolute;
		top: 14px;
		right: 14px;
		z-index: 5;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		background: rgba(0, 0, 0, 0.65);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 20px;
		padding: 0.2rem 0.5rem;
		backdrop-filter: blur(8px);
	}

	.photo-nav-btn {
		background: transparent;
		border: none;
		color: #ffffff;
		font-size: 0.75rem;
		cursor: pointer;
		padding: 0.2rem 0.4rem;
		border-radius: 6px;
		transition: background 0.15s ease;
	}

	.photo-nav-btn:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.photo-counter-badge {
		font-size: 0.72rem;
		font-weight: 800;
		color: #ffffff;
		white-space: nowrap;
	}

	.front-body {
		position: absolute;
		bottom: 1rem;
		left: 1rem;
		right: 1rem;
		z-index: 4;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
	}

	.reel-title {
		font-size: 2.1rem;
		font-weight: 900;
		color: #ffffff;
		margin: 0;
		letter-spacing: -0.02em;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.85);
	}

	.reel-fullname-sub {
		font-size: 0.95rem;
		font-weight: 800;
		color: var(--green-color);
		margin: 0;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.85);
	}

	.tap-hint-pill {
		margin-top: 0.5rem;
		padding: 0.35rem 0.85rem;
		border-radius: 20px;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: #ffffff;
		font-size: 0.72rem;
		font-weight: 800;
	}

	/* BACK FACE */
	.back-face {
		background: var(--card-bg-subtle);
		border: 2px solid var(--accent-color);
		transform: rotateY(180deg);
		align-items: stretch;
		justify-content: space-between;
	}

	.back-body {
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.back-top {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.35rem;
	}

	.back-title {
		font-size: 1.75rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
		line-height: 1.15;
	}

	.back-fullname-badge {
		font-size: 0.95rem;
		font-weight: 800;
		color: var(--green-color);
	}

	.back-desc-container {
		flex: 1;
		overflow-y: auto;
		padding: 1.1rem;
		border-radius: 16px;
		box-sizing: border-box;
		margin: 0.25rem 0;
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
	}

	.back-desc-text {
		font-size: 1.05rem;
		line-height: 1.65;
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
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--accent-color);
		background: var(--accent-light-bg);
		border-radius: 6px;
		padding: 0.15rem 0.45rem;
	}

	.back-hint {
		align-self: center;
		margin-top: 0;
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		color: var(--text-muted);
	}

	.scroll-down-notice {
		text-align: center;
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--text-muted);
		opacity: 0.8;
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
</style>
