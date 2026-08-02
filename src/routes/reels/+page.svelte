<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { statsStore } from '$lib/stores/statsStore';
	import { tts } from '$lib/utils/tts';
	import type { Card } from '$lib/types/cards';

	let cards = $state<Card[]>([]);
	let flippedMap = $state<Record<string, boolean>>({});
	let imageIndexMap = $state<Record<string, number>>({});

	onMount(() => {
		const unsubscribe = cardsStore.subscribe((c) => (cards = c));
		return unsubscribe;
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
		const text = isFlipped ? `${card.title}. ${card.description}` : card.title;
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

<div class="reels-feed-container">
	{#if cards.length > 0}
		{#each cards as card, index}
			{@const isFlipped = flippedMap[card.id] || false}
			{@const imgIdx = imageIndexMap[card.id] || 0}
			{@const hasImages = card.images && card.images.length > 0}

			<div class="reel-slide">
				<!-- Header Index Bar -->
				<div class="reel-top-bar">
					<span class="reel-badge">🎬 Reel Ferroviario</span>
					
					<div class="right-top-actions">
						<button class="audio-btn" onclick={(e) => speakAudio(e, card)}>
							🔊 Audio
						</button>
						<span class="reel-index">{index + 1} / {cards.length}</span>
					</div>
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
						<!-- FRONT (Acronym / Title) -->
						<div class="card-face front">
							<div class="face-overlay"></div>
							
							{#if hasImages}
								<img src={card.images![imgIdx]} alt={card.title} class="bg-card-img" />
							{/if}

							<div class="front-content">
								{#if card.category}
									<span class="category-tag">{card.category}</span>
								{/if}

								<h1 class="card-title">{card.title}</h1>
								
								<div class="tap-flip-hint">
									<span>👇 Tocca la card per girarla</span>
									<svg class="flip-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
									</svg>
								</div>
							</div>
						</div>

						<!-- BACK (Description + Photos) -->
						<div class="card-face back">
							<div class="back-content">
								<div class="back-header">
									<h2 class="card-title-small">{card.title}</h2>
									<span class="back-badge">Spiegazione</span>
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

								{#if card.tags && card.tags.length > 0}
									<div class="tag-row">
										{#each card.tags as tag}
											<span class="tag">#{tag}</span>
										{/each}
									</div>
								{/if}

								<div class="tap-flip-hint back-hint">
									<span>Tocca per girare di nuovo</span>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Scroll Hint Bottom -->
				<div class="reel-scroll-hint">
					<span class="swipe-text">Scorri verso l'alto per la prossima card ⬇️</span>
				</div>
			</div>
		{/each}
	{:else}
		<div class="empty-reels">Caricamento Reels...</div>
	{/if}
</div>

<style>
	.reels-feed-container {
		width: 100%;
		height: calc(100vh - 130px);
		overflow-y: scroll;
		scroll-snap-type: y mandatory;
		border-radius: 28px;
		background: #090d16;
		position: relative;
	}

	@media (min-width: 768px) {
		.reels-feed-container {
			max-width: 480px;
			margin: 0 auto;
			height: calc(100vh - 150px);
		}
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
		padding: 1.25rem;
		box-sizing: border-box;
		overflow: hidden;
	}

	.reel-top-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		z-index: 20;
	}

	.reel-badge {
		padding: 0.35rem 0.85rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 800;
		background: rgba(255, 255, 255, 0.15);
		backdrop-filter: blur(10px);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.right-top-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.audio-btn {
		padding: 0.3rem 0.65rem;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.2);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.3);
		color: white;
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
	}

	.reel-index {
		font-size: 0.85rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.8);
	}

	/* 3D Scene */
	.scene {
		width: 100%;
		height: calc(100% - 90px);
		perspective: 1200px;
		cursor: pointer;
		margin: auto 0;
	}

	.card {
		width: 100%;
		height: 100%;
		position: relative;
		transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
		transform-style: preserve-3d;
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
		border-radius: 24px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
		overflow: hidden;
		box-sizing: border-box;
	}

	.card-face.front {
		background: linear-gradient(145deg, #1e293b, #0f172a);
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		padding: 2rem;
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
		filter: brightness(0.6);
	}

	.face-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1;
		background: linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.85) 100%);
	}

	.front-content {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.category-tag {
		align-self: flex-start;
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		color: #38bdf8;
		background: rgba(56, 189, 248, 0.25);
		padding: 0.25rem 0.75rem;
		border-radius: 8px;
	}

	.card-title {
		font-size: 3.2rem;
		font-weight: 900;
		color: white;
		margin: 0;
		line-height: 1.1;
		text-shadow: 0 4px 16px rgba(0, 0, 0, 0.7);
	}

	.tap-flip-hint {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		font-weight: 700;
		color: #cbd5e1;
		margin-top: 0.5rem;
	}

	.flip-icon {
		width: 18px;
		height: 18px;
	}

	.card-face.back {
		transform: rotateY(180deg);
		background: linear-gradient(145deg, #1e293b, #0f172a);
		padding: 1.75rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	.back-content {
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
		height: 100%;
		justify-content: space-between;
	}

	.back-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.card-title-small {
		font-size: 2rem;
		font-weight: 900;
		color: #38bdf8;
		margin: 0;
	}

	.back-badge {
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		color: #94a3b8;
		background: rgba(255, 255, 255, 0.1);
		padding: 0.2rem 0.6rem;
		border-radius: 6px;
	}

	.description-box {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 16px;
		padding: 1.25rem;
		font-size: 1.05rem;
		line-height: 1.6;
		color: white;
	}

	.gallery-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: center;
	}

	.back-img {
		width: 100%;
		max-height: 180px;
		object-fit: cover;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.next-img-btn {
		font-size: 0.75rem;
		padding: 0.35rem 0.75rem;
		border-radius: 8px;
		background: rgba(56, 189, 248, 0.2);
		color: #38bdf8;
		border: 1px solid rgba(56, 189, 248, 0.4);
		cursor: pointer;
	}

	.tag-row {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.tag {
		font-size: 0.75rem;
		color: #94a3b8;
		background: rgba(255, 255, 255, 0.08);
		padding: 0.15rem 0.5rem;
		border-radius: 6px;
	}

	.back-hint {
		justify-content: center;
		color: #94a3b8;
	}

	.reel-scroll-hint {
		z-index: 20;
		text-align: center;
	}

	.swipe-text {
		font-size: 0.75rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.6);
		animation: bounce 2s infinite;
	}

	.empty-reels {
		color: white;
		text-align: center;
		padding: 4rem;
	}

	@keyframes bounce {
		0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
		40% { transform: translateY(-6px); }
		60% { transform: translateY(-3px); }
	}
</style>
