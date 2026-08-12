<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { statsStore } from '$lib/stores/statsStore';
	import { tts } from '$lib/utils/tts';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import CategoryFilterBar from '$lib/components/CategoryFilterBar.svelte';
	import type { Card } from '$lib/types/cards';

	let cards = $state<Card[]>([]);
	let selectedCategory = $state<string>('ALL');
	let flippedMap = $state<Record<string, boolean>>({});
	let imageIndexMap = $state<Record<string, number>>({});

	onMount(() => {
		const unsubscribe = cardsStore.subscribe((c) => (cards = c));
		return unsubscribe;
	});

	// Filter cards dynamically by selected category
	let filteredCards = $derived.by<Card[]>(() => {
		if (selectedCategory === 'ALL') return cards;
		return cards.filter(
			(c) =>
				c.category === selectedCategory ||
				(c.categories && c.categories.includes(selectedCategory))
		);
	});

	function toggleFlip(cardId: string) {
		flippedMap[cardId] = !flippedMap[cardId];
		if (flippedMap[cardId]) {
			statsStore.recordStudySession();
		}
	}

	function speakAudio(e: MouseEvent, card: Card) {
		e.stopPropagation();
		const isFlipped = flippedMap[card.id];
		const fullText = card.fullName ? `${card.title}, ${card.fullName}` : card.title;
		const text = isFlipped ? `${fullText}. ${card.description}` : fullText;
		tts.speak(text);
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
		subtitle="Scorri le schede visive ed ascolta le definizioni in un feed dinamico."
		badge="Modalità Reels"
		icon="/emoji/camera_3d.png"
		variant="orange"
	/>

	<!-- Category Filter Bar -->
	<CategoryFilterBar
		selectedCategory={selectedCategory}
		onSelectCategory={(cat) => (selectedCategory = cat)}
	/>

	<!-- Reels Snap Feed -->
	{#if filteredCards.length > 0}
		<div class="reels-viewport duo-card">
			<div class="reels-scroll-feed">
				{#each filteredCards as card (card.id)}
					{@const isFlipped = flippedMap[card.id] || false}
					{@const imgIdx = imageIndexMap[card.id] || 0}
					{@const hasImages = card.images && card.images.length > 0}
					{@const cardCategories = card.categories && card.categories.length > 0 ? card.categories : card.category ? [card.category] : []}

					<div class="reel-card-slide">
						<!-- Top Action Bar -->
						<div class="reel-header-bar">
							<div class="category-tags-group">
								{#each cardCategories as cat}
									<span class="cat-pill">{cat}</span>
								{/each}
							</div>
							<button class="audio-tts-btn" onclick={(e) => speakAudio(e, card)} title="Ascolta audio">
								🔊 Audio
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
								<!-- FRONT FACE -->
								<div class="face front-face">
									{#if hasImages}
										<img src={card.images![imgIdx]} alt={card.title} class="front-bg-img" />
										<div class="front-img-overlay"></div>
									{/if}

									<div class="front-body">
										<h2 class="reel-title">{card.title}</h2>
										{#if card.fullName}
											<p class="reel-fullname-sub">{card.fullName}</p>
										{/if}

										<div class="tap-hint-pill">
											<span>👇 Tocca per scoprire la descrizione</span>
										</div>
									</div>
								</div>

								<!-- BACK FACE -->
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

										{#if hasImages}
											<div class="back-media-box">
												<img src={card.images![imgIdx]} alt={card.title} class="back-preview-img" />
												{#if card.images!.length > 1}
													<button class="next-photo-btn" onclick={(e) => nextImage(e, card)}>
														Foto successiva ({imgIdx + 1}/{card.images!.length})
													</button>
												{/if}
											</div>
										{/if}

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
			<span class="empty-emoji">📭</span>
			<h3>Nessun Reel per questa categoria</h3>
			<p>Seleziona un'altra categoria oppure mostra tutte le schede.</p>
			<button class="duo-btn duo-btn-purple" onclick={() => (selectedCategory = 'ALL')}>
				Mostra Tutti i Reels
			</button>
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
		height: 490px;
		max-height: calc(100vh - 300px);
		min-height: 350px;
		overflow-y: scroll;
		scroll-snap-type: y mandatory;
		scrollbar-width: none;
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

	.category-tags-group {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.cat-pill {
		font-size: 0.68rem;
		font-weight: 900;
		padding: 0.25rem 0.6rem;
		border-radius: 8px;
		background: var(--accent-light-bg);
		color: var(--accent-color);
		border: 1px solid var(--accent-color);
		text-transform: uppercase;
	}

	.audio-tts-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 10px;
		padding: 0.3rem 0.65rem;
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-color);
		cursor: pointer;
		transition: transform 0.15s ease;
	}

	.audio-tts-btn:active {
		transform: scale(0.95);
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
		background: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.4) 50%, rgba(0, 0, 0, 0.3) 100%);
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
		color: var(--text-color);
		margin: 0;
		letter-spacing: -0.02em;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
	}

	.front-bg-img ~ .front-body .reel-title {
		color: #ffffff;
	}

	.reel-fullname-sub {
		font-size: 1rem;
		font-weight: 800;
		color: var(--accent-color);
		margin: 0;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
	}

	.front-bg-img ~ .front-body .reel-fullname-sub {
		color: #58cc02;
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
