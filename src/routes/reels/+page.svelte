<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { ignoredCardsStore } from '$lib/stores/ignoredCardsStore';
	import { statsStore } from '$lib/stores/statsStore';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import CategoryFilter from '$lib/components/CategoryFilter.svelte';
	import type { Card } from '$lib/types/cards';

	let rawCards = $state<Card[]>([]);
	let ignoredIds = $state<Set<string>>(new Set());
	let selectedCategory = $state('ALL');
	let flippedMap = $state<Record<string, boolean>>({});
	let imageIndexMap = $state<Record<string, number>>({});

	onMount(() => {
		const unsubCards = cardsStore.subscribe((c) => (rawCards = c));
		const unsubIgnored = ignoredCardsStore.subscribe((ids) => (ignoredIds = ids));
		return () => {
			unsubCards();
			unsubIgnored();
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

	// Only cards WITH images and NOT ignored
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
</script>

<div class="reels-clean-container">
	<!-- Standard Page Header -->
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
								<span class="category-badge">{card.category}</span>
							{:else}
								<div></div>
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
								<!-- FRONT FACE (Visual Image + Text Overlay: Acronimo + Titolo/Descrizione breve) -->
								<div class="face front-face">
									<img src={card.images![imgIdx]} alt={card.title} class="front-bg-img" />
									<div class="front-img-overlay"></div>

									<div class="front-body">
										<h2 class="reel-title">{card.title}</h2>
										{#if card.fullName}
											<p class="reel-fullname-sub">{card.fullName}</p>
										{/if}

										<div class="tap-hint-pill">
											<span>👇 Tocca la foto per leggere la descrizione</span>
										</div>
									</div>
								</div>

								<!-- BACK FACE (Full Description Revealed) -->
								<div class="face back-face">
									<div class="back-body">
										<div class="back-top">
											<h3 class="back-title">{card.title}</h3>
											{#if card.fullName}
												<span class="back-fullname-badge">{card.fullName}</span>
											{/if}
										</div>

										<div class="back-desc-container">
											<p class="back-desc-text">{card.description}</p>
										</div>

										<div class="back-media-box">
											<img src={card.images![imgIdx]} alt={card.title} class="back-preview-img" />
											{#if card.images!.length > 1}
												<button class="next-photo-btn" onclick={(e) => nextImage(e, card)}>
													Foto successiva ({imgIdx + 1}/{card.images!.length})
												</button>
											{/if}
										</div>

										<div class="tap-hint-pill back-hint">
											<span>Tocca per rigirare la scheda</span>
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
		max-width: 600px;
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
		border-radius: 20px;
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
		background: var(--card-bg);
		border: 2px solid var(--border-color);
	}

	.reels-scroll-feed {
		width: 100%;
		height: calc(100vh - 210px);
		min-height: 320px;
		max-height: 560px;
		overflow-y: scroll;
		scroll-snap-type: y mandatory;
		scrollbar-width: none;
	}

	@media (max-width: 1023px) {
		.reels-clean-container {
			gap: 0.5rem;
		}

		.reels-viewport {
			border-radius: 16px;
		}

		.reels-scroll-feed {
			height: calc(100vh - 135px);
			max-height: none;
			min-height: 440px;
		}

		.reel-card-slide {
			padding: 0.75rem;
		}

		.reel-title {
			font-size: 2.5rem;
		}

		.back-preview-img {
			max-height: 180px;
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

	.category-badge {
		font-size: 0.75rem;
		font-weight: 800;
		color: #ffffff;
		background: rgba(0, 0, 0, 0.6);
		padding: 0.2rem 0.6rem;
		border-radius: 12px;
		backdrop-filter: blur(4px);
	}

	.star-ignored-btn {
		background: none;
		border: none;
		font-size: 1.6rem;
		color: rgba(255, 255, 255, 0.6);
		cursor: pointer;
		line-height: 1;
		padding: 0;
		transition: transform 0.2s ease, color 0.2s ease;
	}

	.star-ignored-btn.ignored {
		color: var(--yellow-color);
		transform: scale(1.25);
		filter: drop-shadow(0 0 6px rgba(250, 204, 21, 0.5));
	}

	/* 3D FLIP CARD */
	.flip-scene {
		flex: 1;
		width: 100%;
		perspective: 1000px;
		cursor: pointer;
		margin: 0.5rem 0;
	}

	.flip-card-inner {
		width: 100%;
		height: 100%;
		position: relative;
		transform-style: preserve-3d;
		transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
		border-radius: 16px;
	}

	.flip-card-inner.is-flipped {
		transform: rotateY(180deg);
	}

	.face {
		position: absolute;
		inset: 0;
		backface-visibility: hidden;
		border-radius: 16px;
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
		background: linear-gradient(135deg, var(--card-bg-subtle), var(--card-bg));
		border: 2px solid var(--border-color);
		text-align: center;
	}

	.front-bg-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		z-index: 1;
	}

	.front-img-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to top,
			rgba(0, 0, 0, 0.85) 0%,
			rgba(0, 0, 0, 0.4) 50%,
			rgba(0, 0, 0, 0.3) 100%
		);
		z-index: 2;
	}

	.front-body {
		position: relative;
		z-index: 3;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.reel-title {
		font-size: 2.2rem;
		font-weight: 900;
		color: #ffffff;
		margin: 0;
		letter-spacing: -0.02em;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
	}

	.reel-fullname-sub {
		font-size: 1rem;
		font-weight: 800;
		color: #58cc02;
		margin: 0;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
	}

	.tap-hint-pill {
		margin-top: 0.75rem;
		padding: 0.35rem 0.85rem;
		border-radius: 20px;
		background: rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(6px);
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
		gap: 0.5rem;
	}

	.back-top {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.back-title {
		font-size: 1.4rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.back-fullname-badge {
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--accent-color);
	}

	.back-desc-container {
		flex: 1;
		overflow-y: auto;
		padding: 0.4rem 0;
	}

	.back-desc-text {
		font-size: 0.92rem;
		line-height: 1.45;
		color: var(--text-color);
		margin: 0;
		font-weight: 600;
	}

	.back-media-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
	}

	.back-preview-img {
		max-height: 110px;
		width: 100%;
		object-fit: cover;
		border-radius: 10px;
		border: 1.5px solid var(--border-color);
	}

	.next-photo-btn {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		color: var(--text-color);
		font-size: 0.7rem;
		font-weight: 800;
		padding: 0.25rem 0.6rem;
		border-radius: 8px;
		cursor: pointer;
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
