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

	// Step 0: Only Photo visible
	// Step 1: Photo + Title visible
	// Step 2: Photo + Title + Description visible
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
		<span class="badge">Modalità Foto</span>
		<span class="counter">{currentIndex + 1} / {totalCards}</span>
	</div>

	<div
		class="study-card"
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
					<button class="img-badge" onclick={nextImage}>
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
				<button class="action-btn">
					<span>Tocca 1° volta: Mostra Titolo / Acronimo</span>
				</button>
			</div>
		{/if}

		<!-- Step 1: Title Revealed -->
		{#if step >= 1}
			<div class="reveal-section title-reveal">
				<span class="section-label">Titolo / Acronimo:</span>
				<h2 class="card-title">{card.title}</h2>
				{#if step === 1}
					<p class="hint-text">Ora tocca di nuovo per vedere a cosa serve.</p>
				{/if}
			</div>
		{/if}

		<!-- Step 2: Description Revealed -->
		{#if step === 2}
			<div class="reveal-section desc-reveal">
				<span class="section-label">A cosa serve / Descrizione:</span>
				<p class="card-desc">{card.description}</p>
			</div>
		{/if}
	</div>

	<!-- Controls -->
	<div class="controls">
		<button class="nav-btn" onclick={onPrev} disabled={currentIndex === 0}>
			← Indietro
		</button>
		<button class="step-btn" onclick={advanceStep}>
			{#if step === 0}
				Mostra Titolo (Click 1)
			{:else if step === 1}
				Mostra Descrizione (Click 2)
			{:else}
				Ricomincia Scheda
			{/if}
		</button>
		<button class="nav-btn" onclick={onNext} disabled={currentIndex === totalCards - 1}>
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

	.badge {
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		background-color: var(--accent-light-bg);
		color: var(--accent-color);
		border: 1px solid var(--border-color);
	}

	.counter {
		font-size: 0.875rem;
		color: var(--text-muted);
		font-weight: 600;
	}

	.study-card {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 24px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		cursor: pointer;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
		transition: transform 0.2s ease, border-color 0.2s ease;
	}

	.study-card:hover {
		border-color: var(--accent-color);
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
		background: rgba(15, 23, 42, 0.85);
		backdrop-filter: blur(8px);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.2);
		padding: 0.35rem 0.75rem;
		border-radius: 20px;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
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
		background: var(--card-bg-subtle);
		border: 1px dashed var(--accent-color);
		color: var(--accent-color);
		padding: 0.75rem 1rem;
		border-radius: 12px;
		font-weight: 700;
		font-size: 0.85rem;
	}

	.reveal-section {
		background: var(--card-bg-subtle);
		padding: 1.25rem;
		border-radius: 16px;
		border: 1px solid var(--border-color);
		animation: fadeIn 0.3s ease;
	}

	.section-label {
		font-size: 0.75rem;
		font-weight: 700;
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

	.nav-btn, .step-btn {
		padding: 0.85rem 1.25rem;
		border-radius: 14px;
		font-weight: 700;
		font-size: 0.95rem;
		border: 1px solid var(--border-color);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.nav-btn {
		background: var(--card-bg);
		color: var(--text-color);
	}

	.nav-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.step-btn {
		flex: 1;
		background: linear-gradient(135deg, var(--accent-color), #0284c7);
		color: white;
		border: none;
		box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(6px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
