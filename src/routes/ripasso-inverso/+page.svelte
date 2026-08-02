<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import type { Card } from '$lib/types/cards';
	import { statsStore } from '$lib/stores/statsStore';

	let cards = $state<Card[]>([]);
	let currentIndex = $state(0);
	let revealed = $state(false);

	onMount(() => {
		const unsubscribe = cardsStore.subscribe((c) => (cards = c));
		return unsubscribe;
	});

	$effect(() => {
		// Reset state when index changes
		revealed = false;
	});

	function toggleReveal() {
		revealed = !revealed;
		if (revealed) {
			statsStore.recordStudySession();
		}
	}

	function handleNext() {
		if (currentIndex < cards.length - 1) {
			currentIndex++;
		}
	}

	function handlePrev() {
		if (currentIndex > 0) {
			currentIndex--;
		}
	}
</script>

<div class="mode-page">
	{#if cards.length > 0}
		{@const currentCard = cards[currentIndex]}

		<div class="reverse-container">
			<div class="top-bar">
				<span class="badge">Ripasso Inverso</span>
				<span class="counter">{currentIndex + 1} / {cards.length}</span>
			</div>

			<div
				class="study-card"
				onclick={toggleReveal}
				role="button"
				tabindex="0"
				onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleReveal()}
			>
				<span class="label">Descrizione / A cosa serve:</span>
				<p class="description-text">{currentCard.description}</p>

				{#if !revealed}
					<div class="prompt-box">
						<span>🗣️ Di' a voce l'acronimo, poi <strong>tocca per verificare</strong></span>
					</div>
				{:else}
					<div class="reveal-box">
						<span class="reveal-label">Acronimo / Titolo:</span>
						<h2 class="revealed-title">{currentCard.title}</h2>
					</div>
				{/if}
			</div>

			<div class="controls">
				<button class="nav-btn" onclick={handlePrev} disabled={currentIndex === 0}>
					← Indietro
				</button>
				<button class="action-btn" onclick={toggleReveal}>
					{revealed ? 'Nascondi' : 'Mostra Acronimo'}
				</button>
				<button class="nav-btn" onclick={handleNext} disabled={currentIndex === cards.length - 1}>
					Avanti →
				</button>
			</div>
		</div>
	{:else}
		<div class="empty-box">Caricamento delle schede...</div>
	{/if}
</div>

<style>
	.mode-page {
		padding: 1rem 0;
	}

	.reverse-container {
		width: 100%;
		max-width: 540px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
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
		font-weight: 600;
		color: var(--text-muted);
	}

	.study-card {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 24px;
		padding: 1.75rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		cursor: pointer;
		min-height: 320px;
		justify-content: space-between;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
		transition: transform 0.2s ease, border-color 0.2s ease;
	}

	.study-card:hover {
		border-color: var(--accent-color);
	}

	.label {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--accent-color);
		letter-spacing: 0.05em;
	}

	.description-text {
		font-size: 1.15rem;
		line-height: 1.6;
		color: var(--text-color);
		margin: 0;
	}

	.prompt-box {
		background: var(--card-bg-subtle);
		border: 1px dashed var(--accent-color);
		padding: 1rem;
		border-radius: 14px;
		text-align: center;
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.reveal-box {
		background: linear-gradient(135deg, var(--card-bg-subtle), var(--card-bg));
		border: 1px solid var(--accent-color);
		padding: 1.25rem;
		border-radius: 16px;
		text-align: center;
		animation: fadeIn 0.3s ease;
	}

	.reveal-label {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--accent-color);
		display: block;
		margin-bottom: 0.25rem;
	}

	.revealed-title {
		font-size: 2.4rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.controls {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.nav-btn, .action-btn {
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

	.action-btn {
		flex: 1;
		background: linear-gradient(135deg, var(--accent-color), #0284c7);
		color: white;
		border: none;
		box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);
	}

	.empty-box {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(6px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
