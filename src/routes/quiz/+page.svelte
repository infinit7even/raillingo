<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { statsStore, type StatsData } from '$lib/stores/statsStore';
	import MultipleChoiceQuiz from '$lib/components/MultipleChoiceQuiz.svelte';
	import type { Card } from '$lib/types/cards';

	let cards = $state<Card[]>([]);
	let currentIndex = $state(0);
	let activeTab = $state<'leaderboard' | 'quiz'>('leaderboard');
	let stats = $state<StatsData>({
		cardsStudied: 0,
		quizAnswered: 0,
		quizCorrect: 0,
		streakDays: 1,
		lastStudiedDate: '',
		favorites: []
	});

	onMount(() => {
		const uncards = cardsStore.subscribe((c) => (cards = c));
		const unstats = statsStore.subscribe((s) => (stats = s));
		return () => {
			uncards();
			unstats();
		};
	});

	let userXP = $derived(stats.quizCorrect * 15 + stats.cardsStudied * 5);

	let leaderboard = $derived([
		{ rank: 1, name: 'Marco RFI', xp: Math.max(520, userXP + 140), avatar: '👨‍✈️', isUser: false },
		{ rank: 2, name: 'Giulia Segnalamento', xp: Math.max(480, userXP + 60), avatar: '👩‍💼', isUser: false },
		{ rank: 3, name: 'Tu (Utente)', xp: userXP, avatar: '🚂', isUser: true },
		{ rank: 4, name: 'Alessandro Trazione', xp: 290, avatar: '👨‍🔧', isUser: false },
		{ rank: 5, name: 'Francesca Normativa', xp: 210, avatar: '👩‍🏫', isUser: false },
		{ rank: 6, name: 'Luca Macchinista', xp: 175, avatar: '👨‍✈️', isUser: false },
		{ rank: 7, name: 'Elena Capostazione', xp: 120, avatar: '👩‍💼', isUser: false }
	].sort((a, b) => b.xp - a.xp).map((item, idx) => ({ ...item, rank: idx + 1 })));

	function handleNext() {
		if (currentIndex < cards.length - 1) {
			currentIndex++;
		} else {
			currentIndex = 0;
		}
	}
</script>

<div class="classifiche-page-container">
	<!-- Tab Bar Selector -->
	<div class="duo-tab-bar">
		<button
			class="duo-tab-btn"
			class:active={activeTab === 'leaderboard'}
			onclick={() => (activeTab = 'leaderboard')}
		>
			<img src="/emoji/shield_3d.png" alt="Classifiche" class="tab-emoji" />
			CLASSIFFICHE LEGA
		</button>
		<button
			class="duo-tab-btn"
			class:active={activeTab === 'quiz'}
			onclick={() => (activeTab = 'quiz')}
		>
			<img src="/emoji/star_3d.png" alt="Quiz" class="tab-emoji" />
			QUIZ A 5 SCELTE
		</button>
	</div>

	{#if activeTab === 'leaderboard'}
		<!-- 🏆 LEADERBOARD VERO IN STILE DUOLINGO -->
		<div class="leaderboard-card duo-card">
			<div class="league-header">
				<img src="/emoji/shield_3d.png" alt="Lega Zaffiro" class="league-shield-img" />
				<div class="league-titles">
					<span class="league-subtitle">LEGA ZAFFIRO FERROVIARIA</span>
					<h1 class="league-heading">Classifica Settimanale</h1>
					<p class="league-desc">I primi 5 allievi avanzano alla Lega Diamante di domenica sera!</p>
				</div>
			</div>

			<div class="leaderboard-list">
				{#each leaderboard as player}
					<div class="player-row" class:user-row={player.isUser}>
						<div class="rank-box">
							{#if player.rank === 1}
								<span class="medal-gold">🥇 1</span>
							{:else if player.rank === 2}
								<span class="medal-silver">🥈 2</span>
							{:else if player.rank === 3}
								<span class="medal-bronze">🥉 3</span>
							{:else}
								<span class="rank-num">{player.rank}</span>
							{/if}
						</div>

						<div class="player-avatar">{player.avatar}</div>

						<div class="player-name-group">
							<span class="player-name">{player.name}</span>
							{#if player.isUser}
								<span class="user-pill">TU</span>
							{/if}
						</div>

						<div class="player-xp">
							<span class="xp-val">{player.xp}</span>
							<span class="xp-unit">XP</span>
						</div>
					</div>
				{/each}
			</div>

			<div class="quiz-cta-box">
				<p>Vuoi scalare la classifica? Rispondi ai quiz e guadagna +15 XP per ogni risposta corretta!</p>
				<button class="duo-btn duo-btn-green cta-btn" onclick={() => (activeTab = 'quiz')}>
					INIZIA QUIZ A 5 SCELTE (+15 XP)
				</button>
			</div>
		</div>
	{:else}
		<!-- 🎯 QUIZ A 5 SCELTE -->
		<div class="quiz-container">
			{#if cards.length >= 5}
				<MultipleChoiceQuiz
					targetCard={cards[currentIndex]}
					allCards={cards}
					currentIndex={currentIndex}
					totalCards={cards.length}
					onNext={handleNext}
				/>
			{:else if cards.length > 0}
				<div class="duo-card empty-box">
					Servono almeno 5 schede nel database per generare le opzioni del quiz. Attualmente ve ne sono {cards.length}.
				</div>
			{:else}
				<div class="duo-card empty-box">Caricamento quiz...</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.classifiche-page-container {
		max-width: 620px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.duo-tab-bar {
		display: flex;
		gap: 0.5rem;
		background: var(--card-bg-subtle);
		padding: 0.4rem;
		border-radius: 18px;
		border: 2px solid var(--border-color);
	}

	.duo-tab-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 0.75rem 1rem;
		border-radius: 14px;
		border: 2px solid transparent;
		background: none;
		color: var(--text-muted);
		font-family: 'Outfit', sans-serif;
		font-weight: 800;
		font-size: 0.85rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.duo-tab-btn.active {
		background: var(--card-bg);
		color: var(--accent-color);
		border-color: var(--accent-color);
		box-shadow: 0 4px 12px var(--shadow-color);
	}

	.tab-emoji {
		width: 22px;
		height: 22px;
		object-fit: contain;
	}

	.leaderboard-card {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.league-header {
		display: flex;
		gap: 1.25rem;
		align-items: center;
		padding-bottom: 1rem;
		border-bottom: 2px solid var(--border-color);
	}

	.league-shield-img {
		width: 64px;
		height: 64px;
		object-fit: contain;
	}

	.league-titles {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.league-subtitle {
		font-size: 0.75rem;
		font-weight: 900;
		text-transform: uppercase;
		color: var(--accent-color);
		letter-spacing: 0.08em;
	}

	.league-heading {
		font-size: 1.6rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.league-desc {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0;
	}

	.leaderboard-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.player-row {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.85rem 1rem;
		border-radius: 16px;
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		transition: transform 0.15s ease;
	}

	.player-row.user-row {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
	}

	.rank-box {
		width: 36px;
		font-weight: 900;
		font-size: 0.9rem;
		text-align: center;
	}

	.medal-gold { color: var(--yellow-color); font-weight: 900; }
	.medal-silver { color: #94a3b8; font-weight: 900; }
	.medal-bronze { color: #d97706; font-weight: 900; }
	.rank-num { color: var(--text-muted); }

	.player-avatar {
		font-size: 1.6rem;
	}

	.player-name-group {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.player-name {
		font-weight: 800;
		font-size: 0.95rem;
		color: var(--text-color);
	}

	.user-pill {
		font-size: 0.65rem;
		font-weight: 900;
		background: var(--accent-color);
		color: white;
		padding: 0.15rem 0.45rem;
		border-radius: 6px;
	}

	.player-xp {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
	}

	.xp-val {
		font-weight: 900;
		font-size: 1.1rem;
		color: var(--yellow-color);
	}

	.xp-unit {
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--text-muted);
	}

	.quiz-cta-box {
		background: var(--card-bg-subtle);
		padding: 1.25rem;
		border-radius: 18px;
		border: 2px dashed var(--accent-color);
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		text-align: center;
	}

	.quiz-cta-box p {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0;
	}

	.cta-btn {
		width: 100%;
		font-size: 0.95rem;
	}

	.empty-box {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
	}
</style>

