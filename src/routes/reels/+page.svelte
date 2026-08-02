<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { statsStore } from '$lib/stores/statsStore';
	import type { Card } from '$lib/types/cards';

	let cards = $state<Card[]>([]);
	let revealedMap = $state<Record<string, boolean>>({});
	let quizMap = $state<Record<string, { options: string[]; selected: string | null; isCorrect: boolean | null }>>({});

	onMount(() => {
		const unsubscribe = cardsStore.subscribe((c) => {
			cards = c;
			initQuizMap(c);
		});
		return unsubscribe;
	});

	function initQuizMap(cardList: Card[]) {
		const map: Record<string, { options: string[]; selected: string | null; isCorrect: boolean | null }> = {};
		for (const card of cardList) {
			const distractors = cardList
				.filter((c) => c.id !== card.id)
				.map((c) => c.description)
				.sort(() => 0.5 - Math.random())
				.slice(0, 2);

			const allOpts = [card.description, ...distractors].sort(() => 0.5 - Math.random());
			map[card.id] = {
				options: allOpts,
				selected: null,
				isCorrect: null
			};
		}
		quizMap = map;
	}

	function toggleReveal(cardId: string) {
		revealedMap[cardId] = !revealedMap[cardId];
		if (revealedMap[cardId]) {
			statsStore.recordStudySession();
		}
	}

	function selectOption(card: Card, optionText: string) {
		const current = quizMap[card.id];
		if (!current) return;

		const isCorrect = optionText === card.description;
		quizMap[card.id] = {
			...current,
			selected: optionText,
			isCorrect
		};

		statsStore.recordQuizAnswer(isCorrect);
	}
</script>

<div class="reels-feed-container">
	{#if cards.length > 0}
		{#each cards as card, index}
			{@const isRevealed = revealedMap[card.id] || false}
			{@const quizState = quizMap[card.id]}
			{@const hasImage = card.images && card.images.length > 0}

			<div class="reel-slide">
				<!-- Background Image or Gradient -->
				<div class="reel-bg-wrapper">
					{#if hasImage}
						<img src={card.images![0]} alt={card.title} class="reel-bg-img" />
						<div class="reel-overlay"></div>
					{:else}
						<div class="reel-bg-gradient"></div>
					{/if}
				</div>

				<!-- Header Badge & Index -->
				<div class="reel-top-bar">
					<span class="reel-badge">🎬 Reel Ferroviario</span>
					<span class="reel-index">{index + 1} / {cards.length}</span>
				</div>

				<!-- Main Reel Content -->
				<div class="reel-card-content">
					<div class="title-section">
						{#if card.category}
							<span class="category-tag">{card.category}</span>
						{/if}
						<h1 class="card-title">{card.title}</h1>
					</div>

					<!-- Interactive Section: Tap to Reveal Description OR Quiz -->
					{#if !isRevealed}
						<div class="reel-action-box">
							<p class="prompt-text">🗣️ Di' a voce di che si tratta, oppure scegli l'opzione corretta:</p>

							<!-- Inline Mini Quiz Choices -->
							{#if quizState}
								<div class="quiz-choices">
									{#each quizState.options as opt}
										{@const isSelected = quizState.selected === opt}
										{@const isRight = isSelected && quizState.isCorrect}
										{@const isWrong = isSelected && !quizState.isCorrect}

										<button
											class="choice-btn"
											class:right={isRight}
											class:wrong={isWrong}
											onclick={() => selectOption(card, opt)}
										>
											<span class="choice-text">{opt}</span>
											{#if isRight}
												<span class="icon">✓</span>
											{:else if isWrong}
												<span class="icon">✗</span>
											{/if}
										</button>
									{/each}
								</div>
							{/if}

							<button class="reveal-btn" onclick={() => toggleReveal(card.id)}>
								👁️ Mostra Spiegazione Completa
							</button>
						</div>
					{:else}
						<!-- Full Description Box -->
						<div class="reel-description-box">
							<span class="box-label">A cosa serve / Descrizione:</span>
							<p class="desc-text">{card.description}</p>

							{#if card.tags && card.tags.length > 0}
								<div class="tag-row">
									{#each card.tags as tag}
										<span class="tag">#{tag}</span>
									{/each}
								</div>
							{/if}

							<button class="hide-btn" onclick={() => toggleReveal(card.id)}>
								Nascondi
							</button>
						</div>
					{/if}
				</div>

				<!-- Scroll Hint Bottom -->
				<div class="reel-scroll-hint">
					<span class="swipe-text">Scorri verso l'alto ⬇️</span>
				</div>
			</div>
		{/each}
	{:else}
		<div class="empty-reels">Caricamento Reels Ferroviari...</div>
	{/if}
</div>

<style>
	.reels-feed-container {
		width: 100%;
		height: calc(100vh - 130px);
		overflow-y: scroll;
		scroll-snap-type: y mandatory;
		border-radius: 28px;
		background: #000;
		position: relative;
	}

	@media (min-width: 768px) {
		.reels-feed-container {
			max-width: 480px;
			margin: 0 auto;
			height: calc(100vh - 150px);
		}
	}

	.reel-slide {
		width: 100%;
		height: 100%;
		scroll-snap-align: start;
		scroll-snap-stop: always;
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 1.5rem;
		box-sizing: border-box;
		overflow: hidden;
	}

	.reel-bg-wrapper {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 0;
	}

	.reel-bg-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: brightness(0.65);
	}

	.reel-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.85) 100%);
	}

	.reel-bg-gradient {
		width: 100%;
		height: 100%;
		background: linear-gradient(145deg, #0f172a, #1e1b4b);
	}

	.reel-top-bar {
		position: relative;
		z-index: 10;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.reel-badge {
		padding: 0.35rem 0.85rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 800;
		background: rgba(255, 255, 255, 0.2);
		backdrop-filter: blur(10px);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.3);
	}

	.reel-index {
		font-size: 0.85rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.8);
	}

	.reel-card-content {
		position: relative;
		z-index: 10;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		margin-bottom: auto;
		margin-top: auto;
	}

	.title-section {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.category-tag {
		align-self: flex-start;
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		color: var(--accent-color);
		background: rgba(56, 189, 248, 0.2);
		padding: 0.2rem 0.6rem;
		border-radius: 8px;
	}

	.card-title {
		font-size: 2.8rem;
		font-weight: 900;
		color: white;
		margin: 0;
		line-height: 1.1;
		text-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
	}

	.reel-action-box {
		background: rgba(15, 23, 42, 0.85);
		backdrop-filter: blur(16px);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 20px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.prompt-text {
		font-size: 0.85rem;
		color: #cbd5e1;
		margin: 0;
	}

	.quiz-choices {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.choice-btn {
		padding: 0.75rem 1rem;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: white;
		font-size: 0.85rem;
		text-align: left;
		cursor: pointer;
		display: flex;
		justify-content: space-between;
		align-items: center;
		transition: all 0.2s ease;
	}

	.choice-btn.right {
		background: rgba(34, 197, 94, 0.3);
		border-color: #22c55e;
		color: #4ade80;
	}

	.choice-btn.wrong {
		background: rgba(239, 68, 68, 0.3);
		border-color: #ef4444;
		color: #f87171;
	}

	.reveal-btn {
		width: 100%;
		padding: 0.85rem;
		border-radius: 14px;
		background: linear-gradient(135deg, var(--accent-color), #0284c7);
		color: white;
		border: none;
		font-weight: 800;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.reel-description-box {
		background: rgba(15, 23, 42, 0.9);
		backdrop-filter: blur(20px);
		border: 1px solid var(--accent-color);
		border-radius: 20px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		animation: fadeIn 0.3s ease;
	}

	.box-label {
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		color: var(--accent-color);
	}

	.desc-text {
		font-size: 1.05rem;
		line-height: 1.5;
		color: white;
		margin: 0;
	}

	.tag-row {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.tag {
		font-size: 0.75rem;
		color: #cbd5e1;
		background: rgba(255, 255, 255, 0.1);
		padding: 0.15rem 0.5rem;
		border-radius: 6px;
	}

	.hide-btn {
		align-self: flex-end;
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.3);
		color: white;
		padding: 0.35rem 0.75rem;
		border-radius: 8px;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.reel-scroll-hint {
		position: relative;
		z-index: 10;
		text-align: center;
		padding-top: 0.5rem;
	}

	.swipe-text {
		font-size: 0.75rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.6);
		animation: bounce 2s infinite;
	}

	.empty-reels {
		color: white;
		text-align: center;
		padding: 4rem;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@keyframes bounce {
		0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
		40% { transform: translateY(-6px); }
		60% { transform: translateY(-3px); }
	}
</style>
