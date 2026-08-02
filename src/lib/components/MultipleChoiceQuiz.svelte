<script lang="ts">
	import type { Card } from '$lib/types/cards';
	import { statsStore } from '$lib/stores/statsStore';

	let { targetCard, allCards, onNext, currentIndex, totalCards } = $props<{
		targetCard: Card;
		allCards: Card[];
		onNext: () => void;
		currentIndex: number;
		totalCards: number;
	}>();

	interface QuizOption {
		id: string;
		text: string;
		isCorrect: boolean;
	}

	let options = $state<QuizOption[]>([]);
	let selectedOptionId = $state<string | null>(null);
	let wrongAttempts = $state<Set<string>>(new Set());
	let isSolved = $state(false);

	$effect(() => {
		generateOptions();
		selectedOptionId = null;
		wrongAttempts = new Set();
		isSolved = false;
	});

	function generateOptions() {
		const correct: QuizOption = {
			id: targetCard.id,
			text: targetCard.description,
			isCorrect: true
		};

		const otherCards = allCards.filter((c: Card) => c.id !== targetCard.id);
		const shuffledOthers = [...otherCards].sort(() => 0.5 - Math.random());
		const distractors: QuizOption[] = shuffledOthers.slice(0, 4).map((c: Card) => ({
			id: c.id,
			text: c.description,
			isCorrect: false
		}));

		const combined = [correct, ...distractors].sort(() => 0.5 - Math.random());
		options = combined;
	}

	function handleOptionClick(opt: QuizOption) {
		if (isSolved) return;

		selectedOptionId = opt.id;

		if (opt.isCorrect) {
			isSolved = true;
			statsStore.recordQuizAnswer(true);
		} else {
			wrongAttempts = new Set(wrongAttempts).add(opt.id);
			statsStore.recordQuizAnswer(false);
		}
	}
</script>

<div class="quiz-container">
	<div class="quiz-header">
		<span class="duo-badge">Quiz Scelta Multipla</span>
		<span class="counter-text">Domanda {currentIndex + 1} / {totalCards}</span>
	</div>

	<!-- Duolingo Progress Track -->
	<div class="duo-progress-track">
		<div class="duo-progress-fill" style="width: {((currentIndex + 1) / totalCards) * 100}%"></div>
	</div>

	<!-- Question Box -->
	<div class="question-card duo-card">
		<span class="question-label">Domanda:</span>
		<h2 class="question-title">Che cos'è <span>"{targetCard.title}"</span>?</h2>
	</div>

	<!-- 5 Choice Options with 3D Duolingo Buttons -->
	<div class="options-list">
		{#each options as option, i}
			{@const isWrong = wrongAttempts.has(option.id)}
			{@const isRight = isSolved && option.isCorrect}
			
			<button
				class="duo-option-btn duo-card"
				class:correct={isRight}
				class:wrong={isWrong}
				disabled={isRight}
				onclick={() => handleOptionClick(option)}
			>
				<div class="option-index">{i + 1}</div>
				<div class="option-text">{option.text}</div>
				{#if isRight}
					<div class="status-icon right">✓</div>
				{:else if isWrong}
					<div class="status-icon wrong">✕</div>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Feedback & Next Button -->
	<div class="quiz-footer">
		{#if isSolved}
			<div class="success-banner duo-card">
				🎉 Esatto! Hai selezionato la risposta corretta.
			</div>
			<button class="duo-btn duo-btn-green next-btn" onclick={onNext}>
				PROSSIMA DOMANDA →
			</button>
		{:else if wrongAttempts.size > 0}
			<div class="retry-banner duo-card">
				❌ Risposta errata! Riprova pure (tentativi infiniti disponibili).
			</div>
		{/if}
	</div>
</div>

<style>
	.quiz-container {
		width: 100%;
		max-width: 600px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.quiz-header {
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

	.question-card {
		background: var(--card-bg);
	}

	.question-label {
		font-size: 0.8rem;
		font-weight: 900;
		text-transform: uppercase;
		color: var(--accent-color);
		display: block;
		margin-bottom: 0.4rem;
	}

	.question-title {
		font-size: 1.6rem;
		font-weight: 900;
		margin: 0;
		color: var(--text-color);
	}

	.question-title span {
		color: var(--accent-color);
	}

	.options-list {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.duo-option-btn {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.25rem;
		color: var(--text-color);
		font-size: 0.95rem;
		font-weight: 700;
		line-height: 1.5;
		text-align: left;
		cursor: pointer;
		user-select: none;
		border-radius: 18px;
		transition: all 0.15s ease;
	}

	.duo-option-btn:hover:not(:disabled) {
		border-color: var(--accent-color);
		background: var(--hover-bg);
		transform: translateY(-2px);
	}

	.duo-option-btn:active:not(:disabled) {
		transform: translateY(1px);
	}

	.option-index {
		width: 32px;
		height: 32px;
		border-radius: 10px;
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 900;
		font-size: 0.9rem;
		flex-shrink: 0;
	}

	.option-text {
		flex: 1;
	}

	.duo-option-btn.correct {
		background: rgba(88, 204, 2, 0.15);
		border-color: var(--green-color);
		border-bottom-color: var(--green-depth);
		color: var(--green-color);
	}

	.duo-option-btn.wrong {
		background: rgba(255, 75, 75, 0.15);
		border-color: var(--pink-color);
		border-bottom-color: var(--pink-depth);
		color: var(--pink-color);
		opacity: 0.85;
	}

	.status-icon {
		font-size: 1.3rem;
		font-weight: 900;
	}

	.status-icon.right {
		color: var(--green-color);
	}

	.status-icon.wrong {
		color: var(--pink-color);
	}

	.quiz-footer {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.success-banner {
		background: rgba(88, 204, 2, 0.15);
		border-color: var(--green-color);
		color: var(--green-color);
		padding: 1rem;
		font-weight: 800;
		text-align: center;
	}

	.retry-banner {
		background: rgba(255, 75, 75, 0.15);
		border-color: var(--pink-color);
		color: var(--pink-color);
		padding: 0.85rem;
		font-size: 0.9rem;
		font-weight: 800;
		text-align: center;
	}

	.next-btn {
		width: 100%;
		font-size: 1rem;
	}
</style>

