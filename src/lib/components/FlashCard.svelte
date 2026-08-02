<script lang="ts">
	import type { Card } from '$lib/types/cards';
	import { statsStore } from '$lib/stores/statsStore';

	let { card, onNext, onPrev, currentIndex, totalCards } = $props<{
		card: Card;
		onNext: () => void;
		onPrev: () => void;
		currentIndex: number;
		totalCards: number;
	}>();

	let flipped = $state(false);
	let currentImageIndex = $state(0);
	let isFav = $state(false);

	$effect(() => {
		// Reset flip state when card changes
		flipped = false;
		currentImageIndex = 0;
		isFav = statsStore.isFavorite(card.id);
	});

	function handleCardClick() {
		flipped = !flipped;
		if (flipped) {
			statsStore.recordStudySession();
		}
	}

	function toggleFavorite(e: MouseEvent) {
		e.stopPropagation();
		statsStore.toggleFavorite(card.id);
		isFav = !isFav;
	}

	function nextImage(e: MouseEvent) {
		e.stopPropagation();
		if (card.images && card.images.length > 0) {
			currentImageIndex = (currentImageIndex + 1) % card.images.length;
		}
	}
</script>

<div class="flashcard-container">
	<!-- Counter & Favorite Header -->
	<div class="card-top-bar">
		<span class="badge category">{card.category || 'Generale'}</span>
		<span class="counter">{currentIndex + 1} / {totalCards}</span>
		<button class="fav-btn" class:active={isFav} onclick={toggleFavorite} aria-label="Preferito">
			★
		</button>
	</div>

	<!-- 3D Flip Card Scene -->
	<div
		class="scene"
		onclick={handleCardClick}
		role="button"
		tabindex="0"
		onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick()}
	>
		<div class="card" class:is-flipped={flipped}>
			<!-- FRONT (Acronym / Title) -->
			<div class="card-face front">
				<div class="face-content">
					<div class="title-badge">Acronimo / Termine</div>
					<h2 class="card-title">{card.title}</h2>
					<p class="instruction">
						🗣️ Pronuncia o pensa alla definizione, poi <strong>tocca per scoprire</strong>
					</p>
				</div>
				<div class="tap-hint">
					<span>Tocca per girare</span>
					<svg class="flip-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
				</div>
			</div>

			<!-- BACK (Description + Photos) -->
			<div class="card-face back">
				<div class="face-content">
					<div class="back-header">
						<h3 class="card-title-small">{card.title}</h3>
						{#if card.tags && card.tags.length > 0}
							<div class="tags">
								{#each card.tags as tag}
									<span class="tag">#{tag}</span>
								{/each}
							</div>
						{/if}
					</div>

					<div class="description-box">
						<p>{card.description}</p>
					</div>

					<!-- Image Section -->
					{#if card.images && card.images.length > 0}
						<div class="image-gallery">
							<img
								src={card.images[currentImageIndex]}
								alt="Foto card {card.title}"
								class="card-img"
							/>
							{#if card.images.length > 1}
								<button class="next-img-btn" onclick={nextImage}>
									Foto successiva ({currentImageIndex + 1}/{card.images.length})
								</button>
							{/if}
						</div>
					{/if}
				</div>

				<div class="tap-hint">
					<span>Tocca per nascondere</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Controls Footer -->
	<div class="card-controls">
		<button class="nav-btn prev-btn" onclick={onPrev} disabled={currentIndex === 0}>
			← Indietro
		</button>
		<button class="reveal-btn" onclick={handleCardClick}>
			{flipped ? 'Nascondi' : 'Mostra Risposta'}
		</button>
		<button class="nav-btn next-btn" onclick={onNext} disabled={currentIndex === totalCards - 1}>
			Avanti →
		</button>
	</div>
</div>

<style>
	.flashcard-container {
		width: 100%;
		max-width: 540px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.card-top-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 0.25rem;
	}

	.badge {
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background-color: var(--accent-light-bg);
		color: var(--accent-color);
		border: 1px solid var(--border-color);
	}

	.counter {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-muted);
	}

	.fav-btn {
		background: none;
		border: none;
		font-size: 1.4rem;
		color: var(--text-muted);
		cursor: pointer;
		transition: color 0.2s ease, transform 0.2s ease;
	}

	.fav-btn.active {
		color: #f59e0b;
		transform: scale(1.2);
	}

	/* 3D Scene */
	.scene {
		width: 100%;
		min-height: 380px;
		perspective: 1000px;
		cursor: pointer;
	}

	.card {
		width: 100%;
		height: 100%;
		min-height: 380px;
		position: relative;
		transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
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
		padding: 1.75rem;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		box-sizing: border-box;
	}

	.card-face.front {
		background: linear-gradient(145deg, var(--card-bg), var(--card-bg-subtle));
	}

	.card-face.back {
		transform: rotateY(180deg);
		background: linear-gradient(145deg, var(--card-bg-subtle), var(--card-bg));
		overflow-y: auto;
	}

	.face-content {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		align-items: center;
		text-align: center;
	}

	.title-badge {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--accent-color);
		letter-spacing: 0.1em;
	}

	.card-title {
		font-size: 2.75rem;
		font-weight: 900;
		letter-spacing: -0.03em;
		color: var(--text-color);
		margin: auto 0;
	}

	.card-title-small {
		font-size: 1.5rem;
		font-weight: 800;
		color: var(--accent-color);
		margin: 0;
	}

	.instruction {
		font-size: 0.9rem;
		color: var(--text-muted);
		line-height: 1.5;
	}

	.description-box {
		background: var(--card-bg-subtle);
		padding: 1.25rem;
		border-radius: 16px;
		border: 1px solid var(--border-color);
		font-size: 1rem;
		line-height: 1.6;
		color: var(--text-color);
		text-align: left;
		width: 100%;
		box-sizing: border-box;
	}

	.tags {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.tag {
		font-size: 0.75rem;
		color: var(--text-muted);
		background-color: var(--badge-bg);
		padding: 0.15rem 0.5rem;
		border-radius: 6px;
	}

	.image-gallery {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: center;
	}

	.card-img {
		width: 100%;
		max-height: 200px;
		object-fit: cover;
		border-radius: 12px;
		border: 1px solid var(--border-color);
	}

	.next-img-btn {
		font-size: 0.75rem;
		padding: 0.35rem 0.75rem;
		border-radius: 8px;
		background-color: var(--accent-light-bg);
		color: var(--accent-color);
		border: 1px solid var(--border-color);
		cursor: pointer;
	}

	.tap-hint {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-muted);
		margin-top: 1rem;
	}

	.flip-icon {
		width: 16px;
		height: 16px;
	}

	/* Controls */
	.card-controls {
		display: flex;
		gap: 0.75rem;
		justify-content: space-between;
		align-items: center;
	}

	.nav-btn, .reveal-btn {
		padding: 0.85rem 1.25rem;
		border-radius: 14px;
		font-weight: 700;
		font-size: 0.95rem;
		border: 1px solid var(--border-color);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.nav-btn {
		background-color: var(--card-bg);
		color: var(--text-color);
	}

	.nav-btn:hover:not(:disabled) {
		background-color: var(--hover-bg);
		transform: translateY(-2px);
	}

	.nav-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.reveal-btn {
		flex: 1;
		background: linear-gradient(135deg, var(--accent-color), #0284c7);
		color: white;
		border: none;
		box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);
	}

	.reveal-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(2, 132, 199, 0.5);
	}
</style>
