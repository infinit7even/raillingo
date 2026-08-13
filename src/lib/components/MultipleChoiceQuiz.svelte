<script lang="ts">
	import { onMount } from 'svelte';
	import type { Card } from '$lib/types/cards';
	import { statsStore } from '$lib/stores/statsStore';
	import { ignoredCardsStore } from '$lib/stores/ignoredCardsStore';
	import { toastStore } from '$lib/stores/toastStore';

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
	let questionTitle = $state('');
	let ignoredIds = $state<Set<string>>(new Set());

	onMount(() => {
		const unsub = ignoredCardsStore.subscribe((ids) => {
			ignoredIds = ids;
		});
		return unsub;
	});

	let isIgnored = $derived(targetCard ? ignoredIds.has(targetCard.id) : false);

	$effect(() => {
		if (targetCard) {
			generateOptions();
			selectedOptionId = null;
			wrongAttempts = new Set();
			isSolved = false;
		}
	});

	function shuffle<T>(items: T[]): T[] {
		const arr = [...items];
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		return arr;
	}

	function generateOptions() {
		if (!targetCard) return;

		// Question format: "Che cos'è: [Titolo oppure Acronimo]"
		const labelTerm = targetCard.title || targetCard.fullName;
		questionTitle = `Che cos'è: ${labelTerm}`;

		// Distractors from other cards (using their descriptions)
		const otherCards = allCards.filter((c: Card) => c.id !== targetCard.id && c.description);
		const shuffledOthers = shuffle<Card>(otherCards);

		const correctOption: QuizOption = {
			id: targetCard.id,
			text: targetCard.description,
			isCorrect: true
		};

		const distractorOptions: QuizOption[] = shuffledOthers.slice(0, 4).map((c: Card) => ({
			id: c.id,
			text: c.description,
			isCorrect: false
		}));

		options = shuffle([correctOption, ...distractorOptions]);
	}

	async function toggleIgnored(e: MouseEvent) {
		e.stopPropagation();
		if (!targetCard) return;

		const cardToToggle = targetCard;
		const isNowIgnored = await ignoredCardsStore.toggleIgnored(cardToToggle.id);

		toastStore.show({
			message: isNowIgnored ? '⭐ Scheda ignorata dal ripasso' : '✨ Scheda riattivata nel ripasso',
			actionLabel: 'Annulla',
			onAction: async () => {
				await ignoredCardsStore.toggleIgnored(cardToToggle.id);
			}
		});

		if (isNowIgnored) {
			setTimeout(() => {
				if (targetCard && targetCard.id === cardToToggle.id && ignoredCardsStore.isIgnored(cardToToggle.id)) {
					onNext();
				}
			}, 900);
		}
	}

	function handleOptionClick(opt: QuizOption) {
		if (isSolved) return;

		selectedOptionId = opt.id;

		if (opt.isCorrect) {
			isSolved = true;
			statsStore.recordQuizAnswer(true);

			// Automatically pass to next question after 0.5s (500ms)
			setTimeout(() => {
				onNext();
			}, 500);
		} else {
			wrongAttempts = new Set(wrongAttempts).add(opt.id);
			statsStore.recordQuizAnswer(false);
		}
	}
</script>

<div class="quiz-container">
	<!-- Duolingo Progress Track -->
	<div class="duo-progress-track">
		<div class="duo-progress-fill" style="width: {((currentIndex + 1) / totalCards) * 100}%"></div>
	</div>

	<!-- Question Box with Star Ignored Button -->
	<div class="question-card duo-card">
		<button
			class="question-star-btn"
			class:ignored={isIgnored}
			onclick={toggleIgnored}
			title={isIgnored ? 'Card ignorata (Clicca per riattivare)' : 'Ignora card durante il mescolaggio'}
			aria-label="Ignora card"
		>
			★
		</button>

		<span class="question-badge-label">Domanda:</span>
		<h2 class="question-title">{questionTitle}</h2>
	</div>

	<!-- 5 Choice Options -->
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
</div>

<style>
	.quiz-container {
		width: 100%;
		max-width: 600px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
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
		position: relative;
		padding-right: 3rem;
	}

	.question-star-btn {
		position: absolute;
		top: 1rem;
		right: 1rem;
		background: none;
		border: none;
		font-size: 1.6rem;
		color: var(--text-muted);
		cursor: pointer;
		line-height: 1;
		padding: 0.25rem;
		transition: transform 0.2s ease, color 0.2s ease;
	}

	.question-star-btn.ignored {
		color: var(--yellow-color);
		transform: scale(1.25);
		filter: drop-shadow(0 0 6px rgba(250, 204, 21, 0.5));
	}

	.question-badge-label {
		font-size: 0.78rem;
		font-weight: 900;
		text-transform: uppercase;
		color: var(--accent-color);
		letter-spacing: 0.06em;
		display: block;
		margin-bottom: 0.3rem;
	}

	.question-title {
		font-size: 1.6rem;
		font-weight: 900;
		margin: 0;
		color: var(--text-color);
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

	@media (max-height: 850px) {
		.quiz-container {
			gap: 0.75rem;
		}

		.question-card {
			padding: 0.75rem 3rem 0.75rem 1rem;
		}

		.question-title {
			font-size: 1.3rem;
		}

		.options-list {
			gap: 0.45rem;
		}

		.duo-option-btn {
			padding: 0.6rem 0.9rem;
			font-size: 0.88rem;
			border-radius: 14px;
		}

		.option-index {
			width: 26px;
			height: 26px;
			font-size: 0.8rem;
		}
	}
</style>
