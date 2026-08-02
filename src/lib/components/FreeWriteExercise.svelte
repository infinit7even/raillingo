<script lang="ts">
	import type { Card, WritingSubMode } from '$lib/types/cards';
	import { statsStore } from '$lib/stores/statsStore';

	let { card, subMode, onNext, currentIndex, totalCards } = $props<{
		card: Card;
		subMode: WritingSubMode;
		onNext: () => void;
		currentIndex: number;
		totalCards: number;
	}>();

	let userInput = $state('');
	let submitted = $state(false);

	$effect(() => {
		const _cardId = card.id;
		const _subMode = subMode;
		userInput = '';
		submitted = false;
	});

	function handleSubmit(e?: Event) {
		if (e) e.preventDefault();
		if (!submitted) {
			submitted = true;
			statsStore.recordStudySession();
		}
	}
</script>

<div class="freewrite-container">
	<div class="header">
		<span class="duo-badge">
			{#if subMode === 'title-to-desc'}
				Scrivi Descrizione
			{:else if subMode === 'desc-to-title'}
				Scrivi Acronimo
			{:else}
				Scrivi da Foto
			{/if}
		</span>
		<span class="counter-text">{currentIndex + 1} / {totalCards}</span>
	</div>

	<!-- Duolingo Progress Track -->
	<div class="duo-progress-track">
		<div class="duo-progress-fill" style="width: {((currentIndex + 1) / totalCards) * 100}%"></div>
	</div>

	<!-- Prompt Box -->
	<div class="prompt-card duo-card">
		{#if subMode === 'title-to-desc'}
			<span class="label">Acronimo / Titolo:</span>
			<h2 class="title">{card.title}</h2>
			<p class="instruction">✍️ Scrivi a mano cosa significa o a cosa serve questo termine:</p>
		{:else if subMode === 'desc-to-title'}
			<span class="label">Descrizione / Funzione:</span>
			<p class="desc-text">{card.description}</p>
			<p class="instruction">✍️ Scrivi l'acronimo o titolo corrispondente:</p>
		{:else if subMode === 'photo-to-title'}
			<span class="label">Foto Impianto / Mezzo:</span>
			{#if card.images && card.images.length > 0}
				<img src={card.images[0]} alt="Foto per esercizio" class="prompt-img" />
			{/if}
			<p class="instruction">✍️ Scrivi a mano cos'è questo elemento ferroviario:</p>
		{/if}
	</div>

	<!-- Form / Input Area -->
	<form class="write-form" onsubmit={handleSubmit}>
		{#if subMode === 'title-to-desc'}
			<textarea
				bind:value={userInput}
				placeholder="Scrivi qui la descrizione..."
				rows="4"
				class="duo-input input-textarea"
				disabled={submitted}
			></textarea>
		{:else}
			<input
				type="text"
				bind:value={userInput}
				placeholder="Scrivi qui la risposta..."
				class="duo-input input-field"
				disabled={submitted}
			/>
		{/if}

		{#if !submitted}
			<button type="submit" class="duo-btn duo-btn-blue submit-btn" disabled={!userInput.trim()}>
				INVIA RISPOSTA & VERIFICA
			</button>
		{/if}
	</form>

	<!-- Reveal / Self-Verification Box -->
	{#if submitted}
		<div class="comparison-card duo-card">
			<div class="result-header">
				🎯 Risposta Esatta del Database:
			</div>

			{#if subMode === 'title-to-desc'}
				<div class="exact-answer duo-card">{card.description}</div>
			{:else}
				<div class="exact-answer duo-card title-highlight">{card.title}</div>
				<div class="exact-sub">{card.description}</div>
			{/if}

			<div class="user-recap">
				<strong>La tua risposta:</strong>
				<p class="user-text">{userInput || '(Nessun testo inserito)'}</p>
			</div>

			<button class="duo-btn duo-btn-green next-btn" onclick={onNext}>
				PROSSIMA SCHEDA →
			</button>
		</div>
	{/if}
</div>

<style>
	.freewrite-container {
		width: 100%;
		max-width: 580px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.header {
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

	.prompt-card {
		background: var(--card-bg);
	}

	.label {
		font-size: 0.75rem;
		font-weight: 900;
		text-transform: uppercase;
		color: var(--accent-color);
		display: block;
		margin-bottom: 0.4rem;
	}

	.title {
		font-size: 2.2rem;
		font-weight: 900;
		margin: 0 0 0.75rem 0;
		color: var(--text-color);
	}

	.desc-text {
		font-size: 1.05rem;
		line-height: 1.6;
		color: var(--text-color);
		margin: 0 0 0.75rem 0;
	}

	.prompt-img {
		width: 100%;
		max-height: 220px;
		object-fit: cover;
		border-radius: 14px;
		margin-bottom: 0.75rem;
		border: 2px solid var(--border-color);
	}

	.instruction {
		font-size: 0.9rem;
		color: var(--text-muted);
		margin: 0;
	}

	.write-form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.input-field, .input-textarea {
		width: 100%;
		box-sizing: border-box;
	}

	.submit-btn {
		width: 100%;
		font-size: 1rem;
	}

	.comparison-card {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		animation: fadeIn 0.3s ease;
	}

	.result-header {
		font-weight: 900;
		color: var(--accent-color);
		font-size: 0.95rem;
	}

	.exact-answer {
		padding: 1rem;
		font-size: 1.05rem;
		line-height: 1.6;
		color: var(--text-color);
		border-left: 4px solid var(--accent-color);
	}

	.exact-answer.title-highlight {
		font-size: 1.75rem;
		font-weight: 900;
		border-left-color: var(--green-color);
	}

	.exact-sub {
		font-size: 0.9rem;
		color: var(--text-muted);
	}

	.user-recap {
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.user-text {
		color: var(--text-color);
		font-style: italic;
		margin: 0.25rem 0 0 0;
	}

	.next-btn {
		width: 100%;
		font-size: 1rem;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(6px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>

