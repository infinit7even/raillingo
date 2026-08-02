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

	let step = $state<0 | 1 | 2>(0);
	let currentImageIndex = $state(0);

	$effect(() => {
		step = 0;
		currentImageIndex = 0;
	});

	function advanceStep() {
		if (step < 2) {
			step = (step + 1) as 1 | 2;
			if (step === 2) {
				statsStore.recordStudySession();
			}
		} else {
			step = 0;
		}
	}

	function nextImage(e: MouseEvent) {
		e.stopPropagation();
		if (card.images && card.images.length > 0) {
			currentImageIndex = (currentImageIndex + 1) % card.images.length;
		}
	}
</script>

<div class="photo-study-container">
	<div class="top-bar">
		<span class="duo-badge">Modalità Foto</span>
		<span class="counter-text">{currentIndex + 1} / {totalCards}</span>
	</div>

	<!-- Duolingo Progress Track -->
	<div class="duo-progress-track">
		<div class="duo-progress-fill" style="width: {((currentIndex + 1) / totalCards) * 100}%"></div>
	</div>

	<div
		class="study-card duo-card"
		onclick={advanceStep}
		role="button"
		tabindex="0"
		onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && advanceStep()}
	>
		<!-- Main Photo -->
		<div class="photo-wrapper">
			{#if card.images && card.images.length > 0}
				<img
					src={card.images[currentImageIndex]}
					alt="Foto di studio per {card.title}"
					class="photo-main"
				/>
				{#if card.images.length > 1}
					<button class="duo-btn duo-btn-gray img-badge" onclick={nextImage}>
						Foto {currentImageIndex + 1}/{card.images.length} 🔄
					</button>
				{/if}
			{:else}
				<div class="no-photo">Nessuna foto disponibile per questa scheda</div>
			{/if}
		</div>

		<!-- Step 0 Prompt -->
		{#if step === 0}
			<div class="prompt-box step-0">
				<p class="hint-text">🗣️ Guarda la foto e di' a voce di cosa si tratta.</p>
				<button class="duo-btn duo-btn-purple action-btn">
					<span>Tocca 1° volta: Mostra Titolo / Acronimo</span>
				</button>
			</div>
		{/if}

		<!-- Step 1: Title Revealed -->
		{#if step >= 1}
			<div class="reveal-section duo-card title-reveal">
				<span class="section-label">Titolo / Acronimo:</span>
				<h2 class="card-title">{card.title}</h2>
				{#if step === 1}
					<p class="hint-text">Ora tocca di nuovo per vedere a cosa serve.</p>
				{/if}
			</div>
		{/if}

		<!-- Step 2: Description Revealed -->
		{#if step === 2}
			<div class="reveal-section duo-card desc-reveal">
				<span class="section-label">A cosa serve / Descrizione:</span>
				<p class="card-desc">{card.description}</p>
			</div>
		{/if}
	</div>

	<!-- Controls -->
	<div class="controls">
		<button class="duo-btn duo-btn-gray nav-btn" onclick={onPrev} disabled={currentIndex === 0}>
			← Indietro
		</button>
		<button class="duo-btn duo-btn-green step-btn" onclick={advanceStep}>
			{#if step === 0}
				MOSTRA TITOLO (Click 1)
			{:else if step === 1}
				MOSTRA DESCRIZIONE (Click 2)
			{:else}
				RICOMINCIA SCHEDA
			{/if}
		</button>
		<button class="duo-btn duo-btn-blue nav-btn" onclick={onNext} disabled={currentIndex === totalCards - 1}>
			Avanti →
		</button>
	</div>
</div>

<style>
	.photo-study-container {
		width: 100%;
		max-width: 540px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.top-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.counter-text {
		font-family: 'Outfit', sans-serif;
		font-size: 0.9rem;
		font-weight: 800;
		color: var(--text-muted);
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

	.study-card {
		background: var(--card-bg);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		cursor: pointer;
	}

	.photo-wrapper {
		position: relative;
		width: 100%;
		border-radius: 16px;
		overflow: hidden;
		background-color: #000;
		min-height: 240px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--border-color);
	}

	.photo-main {
		width: 100%;
		max-height: 320px;
		object-fit: cover;
		display: block;
	}

	.img-badge {
		position: absolute;
		bottom: 12px;
		right: 12px;
		padding: 0.35rem 0.75rem;
		font-size: 0.75rem;
	}

	.no-photo {
		color: var(--text-muted);
		font-size: 0.9rem;
		padding: 2rem;
		text-align: center;
	}

	.prompt-box {
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.hint-text {
		color: var(--text-muted);
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.action-btn {
		width: 100%;
		font-size: 0.9rem;
	}

	.reveal-section {
		padding: 1.25rem;
		animation: fadeIn 0.3s ease;
	}

	.section-label {
		font-size: 0.75rem;
		font-weight: 900;
		text-transform: uppercase;
		color: var(--accent-color);
		letter-spacing: 0.05em;
		display: block;
		margin-bottom: 0.5rem;
	}

	.card-title {
		font-size: 2rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.card-desc {
		font-size: 1rem;
		line-height: 1.6;
		color: var(--text-color);
		margin: 0;
	}

	.controls {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.nav-btn {
		font-size: 0.85rem;
	}

	.step-btn {
		flex: 1;
		font-size: 0.95rem;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(6px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>

