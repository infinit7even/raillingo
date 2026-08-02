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
		// Generate 5 options whenever targetCard changes
		generateOptions();
		selectedOptionId = null;
		wrongAttempts = new Set();
		isSolved = false;
	});

	function generateOptions() {
		// Correct option
		const correct: QuizOption = {
			id: targetCard.id,
			text: targetCard.description,
			isCorrect: true
		};

		// 4 random distractors from other cards
		const otherCards = allCards.filter((c) => c.id !== targetCard.id);
		const shuffledOthers = [...otherCards].sort(() => 0.5 - Math.random());
		const distractors: QuizOption[] = shuffledOthers.slice(0, 4).map((c) => ({
			id: c.id,
			text: c.description,
			isCorrect: false
		}));

		// Combine and shuffle 5 options
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
		<span class="badge">Quiz Scelta Multipla</span>
		<span class="counter">Domanda {currentIndex + 1} / {totalCards}</span>
	</div>

	<!-- Question Box -->
	<div class="question-card">
		<span class="question-label">Domanda:</span>
		<h2 class="question-title">Che cos'è <span>"{targetCard.title}"</span>?</h2>
	</div>

	<!-- 5 Choice Options -->
	<div class="options-list">
		{#each options as option, i}
			{@const isWrong = wrongAttempts.has(option.id)}
			{@const isRight = isSolved && option.isCorrect}
			
			<button
				class="option-btn"
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
					<div class="status-icon wrong">✗</div>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Feedback & Next Button -->
	<div class="quiz-footer">
		{#if isSolved}
			<div class="success-banner">
				🎉 Esatto! Hai selezionato la risposta corretta.
			</div>
			<button class="next-btn" onclick={onNext}>
				Prossima Domanda →
			</button>
		{:else if wrongAttempts.size > 0}
			<div class="retry-banner">
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

	.question-card {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 20px;
		padding: 1.5rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
	}

	.question-label {
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--accent-color);
		display: block;
		margin-bottom: 0.5rem;
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
		gap: 0.75rem;
	}

	.option-btn {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.25rem;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 16px;
		color: var(--text-color);
		font-size: 0.95rem;
		line-height: 1.5;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
	}

	.option-btn:hover:not(:disabled) {
		border-color: var(--accent-color);
		background: var(--hover-bg);
		transform: translateY(-1px);
	}

	.option-index {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		font-size: 0.85rem;
		flex-shrink: 0;
	}

	.option-text {
		flex: 1;
	}

	.option-btn.correct {
		background: rgba(34, 197, 94, 0.15);
		border-color: #22c55e;
		color: #15803d;
	}

	.option-btn.wrong {
		background: rgba(239, 68, 68, 0.15);
		border-color: #ef4444;
		color: #b91c1c;
		opacity: 0.7;
	}

	.status-icon {
		font-size: 1.2rem;
		font-weight: 900;
	}

	.status-icon.right {
		color: #22c55e;
	}

	.status-icon.wrong {
		color: #ef4444;
	}

	.quiz-footer {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.success-banner {
		background: rgba(34, 197, 94, 0.15);
		border: 1px solid #22c55e;
		color: #166534;
		padding: 1rem;
		border-radius: 14px;
		font-weight: 700;
		text-align: center;
	}

	.retry-banner {
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid #ef4444;
		color: #991b1b;
		padding: 0.75rem;
		border-radius: 12px;
		font-size: 0.9rem;
		font-weight: 600;
		text-align: center;
	}

	.next-btn {
		width: 100%;
		padding: 1rem;
		border-radius: 16px;
		background: linear-gradient(135deg, var(--accent-color), #0284c7);
		color: white;
		border: none;
		font-weight: 800;
		font-size: 1.05rem;
		cursor: pointer;
		box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);
		transition: transform 0.2s ease;
	}

	.next-btn:hover {
		transform: translateY(-2px);
	}
</style>
