<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { statsStore } from '$lib/stores/statsStore';
	import { tts } from '$lib/utils/tts';
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

	// Dynamic category filtering & continuous shuffle order
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

<div class="reels-page-wrapper">
	<div class="reels-header-overlay">
		<CategoryFilterBar
			selectedCategory={selectedCategory}
			onSelectCategory={(cat) => (selectedCategory = cat)}
		/>
	</div>

	<div class="reels-feed-container">
		{#if filteredCards.length > 0}
			{#each filteredCards as card (card.id)}
				{@const isFlipped = flippedMap[card.id] || false}
				{@const imgIdx = imageIndexMap[card.id] || 0}
				{@const hasImages = card.images && card.images.length > 0}
				{@const cardCategories = card.categories && card.categories.length > 0 ? card.categories : card.category ? [card.category] : []}

				<div class="reel-slide">
					<!-- Top Action Bar (Audio + Category Badges) -->
					<div class="reel-top-bar">
						<div class="top-categories">
							{#each cardCategories as cat}
								<span class="category-tag">{cat}</span>
							{/each}
						</div>
						<button class="audio-btn" onclick={(e) => speakAudio(e, card)} title="Ascolta pronuncia">
							🔊 Audio
						</button>
					</div>

					<!-- 3D Flipping Reel Card -->
					<div
						class="scene"
						onclick={() => toggleFlip(card.id)}
						role="button"
						tabindex="0"
						onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleFlip(card.id)}
					>
						<div class="card" class:is-flipped={isFlipped}>
							<!-- FRONT (Title & Image) -->
							<div class="card-face front">
								<div class="face-overlay"></div>

								{#if hasImages}
									<img src={card.images![imgIdx]} alt={card.title} class="bg-card-img" />
								{/if}

								<div class="front-content">
									<h1 class="card-title">{card.title}</h1>
									{#if card.fullName}
										<div class="reel-fullname">{card.fullName}</div>
									{/if}
									
									<div class="tap-flip-hint">
										<span>👇 Tocca per scoprire la descrizione</span>
									</div>
								</div>
							</div>

							<!-- BACK (Description + Photos) -->
							<div class="card-face back">
								<div class="back-content">
									<div class="back-header">
										<h2 class="card-title-small">{card.title}</h2>
										{#if card.fullName}
											<span class="back-badge">{card.fullName}</span>
										{:else}
											<span class="back-badge">Significato</span>
										{/if}
									</div>

									<div class="description-box">
										<p>{card.description}</p>
									</div>

									{#if hasImages}
										<div class="gallery-section">
											<img src={card.images![imgIdx]} alt={card.title} class="back-img" />
											{#if card.images!.length > 1}
												<button class="next-img-btn" onclick={(e) => nextImage(e, card)}>
													Foto successiva ({imgIdx + 1}/{card.images!.length})
												</button>
											{/if}
										</div>
									{/if}

									<div class="tap-flip-hint back-hint">
										<span>Tocca per girare la scheda</span>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div class="reel-scroll-hint">
						<span class="swipe-text">Scorri in verticale ⬇️</span>
					</div>
				</div>
			{/each}
		{:else}
			<div class="empty-reels duo-card">
				<span class="empty-icon">📭</span>
				<p>Nessun Reel disponibile per la categoria selezionata.</p>
				<button class="duo-btn duo-btn-purple" onclick={() => (selectedCategory = 'ALL')}>
					Mostra Tutti i Reels
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.reels-page-wrapper {
		width: 100%;
		height: calc(100vh - 140px);
		display: flex;
		flex-direction: column;
		align-items: center;
		position: relative;
		overflow: hidden;
		box-sizing: border-box;
		gap: 0.5rem;
	}

	.reels-header-overlay {
		width: 100%;
		max-width: 520px;
		z-index: 50;
		padding: 0 0.25rem;
		box-sizing: border-box;
	}

	.reels-feed-container {
		width: 100%;
		max-width: 520px;
		flex: 1;
		overflow-y: scroll;
		scroll-snap-type: y mandatory;
		border-radius: 24px;
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		box-shadow: 0 12px 35px rgba(0, 0, 0, 0.25);
		position: relative;
		scrollbar-width: none; /* Hide scrollbar for smooth feel */
	}

	.reels-feed-container::-webkit-scrollbar {
		display: none;
	}

	.reel-slide {
		width: 100%;
		height: 100%;
		scroll-snap-align: start;
		scroll-snap-stop: always;
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 1.1rem;
		box-sizing: border-box;
		overflow: hidden;
	}

	.reel-top-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		z-index: 20;
		gap: 0.5rem;
	}

	.top-categories {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.category-tag {
		font-size: 0.72rem;
		font-weight: 800;
		text-transform: uppercase;
		color: var(--accent-color);
		background: var(--accent-light-bg);
		border: 1px solid var(--accent-color);
		padding: 0.2rem 0.6rem;
		border-radius: 8px;
	}

	.audio-btn {
		padding: 0.35rem 0.75rem;
		border-radius: 12px;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		color: var(--text-color);
		font-size: 0.78rem;
		font-weight: 800;
		cursor: pointer;
		backdrop-filter: blur(8px);
	}

	.scene {
		width: 100%;
		height: calc(100% - 80px);
		perspective: 1400px;
		cursor: pointer;
		margin: auto 0;
	}

	.card {
		width: 100%;
		height: 100%;
		position: relative;
		transition: transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1);
		transform-style: preserve-3d;
	}

	.card:active {
		transform: scale(0.98);
	}

	.card.is-flipped {
		transform: rotateY(180deg);
	}

	.card-face {
		position: absolute;
		width: 100%;
		height: 100%;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		border-radius: 20px;
		border: 2px solid var(--border-color);
		box-shadow: 0 14px 30px rgba(0, 0, 0, 0.3);
		overflow: hidden;
		box-sizing: border-box;
	}

	.card-face.front {
		background: var(--card-bg);
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		padding: 1.75rem;
	}

	.bg-card-img {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		z-index: 0;
		filter: brightness(0.55);
	}

	.face-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1;
		background: linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.85) 100%);
	}

	.front-content {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.card-title {
		font-size: 3rem;
		font-weight: 900;
		color: white;
		margin: 0;
		line-height: 1.1;
		text-shadow: 0 4px 16px rgba(0, 0, 0, 0.8);
	}

	.reel-fullname {
		font-size: 1.3rem;
		font-weight: 800;
		color: #4ade80;
		margin-top: -0.25rem;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
	}

	.tap-flip-hint {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.82rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.85);
	}

	.card-face.back {
		transform: rotateY(180deg);
		background: var(--card-bg);
		padding: 1.5rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	.back-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		height: 100%;
		justify-content: space-between;
	}

	.back-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.card-title-small {
		font-size: 1.85rem;
		font-weight: 900;
		color: var(--accent-color);
		margin: 0;
	}

	.back-badge {
		font-size: 0.72rem;
		font-weight: 800;
		text-transform: uppercase;
		color: var(--text-muted);
		background: var(--card-bg-subtle);
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		border: 1px solid var(--border-color);
	}

	.description-box {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 16px;
		padding: 1.1rem;
		font-size: 1.02rem;
		line-height: 1.55;
		color: var(--text-color);
	}

	.gallery-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: center;
	}

	.back-img {
		width: 100%;
		max-height: 160px;
		object-fit: cover;
		border-radius: 12px;
		border: 1px solid var(--border-color);
	}

	.next-img-btn {
		font-size: 0.75rem;
		font-weight: 800;
		padding: 0.35rem 0.75rem;
		border-radius: 8px;
		background: var(--accent-light-bg);
		color: var(--accent-color);
		border: 1px solid var(--accent-color);
		cursor: pointer;
	}

	.back-hint {
		justify-content: center;
		color: var(--text-muted);
	}

	.reel-scroll-hint {
		z-index: 20;
		text-align: center;
	}

	.swipe-text {
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--text-muted);
		animation: bounce 2s infinite;
	}

	.empty-reels {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.85rem;
		height: 100%;
		text-align: center;
		padding: 2rem;
	}

	.empty-icon {
		font-size: 3rem;
	}

	@media (max-width: 768px) {
		.reels-page-wrapper {
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: calc(64px + var(--safe-area-bottom, 0px));
			width: 100vw;
			height: calc(100dvh - 64px - var(--safe-area-bottom, 0px));
			z-index: 10;
		}

		.reels-feed-container {
			max-width: 100vw;
			width: 100vw;
			height: 100%;
			border-radius: 0;
			border: none;
			box-shadow: none;
		}

		.reel-slide {
			padding: 58px 1rem 1rem 1rem;
		}
	}

	@keyframes bounce {
		0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
		40% { transform: translateY(-5px); }
		60% { transform: translateY(-2px); }
	}
</style>
