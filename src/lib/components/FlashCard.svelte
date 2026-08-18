<script lang="ts">
	import { onMount } from 'svelte';
	import type { Card } from '$lib/types/cards';
	import { statsStore } from '$lib/stores/statsStore';
	import { ignoredCardsStore } from '$lib/stores/ignoredCardsStore';
	import { toastStore } from '$lib/stores/toastStore';

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
	let showImage = $state(false);
	let currentImageIndex = $state(0);
	let ignoredIds = $state<Set<string>>(new Set());

	onMount(() => {
		const unsub = ignoredCardsStore.subscribe((ids) => {
			ignoredIds = ids;
		});
		return unsub;
	});

	let isIgnored = $derived(card ? ignoredIds.has(card.id) : false);

	$effect(() => {
		// Track card and mode so effect runs whenever card or mode changes
		const _id = card?.id;
		const _mode = mode;
		flipped = false;
		showImage = false;
		currentImageIndex = 0;
	});

	function handleCardClick(e?: MouseEvent) {
		if (e) {
			const target = e.target as HTMLElement;
			if (target.closest('.card-star-btn') || target.closest('.photo-count-btn')) {
				return;
			}
		}
		flipped = !flipped;
		if (flipped) {
			statsStore.recordStudySession();
		}
	}

	function toggleShowImage(e?: MouseEvent) {
		if (e) e.stopPropagation();
		showImage = !showImage;
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			toggleShowImage(e);
		}
	}

	async function toggleIgnored(e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		const cardToToggle = card;
		const isNowIgnored = await ignoredCardsStore.toggleIgnored(cardToToggle.id);

		toastStore.show({
			message: isNowIgnored ? '⭐ Scheda ignorata dal ripasso' : '✨ Scheda riattivata nel ripasso',
			actionLabel: 'Annulla',
			onAction: async () => {
				await ignoredCardsStore.toggleIgnored(cardToToggle.id);
			}
		});
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
	<!-- 3D Flip Card Scene -->
	<div
		class="scene"
		onclick={(e) => handleCardClick(e)}
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
					title={isIgnored
						? 'Card ignorata (Clicca per riattivare)'
						: 'Ignora card durante il mescolaggio'}
				>
					★
				</button>

				<div class="face-content">
					{#if mode === 'standard'}
						<h2 class="card-title">
							{card.title}
						</h2>
					{:else if mode === 'inverso'}
						<div class="description-box duo-card front-desc-box">
							<p>{card.description || card.title || '(Nessuna descrizione o testo specificato per questa scheda)'}</p>
						</div>
					{:else if mode === 'foto'}
						{#if card.images && card.images.length > 0}
							<div class="front-photo-wrapper">
								<img
									src={card.images[currentImageIndex]}
									alt="Foto di studio"
									class="front-photo-img"
									loading="lazy"
									decoding="async"
								/>
								{#if card.images.length > 1}
									<button class="duo-btn duo-btn-gray photo-count-btn" onclick={nextImage}>
										Foto {currentImageIndex + 1}/{card.images.length} 🔄
									</button>
								{/if}
							</div>
						{/if}
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
				<div class="face-content">
					<div class="back-header">
						{#if card.title && card.fullName && card.title !== card.fullName}
							<div class="header-inline-row">
								<h3 class="card-title-small">{card.title}</h3>
								<span class="inline-dash">-</span>
								<span class="fullname-inline">{card.fullName}</span>
							</div>
						{:else}
							<h3 class="card-title-small">{card.title}</h3>
						{/if}
					</div>

					{#if mode !== 'inverso'}
						<div class="description-box duo-card">
							<p>{card.description || '(Nessuna descrizione specificata)'}</p>
						</div>
					{/if}

					{#if mode !== 'foto' && card.images && card.images.length > 0}
						<div class="image-gallery">
							<button class="duo-btn duo-btn-gray show-img-btn" onclick={toggleShowImage}>
								🖼️ Mostra immagine {#if card.images.length > 1}({card.images.length}){/if}
							</button>
						</div>
					{/if}
				</div>

				<div class="tap-hint">
					<span>Tocca per nascondere</span>
				</div>
			</div>
		</div>
	</div>

	<!-- IMAGE MODAL POPUP -->
	{#if showImage && card.images && card.images.length > 0}
		<div
			class="image-modal-backdrop"
			onclick={handleBackdropClick}
			onkeydown={(e) => e.key === 'Escape' && toggleShowImage(e as any)}
			role="button"
			tabindex="0"
		>
			<div class="image-modal-content duo-card">
				<button class="modal-close-btn" onclick={toggleShowImage} aria-label="Chiudi popup">
					✕
				</button>

				<img
					src={card.images[currentImageIndex]}
					alt="Foto card {card.title}"
					class="modal-card-img"
				/>

				{#if card.images.length > 1}
					<div class="modal-nav-bar">
						<button class="duo-btn duo-btn-purple next-img-btn" onclick={nextImage}>
							Foto {currentImageIndex + 1}/{card.images.length} 🔄
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}

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
		max-width: 100%;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		box-sizing: border-box;
	}

	.card-star-btn {
		position: absolute;
		top: 0.9rem;
		right: 0.9rem;
		z-index: 20;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		color: var(--text-muted);
		cursor: pointer;
		line-height: 1;
		padding: 0;
		transition: all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.card-star-btn:hover {
		transform: scale(1.1);
		border-color: var(--yellow-color);
		color: var(--yellow-color);
	}

	.card-star-btn.ignored {
		background: rgba(250, 204, 21, 0.15);
		border-color: var(--yellow-color);
		color: var(--yellow-color);
		filter: drop-shadow(0 0 6px rgba(250, 204, 21, 0.4));
		animation: starPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	/* 3D Scene */
	.scene {
		width: 100%;
		min-height: clamp(300px, 44vh, 420px);
		perspective: 1200px;
		cursor: pointer;
		outline: none;
		-webkit-tap-highlight-color: transparent;
		user-select: none;
	}

	.scene:focus,
	.scene:focus-visible {
		outline: none;
	}

	.card {
		width: 100%;
		height: 100%;
		min-height: clamp(300px, 44vh, 420px);
		position: relative;
		transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
		transform-style: preserve-3d;
		outline: none;
		user-select: none;
	}

	.card.is-flipped {
		transform: rotateY(180deg);
	}

	.card:focus,
	.card:focus-visible {
		outline: none;
	}

	.card-face {
		position: absolute;
		width: 100%;
		height: 100%;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		border-radius: 24px;
		padding: 1.5rem 1.25rem 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		box-sizing: border-box;
		overflow: hidden;
		outline: none;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
	}

	.card-face:focus,
	.card-face:focus-visible {
		outline: none;
	}

	.card-face.back {
		transform: rotateY(180deg);
		overflow-y: auto;
	}

	.face-content {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: center;
		justify-content: center;
		text-align: center;
		width: 100%;
		overflow: hidden;
	}

	.back-header {
		width: 100%;
		padding: 0 0.5rem;
		box-sizing: border-box;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.card-title {
		font-size: 2.5rem;
		font-weight: 900;
		letter-spacing: -0.03em;
		color: var(--accent-color);
		margin: auto 0;
		line-height: 1.1;
		word-break: break-word;
	}

	.card-title-small {
		font-size: 1.4rem;
		font-weight: 900;
		color: var(--accent-color);
		margin: 0;
		line-height: 1.25;
		word-break: break-word;
	}

	.header-inline-row {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.25rem 0.45rem;
		width: 100%;
		text-align: center;
	}

	.inline-dash {
		color: var(--text-muted);
		font-weight: 900;
		font-size: 1.1rem;
	}

	.fullname-inline {
		font-size: 0.95rem;
		font-weight: 800;
		color: var(--green-color);
		background: rgba(34, 197, 94, 0.12);
		padding: 0.15rem 0.55rem;
		border-radius: 10px;
		border: 1.5px solid var(--green-color);
		max-width: 100%;
		box-sizing: border-box;
		word-break: break-word;
	}

	.description-box {
		padding: 0.85rem 1rem;
		border-radius: 16px;
		font-size: 0.95rem;
		line-height: 1.55;
		color: var(--text-color);
		text-align: left;
		width: 100%;
		box-sizing: border-box;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
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
		height: 100%;
		flex: 1;
		min-height: 0;
		border-radius: 16px;
		overflow: hidden;
		background: rgba(0, 0, 0, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--border-color);
		box-sizing: border-box;
	}

	.front-photo-img {
		width: 100%;
		height: 100%;
		max-height: 100%;
		object-fit: contain;
		display: block;
	}

	.photo-count-btn {
		position: absolute;
		bottom: 8px;
		right: 8px;
		padding: 0.25rem 0.55rem;
		font-size: 0.72rem;
	}

	.image-gallery {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		align-items: center;
		flex-shrink: 0;
		margin-top: 0.2rem;
	}

	.show-img-btn {
		font-size: 0.8rem;
		padding: 0.4rem 0.85rem;
	}

	/* Image Modal Popup */
	.image-modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 9999;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		animation: fadeIn 0.2s ease;
	}

	.image-modal-content {
		position: relative;
		max-width: 90vw;
		max-height: 85vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--card-bg);
		border-radius: 20px;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
		border: 2px solid var(--border-color);
	}

	.modal-close-btn {
		position: absolute;
		top: -12px;
		right: -12px;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--red-color, #ff4b4b);
		color: #ffffff;
		border: 2px solid #ffffff;
		font-size: 1.1rem;
		font-weight: 900;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		z-index: 10;
		transition: transform 0.2s ease;
	}

	.modal-close-btn:hover {
		transform: scale(1.15);
	}

	.modal-card-img {
		max-width: 100%;
		max-height: 70vh;
		object-fit: contain;
		border-radius: 12px;
	}

	.modal-nav-bar {
		display: flex;
		justify-content: center;
		width: 100%;
	}

	.next-img-btn {
		font-size: 0.8rem;
		padding: 0.4rem 0.85rem;
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

	@media (min-width: 1024px) and (max-height: 820px) {
		.scene,
		.card {
			min-height: clamp(250px, 36vh, 320px);
		}

		.card-face {
			padding: 1.1rem;
		}

		.card-title {
			font-size: 2.1rem;
		}

		.description-box {
			padding: 0.75rem 0.85rem;
			font-size: 0.92rem;
		}
	}
</style>
