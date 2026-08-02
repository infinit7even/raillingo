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
		<span class="badge">
			{#if subMode === 'title-to-desc'}
				Scrivi Descrizione
			{:else if subMode === 'desc-to-title'}
				Scrivi Acronimo
			{:else}
				Scrivi da Foto
			{/if}
		</span>
		<span class="counter">{currentIndex + 1} / {totalCards}</span>
	</div>

	<!-- Prompt Box -->
	<div class="prompt-card">
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
				class="input-textarea"
				disabled={submitted}
			></textarea>
		{:else}
			<input
				type="text"
				bind:value={userInput}
				placeholder="Scrivi qui la risposta..."
				class="input-field"
				disabled={submitted}
			/>
		{/if}

		{#if !submitted}
			<button type="submit" class="submit-btn" disabled={!userInput.trim()}>
				Invia Risposta & Verifica
			</button>
		{/if}
	</form>

	<!-- Reveal / Self-Verification Box -->
	{#if submitted}
		<div class="comparison-card">
			<div class="result-header">
				🎯 Risposta Esatta del Database:
			</div>

			{#if subMode === 'title-to-desc'}
				<div class="exact-answer">{card.description}</div>
			{:else}
				<div class="exact-answer title-highlight">{card.title}</div>
				<div class="exact-sub">{card.description}</div>
			{/if}

			<div class="user-recap">
				<strong>La tua risposta:</strong>
				<p class="user-text">{userInput || '(Nessun testo inserito)'}</p>
			</div>

			<button class="next-btn" onclick={onNext}>
				Prossima Scheda →
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

	.prompt-card {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 20px;
		padding: 1.5rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
	}

	.label {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--accent-color);
		display: block;
		margin-bottom: 0.5rem;
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
	}

	.instruction {
		font-size: 0.9rem;
		color: var(--text-muted);
		margin: 0;
	}

	.write-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.input-field, .input-textarea {
		width: 100%;
		padding: 1rem;
		border-radius: 16px;
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		color: var(--text-color);
		font-size: 1rem;
		font-family: inherit;
		box-sizing: border-box;
		transition: border-color 0.2s ease;
	}

	.input-field:focus, .input-textarea:focus {
		outline: none;
		border-color: var(--accent-color);
	}

	.submit-btn {
		padding: 1rem;
		border-radius: 16px;
		background: linear-gradient(135deg, var(--accent-color), #0284c7);
		color: white;
		border: none;
		font-weight: 800;
		font-size: 1rem;
		cursor: pointer;
		box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);
	}

	.submit-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.comparison-card {
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		border-radius: 20px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		animation: fadeIn 0.3s ease;
	}

	.result-header {
		font-weight: 800;
		color: var(--accent-color);
		font-size: 0.95rem;
	}

	.exact-answer {
		background: var(--card-bg);
		padding: 1rem;
		border-radius: 12px;
		border-left: 4px solid var(--accent-color);
		font-size: 1.05rem;
		line-height: 1.6;
		color: var(--text-color);
	}

	.exact-answer.title-highlight {
		font-size: 1.75rem;
		font-weight: 900;
		border-left-color: #22c55e;
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
		padding: 0.9rem;
		border-radius: 14px;
		background: var(--card-bg);
		color: var(--text-color);
		border: 1px solid var(--border-color);
		font-weight: 700;
		cursor: pointer;
	}

	.next-btn:hover {
		border-color: var(--accent-color);
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(6px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
