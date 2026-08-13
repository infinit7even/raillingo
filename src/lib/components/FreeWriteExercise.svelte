<script lang="ts">
	import { tick, onMount } from 'svelte';
	import type { Card, WritingSubMode } from '$lib/types/cards';
	import { statsStore } from '$lib/stores/statsStore';
	import { ignoredCardsStore } from '$lib/stores/ignoredCardsStore';

	let { card, subMode, onNext, currentIndex, totalCards } = $props<{
		card: Card;
		subMode: WritingSubMode;
		onNext: () => void;
		currentIndex: number;
		totalCards: number;
	}>();

	let userInput = $state('');
	let submitted = $state(false);
	let inputEl = $state<HTMLInputElement | HTMLTextAreaElement | null>(null);
	let isIgnored = $state(false);

	onMount(() => {
		const unsub = ignoredCardsStore.subscribe(() => {
			if (card) {
				isIgnored = ignoredCardsStore.isIgnored(card.id);
			}
		});
		return unsub;
	});

	$effect(() => {
		const _cardId = card.id;
		const _subMode = subMode;
		userInput = '';
		submitted = false;
		if (card) {
			isIgnored = ignoredCardsStore.isIgnored(card.id);
		}
		tick().then(() => {
			const isTouchDevice =
				typeof window !== 'undefined' &&
				(window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768);
			if (inputEl && !isTouchDevice) {
				inputEl.focus();
			}
		});
	});

	function calculateSimilarity(str1: string, str2: string): number {
		const clean1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
		const clean2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
		if (!clean1 || !clean2) return 0;
		if (clean1 === clean2) return 100;
		if (clean1.includes(clean2) || clean2.includes(clean1)) return 85;

		const words1 = new Set(clean1.split(' '));
		const words2 = new Set(clean2.split(' '));
		let matches = 0;
		for (const w of words1) {
			if (words2.has(w)) matches++;
		}
		const ratio = (matches * 2) / (words1.size + words2.size);
		return Math.round(ratio * 100);
	}

	let similarityScore = $derived.by<number>(() => {
		if (!submitted || !userInput.trim()) return 0;
		if (subMode === 'title-to-desc') {
			const scoreDesc = calculateSimilarity(userInput, card.description || '');
			return scoreDesc;
		} else {
			// desc-to-title or photo-to-title
			const scoreTitle = calculateSimilarity(userInput, card.title || '');
			const scoreFull = card.fullName ? calculateSimilarity(userInput, card.fullName) : 0;
			return Math.max(scoreTitle, scoreFull);
		}
	});

	async function toggleIgnored(e: MouseEvent) {
		e.stopPropagation();
		if (card) {
			await ignoredCardsStore.toggleIgnored(card.id);
			isIgnored = ignoredCardsStore.isIgnored(card.id);
		}
	}

	function handleSubmit(e?: Event) {
		if (e) e.preventDefault();
		if (!submitted && userInput.trim()) {
			submitted = true;
			statsStore.recordStudySession();
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			if (!submitted) {
				e.preventDefault();
				handleSubmit();
			} else {
				e.preventDefault();
				onNext();
			}
		}
	}
</script>

<div class="freewrite-container">
	<div class="header">
		<span class="duo-badge">
			{#if subMode === 'title-to-desc'}
				Acronimo ➔ Descrizione
			{:else if subMode === 'desc-to-title'}
				Descrizione ➔ Acronimo
			{:else}
				Foto ➔ Scrittura
			{/if}
		</span>

		<div class="header-right">
			<span class="counter-text">{currentIndex + 1} / {totalCards}</span>
			<button
				class="star-ignored-btn"
				class:ignored={isIgnored}
				onclick={toggleIgnored}
				title={isIgnored ? 'Card ignorata' : 'Ignora card durante il mescolaggio'}
			>
				★
			</button>
		</div>
	</div>

	<!-- Duolingo Progress Track -->
	<div class="duo-progress-track">
		<div class="duo-progress-fill" style="width: {((currentIndex + 1) / totalCards) * 100}%"></div>
	</div>

	<!-- Prompt Card -->
	<div class="prompt-card duo-card">
		{#if subMode === 'title-to-desc'}
			<span class="label">Acronimo / Titolo:</span>
			<h2 class="title">
				{card.title || card.fullName}
				{#if card.title && card.fullName}
					<span class="sub-title">({card.fullName})</span>
				{/if}
			</h2>
			<p class="instruction">✍️ Scrivi la descrizione o spiegazione di questa card:</p>
		{:else if subMode === 'desc-to-title'}
			<span class="label">Descrizione / Funzione:</span>
			<p class="desc-text">{card.description}</p>
			<p class="instruction">✍️ Digita l'acronimo o titolo corrispondente:</p>
		{:else if subMode === 'photo-to-title'}
			<span class="label">Foto Impianto / Mezzo:</span>
			{#if card.images && card.images.length > 0}
				<img src={card.images[0]} alt="Foto per esercizio" class="prompt-img" />
			{/if}
			<p class="instruction">✍️ Digita l'acronimo o titolo di questo elemento ferroviario:</p>
		{/if}
	</div>

	<!-- Form / Writing Input Area -->
	<form class="write-form" onsubmit={handleSubmit}>
		{#if subMode === 'title-to-desc'}
			<textarea
				bind:this={inputEl}
				bind:value={userInput}
				placeholder="Digita qui la descrizione a mano..."
				rows="4"
				class="duo-input input-textarea"
				disabled={submitted}
				onkeydown={handleKeyDown}
				autocomplete="off"
				spellcheck="false"
			></textarea>
		{:else}
			<input
				type="text"
				bind:this={inputEl}
				bind:value={userInput}
				placeholder="Digita qui l'acronimo o titolo..."
				class="duo-input input-field"
				disabled={submitted}
				onkeydown={handleKeyDown}
				autocomplete="off"
				spellcheck="false"
			/>
		{/if}

		{#if !submitted}
			<button type="submit" class="duo-btn duo-btn-blue submit-btn" disabled={!userInput.trim()}>
				⚡ VERIFICA RISPOSTA
			</button>
		{/if}
	</form>

	<!-- Reveal / Self-Verification Box -->
	{#if submitted}
		<div class="comparison-card duo-card">
			<div
				class="score-banner"
				class:score-high={similarityScore >= 70}
				class:score-med={similarityScore >= 40 && similarityScore < 70}
			>
				<span class="score-icon">
					{similarityScore >= 70 ? '🎯' : similarityScore >= 40 ? '👍' : '💡'}
				</span>
				<div class="score-info">
					<strong>Comprensione: {similarityScore}%</strong>
					<span>
						{similarityScore >= 70
							? 'Ottima memorizzazione!'
							: 'Confronta la tua risposta con il testo del database.'}
					</span>
				</div>
			</div>

			<div class="result-header">🎯 Risposta Ufficiale:</div>

			{#if subMode === 'title-to-desc'}
				{#if card.fullName}
					<div class="fullname-badge">{card.fullName}</div>
				{/if}
				<div class="exact-answer duo-card">{card.description}</div>
			{:else}
				<div class="exact-answer duo-card title-highlight">
					{card.title || card.fullName}
					{#if card.fullName && card.title}
						<div class="exact-fullname">- {card.fullName}</div>
					{/if}
				</div>
				<div class="exact-sub">{card.description}</div>
			{/if}

			<div class="user-recap duo-card">
				<span class="recap-label">La tua digitazione:</span>
				<p class="user-text">{userInput || '(Nessun testo digitato)'}</p>
			</div>

			<button class="duo-btn duo-btn-green next-btn" onclick={onNext}>
				PROSSIMA SCHEDA
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
		gap: 1.15rem;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.counter-text {
		font-size: 0.88rem;
		font-weight: 800;
		color: var(--text-muted);
	}

	.star-ignored-btn {
		background: none;
		border: none;
		font-size: 1.6rem;
		color: var(--text-muted);
		cursor: pointer;
		line-height: 1;
		padding: 0;
		transition: transform 0.2s ease, color 0.2s ease;
	}

	.star-ignored-btn.ignored {
		color: var(--yellow-color);
		transform: scale(1.25);
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
		border-radius: 20px;
		padding: 1.25rem;
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
		font-size: 2.3rem;
		font-weight: 900;
		margin: 0 0 0.6rem 0;
		color: var(--text-color);
	}

	.sub-title {
		font-size: 1.1rem;
		font-weight: 800;
		color: var(--text-muted);
		display: block;
	}

	.desc-text {
		font-size: 1.05rem;
		line-height: 1.6;
		color: var(--text-color);
		margin: 0 0 0.65rem 0;
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
		font-size: 0.88rem;
		font-weight: 700;
		color: var(--text-muted);
		margin: 0;
	}

	.write-form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.input-field,
	.input-textarea {
		width: 100%;
		box-sizing: border-box;
		font-size: 1.05rem;
		padding: 0.9rem 1.1rem;
		border-radius: 16px;
		border: 2px solid var(--border-color);
		background: var(--card-bg);
		color: var(--text-color);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.input-field:focus,
	.input-textarea:focus {
		border-color: var(--accent-color);
		box-shadow: 0 0 0 4px var(--accent-light-bg);
		outline: none;
	}

	.submit-btn {
		width: 100%;
		font-size: 1rem;
		padding: 0.9rem;
	}

	.comparison-card {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem;
		background: var(--card-bg);
		border-radius: 20px;
		animation: fadeIn 0.3s ease;
	}

	.score-banner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		border-radius: 14px;
		background: rgba(168, 85, 247, 0.15);
		border: 1.5px solid var(--accent-color);
		color: var(--text-color);
	}

	.score-banner.score-high {
		background: rgba(34, 197, 94, 0.15);
		border-color: var(--green-color);
	}

	.score-icon {
		font-size: 1.5rem;
	}

	.score-info strong {
		display: block;
		font-size: 0.95rem;
	}

	.score-info span {
		font-size: 0.8rem;
		color: var(--text-muted);
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
		background: var(--card-bg-subtle);
		border-left: 4px solid var(--accent-color);
		border-radius: 12px;
	}

	.exact-answer.title-highlight {
		font-size: 1.75rem;
		font-weight: 900;
		border-left-color: var(--green-color);
	}

	.exact-fullname {
		font-size: 1rem;
		font-weight: 800;
		color: var(--accent-color);
	}

	.exact-sub {
		font-size: 0.88rem;
		color: var(--text-muted);
		line-height: 1.45;
	}

	.user-recap {
		padding: 0.85rem;
		background: var(--card-bg-subtle);
		border-radius: 12px;
	}

	.recap-label {
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.user-text {
		color: var(--text-color);
		font-weight: 700;
		font-size: 0.95rem;
		margin: 0.2rem 0 0 0;
	}

	.next-btn {
		width: 100%;
		font-size: 1rem;
		padding: 0.9rem;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
