<script lang="ts">
	import { onMount } from 'svelte';
	import type { Card } from '$lib/types/cards';
	import { statsStore } from '$lib/stores/statsStore';
	import { ignoredCardsStore } from '$lib/stores/ignoredCardsStore';

	let {
		card,
		mode = 'standard',
		onNext,
		onPrev,
		currentIndex,
		totalCards
	} = $props<{
		card: Card;
		mode?: 'standard' | 'foto' | 'inverso';
		onNext: () => void;
		onPrev: () => void;
		currentIndex: number;
		totalCards: number;
	}>();

	let flipped = $state(false);
	let currentImageIndex = $state(0);
	let isIgnored = $state(false);

	onMount(() => {
		const unsub = ignoredCardsStore.subscribe(() => {
			isIgnored = ignoredCardsStore.isIgnored(card.id);
		});
		return unsub;
	});

	$effect(() => {
		flipped = false;
		currentImageIndex = 0;
		isIgnored = ignoredCardsStore.isIgnored(card.id);
	});

	function handleCardClick() {
		flipped = !flipped;
		if (flipped) {
			statsStore.recordStudySession();
		}
	}

	async function toggleIgnored(e: MouseEvent) {
		e.stopPropagation();
		await ignoredCardsStore.toggleIgnored(card.id);
		isIgnored = ignoredCardsStore.isIgnored(card.id);
	}

	function nextImage(e: MouseEvent) {
		e.stopPropagation();
		if (card.images && card.images.length > 0) {
			currentImageIndex = (currentImageIndex + 1) % card.images.length;
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			handleCardClick();
		} else if (e.key === 'ArrowRight') {
			if (currentIndex < totalCards - 1) onNext();
		} else if (e.key === 'ArrowLeft') {
			if (currentIndex > 0) onPrev();
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="flashcard-container">
	<!-- Progress Track -->
	<div class="duo-progress-track">
		<div class="duo-progress-fill" style="width: {((currentIndex + 1) / totalCards) * 100}%"></div>
	</div>

	<!-- 3D Flip Card Scene -->
	<div
		class="scene"
		onclick={handleCardClick}
		onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick()}
		role="button"
		tabindex="0"
	>
		<div class="card" class:is-flipped={flipped}>
			<!-- FRONT FACE -->
			<div class="card-face front duo-card">
				<button
					class="card-star-btn"
					class:ignored={isIgnored}
					onclick={toggleIgnored}
					aria-label={isIgnored ? 'Card ignorata' : 'Ignora card'}
					title={isIgnored ? 'Card ignorata (Clicca per riattivare)' : 'Ignora card durante il mescolaggio'}
				>
					★
				</button>

				<div class="face-content">
					{#if mode === 'standard'}
						<h2 class="card-title">
							{card.title || card.fullName}
						</h2>

						<p class="instruction">
							🗣️ Pronuncia a voce la definizione, poi <strong>tocca per verificare</strong>
						</p>
					{:else if mode === 'inverso'}
						<div class="description-box duo-card front-desc-box">
							<p>{card.description || '(Nessuna descrizione specificata)'}</p>
						</div>

						<p class="instruction">
							🗣️ Di' a voce l'acronimo o titolo, poi <strong>tocca per verificare</strong>
						</p>
					{:else if mode === 'foto'}
						{#if card.images && card.images.length > 0}
							<div class="front-photo-wrapper">
								<img
									src={card.images[currentImageIndex]}
									alt="Foto di studio"
									class="front-photo-img"
								/>
								{#if card.images.length > 1}
									<button class="duo-btn duo-btn-gray photo-count-btn" onclick={nextImage}>
										Foto {currentImageIndex + 1}/{card.images.length} 🔄
									</button>
								{/if}
							</div>
						{/if}

						<p class="instruction">
							🗣️ Guarda la foto e di' a voce il concetto, poi <strong>tocca per verificare</strong>
						</p>
					{/if}
				</div>

				<div class="tap-hint">
					<span>Tocca per girare <kbd class="kbd-badge">Spazio</kbd></span>
					<svg class="flip-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2.5"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						/>
					</svg>
				</div>
			</div>

			<!-- BACK FACE -->
			<div class="card-face back duo-card">
				<button
					class="card-star-btn"
					class:ignored={isIgnored}
					onclick={toggleIgnored}
					title={isIgnored ? 'Card ignorata (Clicca per riattivare)' : 'Ignora card'}
				>
					★
				</button>

				<div class="face-content">
					<div class="back-header">
						{#if card.title}
							<h3 class="card-title-small">{card.title}</h3>
							{#if card.fullName}
								<div class="fullname-banner">{card.fullName}</div>
							{/if}
						{:else if card.fullName}
							<h3 class="card-title-small">{card.fullName}</h3>
						{/if}
					</div>

					{#if mode !== 'inverso'}
						<div class="description-box duo-card">
							<p>{card.description || '(Nessuna descrizione specificata)'}</p>
						</div>
					{/if}

					{#if mode !== 'foto' && card.images && card.images.length > 0}
						<div class="image-gallery">
							<img
								src={card.images[currentImageIndex]}
								alt="Foto card {card.title}"
								class="card-img"
							/>
							{#if card.images.length > 1}
								<button class="duo-btn duo-btn-purple next-img-btn" onclick={nextImage}>
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
		<button class="duo-btn duo-btn-gray nav-btn" onclick={onPrev} disabled={currentIndex === 0}>
			← Indietro
		</button>
		<button class="duo-btn duo-btn-green reveal-btn" onclick={handleCardClick}>
			{flipped ? 'NASCONDI' : 'RISPOSTA'}
		</button>
		<button
			class="duo-btn duo-btn-blue nav-btn"
			onclick={onNext}
			disabled={currentIndex === totalCards - 1}
		>
			Avanti →
		</button>
	</div>
</div>

<style>
	.flashcard-container {
		width: 100%;
		max-width: 560px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.card-star-btn {
		position: absolute;
		top: 0.85rem;
		right: 0.85rem;
		z-index: 10;
		background: none;
		border: none;
		font-size: 1.6rem;
		color: var(--text-muted);
		cursor: pointer;
		line-height: 1;
		padding: 0.25rem;
		transition: transform 0.2s ease, color 0.2s ease;
	}

	.card-star-btn.ignored {
		color: var(--yellow-color);
		transform: scale(1.25);
		filter: drop-shadow(0 0 6px rgba(250, 204, 21, 0.5));
	}

	.duo-progress-track {
		width: 100%;
		height: 12px;
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

	/* 3D Scene */
	.scene {
		width: 100%;
		min-height: clamp(300px, 44vh, 420px);
		perspective: 1200px;
		cursor: pointer;
	}

	.card {
		width: 100%;
		height: 100%;
		min-height: clamp(300px, 44vh, 420px);
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
		padding: 1.75rem 1.5rem;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		box-sizing: border-box;
	}

	.card-face.back {
		transform: rotateY(180deg);
		overflow-y: auto;
	}

	.face-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: center;
		text-align: center;
		width: 100%;
	}

	.card-title {
		font-size: 2.8rem;
		font-weight: 900;
		letter-spacing: -0.03em;
		color: var(--accent-color);
		margin: auto 0;
		line-height: 1.1;
	}

	.card-title-small {
		font-size: 1.65rem;
		font-weight: 900;
		color: var(--accent-color);
		margin: 0;
	}

	.fullname-banner {
		font-size: 1.05rem;
		font-weight: 800;
		color: var(--green-color);
		background: rgba(34, 197, 94, 0.12);
		padding: 0.35rem 0.85rem;
		border-radius: 12px;
		border: 1.5px solid var(--green-color);
		margin-top: 0.2rem;
	}

	.instruction {
		font-size: 0.9rem;
		color: var(--text-muted);
		line-height: 1.4;
	}

	.description-box {
		padding: 1.1rem;
		border-radius: 18px;
		font-size: 1rem;
		line-height: 1.55;
		color: var(--text-color);
		text-align: left;
		width: 100%;
		box-sizing: border-box;
	}

	.front-desc-box {
		margin: auto 0;
		max-height: 220px;
		overflow-y: auto;
		background: var(--card-bg-subtle);
	}

	.front-photo-wrapper {
		position: relative;
		width: 100%;
		border-radius: 16px;
		overflow: hidden;
		background-color: #000;
		min-height: clamp(160px, 26vh, 230px);
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--border-color);
		margin: auto 0;
	}

	.front-photo-img {
		width: 100%;
		max-height: clamp(160px, 26vh, 230px);
		object-fit: cover;
		display: block;
	}

	.photo-count-btn {
		position: absolute;
		bottom: 10px;
		right: 10px;
		padding: 0.3rem 0.65rem;
		font-size: 0.75rem;
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
		max-height: 180px;
		object-fit: cover;
		border-radius: 14px;
		border: 2px solid var(--border-color);
	}

	.next-img-btn {
		font-size: 0.75rem;
		padding: 0.4rem 0.8rem;
	}

	.tap-hint {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-size: 0.82rem;
		font-weight: 800;
		color: var(--text-muted);
		margin-top: 0.5rem;
	}

	.kbd-badge {
		font-size: 0.7rem;
		font-family: inherit;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		padding: 0.1rem 0.4rem;
		border-radius: 6px;
		color: var(--text-muted);
		margin-left: 0.25rem;
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

	.nav-btn {
		font-size: 0.85rem;
	}

	.reveal-btn {
		flex: 1;
		font-size: 1rem;
	}

	@media (max-width: 600px) {
		.kbd-badge {
			display: none;
		}

		.scene,
		.card {
			min-height: 340px;
		}

		.card-face {
			padding: 1.1rem;
			border-radius: 20px;
		}

		.card-title {
			font-size: 2.2rem;
		}

		.card-title-small {
			font-size: 1.35rem;
		}

		.description-box {
			padding: 0.85rem;
			font-size: 0.92rem;
		}

		.card-controls {
			gap: 0.4rem;
		}

		.nav-btn {
			padding: 0.75rem 0.85rem;
			font-size: 0.8rem;
		}

		.reveal-btn {
			padding: 0.75rem 0.6rem;
			font-size: 0.85rem;
		}
	}
</style>
