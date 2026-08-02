<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { statsStore, type StatsData } from '$lib/stores/statsStore';
	import { tts } from '$lib/utils/tts';
	import type { Card } from '$lib/types/cards';

	let cards = $state<Card[]>([]);
	let activeTab = $state<'missions' | 'reels'>('missions');
	let flippedMap = $state<Record<string, boolean>>({});
	let imageIndexMap = $state<Record<string, number>>({});
	let claimedMissions = $state<Record<string, boolean>>({});
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

	let missionsList = $derived([
		{
			id: 'm1',
			title: 'Guadagna 10 XP',
			desc: 'Rispondi ai quiz o studia le schede per accumulare XP.',
			current: Math.min(10, userXP),
			target: 10,
			reward: '+20 Gemme 💎',
			completed: userXP >= 10
		},
		{
			id: 'm2',
			title: 'Studia 5 Flashcard',
			desc: 'Rivela il retro di almeno 5 schede nella sezione Flashcard o Reels.',
			current: Math.min(5, stats.cardsStudied),
			target: 5,
			reward: '+15 XP ⚡',
			completed: stats.cardsStudied >= 5
		},
		{
			id: 'm3',
			title: 'Completa 3 Quiz',
			desc: 'Rispondi correttamente a 3 domande nel quiz a 5 opzioni.',
			current: Math.min(3, stats.quizCorrect),
			target: 3,
			reward: '+30 Gemme 💎',
			completed: stats.quizCorrect >= 3
		},
		{
			id: 'm4',
			title: 'Serie di 1 Giorno',
			desc: 'Effettua il login e studia oggi per mantenere la serie attiva.',
			current: Math.min(1, stats.streakDays),
			target: 1,
			reward: '+1 Giorno 🔥',
			completed: stats.streakDays >= 1
		}
	]);

	function claimReward(missionId: string) {
		claimedMissions[missionId] = true;
	}

	function toggleFlip(cardId: string) {
		flippedMap[cardId] = !flippedMap[cardId];
		if (flippedMap[cardId]) {
			statsStore.recordStudySession();
		}
	}

	function speakAudio(e: MouseEvent, card: Card) {
		e.stopPropagation();
		const isFlipped = flippedMap[card.id];
		const text = isFlipped ? `${card.title}. ${card.description}` : card.title;
		tts.speak(text);
	}

	function nextImage(e: MouseEvent, card: Card) {
		e.stopPropagation();
		if (card.images && card.images.length > 0) {
			const curr = imageIndexMap[card.id] || 0;
			imageIndexMap[card.id] = (curr + 1) % card.images.length;
		}
	}
</script>

<div class="missioni-page-container">
	<!-- Tab Selector -->
	<div class="duo-tab-bar">
		<button
			class="duo-tab-btn"
			class:active={activeTab === 'missions'}
			onclick={() => (activeTab = 'missions')}
		>
			<img src="/emoji/package_3d.png" alt="Missioni" class="tab-emoji" />
			MISSIONI GIORNALIERE
		</button>
		<button
			class="duo-tab-btn"
			class:active={activeTab === 'reels'}
			onclick={() => (activeTab = 'reels')}
		>
			<img src="/emoji/camera_3d.png" alt="Reels" class="tab-emoji" />
			REELS FERROVIARI
		</button>
	</div>

	{#if activeTab === 'missions'}
		<!-- 📦 MISSIONI GIORNALIERE DUOLINGO -->
		<div class="missions-card duo-card">
			<div class="missions-header">
				<img src="/emoji/package_3d.png" alt="Missioni" class="missions-icon-img" />
				<div class="missions-titles">
					<span class="missions-subtitle">SFIDE E OBIETTIVI</span>
					<h1 class="missions-heading">Missioni Giornaliere</h1>
					<p class="missions-desc">Completa le missioni quotidiane per sbloccare gemme ed XP!</p>
				</div>
			</div>

			<div class="missions-list">
				{#each missionsList as m}
					{@const isClaimed = claimedMissions[m.id]}
					{@const pct = Math.min(100, Math.round((m.current / m.target) * 100))}

					<div class="mission-row duo-card" class:completed-row={m.completed}>
						<div class="mission-main">
							<div class="mission-top">
								<h3 class="m-title">{m.title}</h3>
								<span class="m-reward">{m.reward}</span>
							</div>
							<p class="m-desc">{m.desc}</p>

							<div class="duo-progress-track">
								<div class="duo-progress-fill" style="width: {pct}%"></div>
							</div>
							<span class="m-count">{m.current} / {m.target}</span>
						</div>

						<div class="mission-action">
							{#if isClaimed}
								<span class="claimed-badge">Riscattato ✓</span>
							{:else if m.completed}
								<button class="duo-btn duo-btn-green claim-btn" onclick={() => claimReward(m.id)}>
									RISCATTA
								</button>
							{:else}
								<span class="lock-badge">In corso</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<div class="reels-cta-box">
				<p>Vuoi velocizzare il completamento delle missioni? Guarda i Reels ed esegui i ripassi!</p>
				<button class="duo-btn duo-btn-blue cta-btn" onclick={() => (activeTab = 'reels')}>
					APRI REELS FERROVIARI 🎬
				</button>
			</div>
		</div>
	{:else}
		<!-- 🎬 REELS FEED VERTICALE -->
		<div class="reels-feed-container">
			{#if cards.length > 0}
				{#each cards as card, index}
					{@const isFlipped = flippedMap[card.id] || false}
					{@const imgIdx = imageIndexMap[card.id] || 0}
					{@const hasImages = card.images && card.images.length > 0}

					<div class="reel-slide">
						<!-- Header Index Bar -->
						<div class="reel-top-bar">
							<span class="reel-badge">🎬 Reel Ferroviario</span>
							
							<div class="right-top-actions">
								<button class="audio-btn" onclick={(e) => speakAudio(e, card)}>
									🔊 Audio
								</button>
								<span class="reel-index">{index + 1} / {cards.length}</span>
							</div>
						</div>

						<!-- 3D Flipping Reel Card -->
						<div
							class="scene"
							onclick={() => toggleFlip(card.id)}
							role="button"
							tabindex="0"
							onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleFlip(card.id)}
						>
							<div class="card" class:is-flipped={isFlipped}>
								<!-- FRONT (Acronym / Title) -->
								<div class="card-face front">
									<div class="face-overlay"></div>
									
									{#if hasImages}
										<img src={card.images![imgIdx]} alt={card.title} class="bg-card-img" />
									{/if}

									<div class="front-content">
										{#if card.category}
											<span class="category-tag">{card.category}</span>
										{/if}

										<h1 class="card-title">{card.title}</h1>
										
										<div class="tap-flip-hint">
											<span>👇 Tocca la card per girarla</span>
										</div>
									</div>
								</div>

								<!-- BACK (Description + Photos) -->
								<div class="card-face back">
									<div class="back-content">
										<div class="back-header">
											<h2 class="card-title-small">{card.title}</h2>
											<span class="back-badge">Spiegazione</span>
										</div>

										<div class="description-box">
											<p>{card.description}</p>
										</div>

										{#if hasImages}
											<div class="gallery-section">
												<img src={card.images![imgIdx]} alt={card.title} class="back-img" />
												{#if card.images!.length > 1}
													<button class="next-img-btn" onclick={(e) => nextImage(e, card)}>
														Foto successiva ({imgIdx + 1}/{card.images!.length})
													</button>
												{/if}
											</div>
										{/if}

										<div class="tap-flip-hint back-hint">
											<span>Tocca per girare di nuovo</span>
										</div>
									</div>
								</div>
							</div>
						</div>

						<div class="reel-scroll-hint">
							<span class="swipe-text">Scorri verso l'alto per la prossima card ⬇️</span>
						</div>
					</div>
				{/each}
			{:else}
				<div class="empty-reels">Caricamento Reels...</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.missioni-page-container {
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

	.missions-card {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.missions-header {
		display: flex;
		gap: 1.25rem;
		align-items: center;
		padding-bottom: 1rem;
		border-bottom: 2px solid var(--border-color);
	}

	.missions-icon-img {
		width: 64px;
		height: 64px;
		object-fit: contain;
	}

	.missions-titles {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.missions-subtitle {
		font-size: 0.75rem;
		font-weight: 900;
		text-transform: uppercase;
		color: var(--yellow-color);
		letter-spacing: 0.08em;
	}

	.missions-heading {
		font-size: 1.6rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.missions-desc {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0;
	}

	.missions-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.mission-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
	}

	.mission-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.mission-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.m-title {
		font-size: 1rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.m-reward {
		font-size: 0.8rem;
		font-weight: 900;
		color: var(--yellow-color);
	}

	.m-desc {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0;
	}

	.duo-progress-track {
		width: 100%;
		height: 10px;
		background: var(--card-bg-subtle);
		border-radius: 9999px;
		overflow: hidden;
		border: 1px solid var(--border-color);
		margin-top: 0.25rem;
	}

	.duo-progress-fill {
		height: 100%;
		background: var(--green-color);
		border-radius: 9999px;
		transition: width 0.3s ease;
	}

	.m-count {
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--text-muted);
	}

	.mission-action {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.claim-btn {
		padding: 0.5rem 0.9rem;
		font-size: 0.8rem;
	}

	.claimed-badge {
		font-size: 0.75rem;
		font-weight: 900;
		color: var(--green-color);
		background: rgba(88, 204, 2, 0.15);
		padding: 0.3rem 0.65rem;
		border-radius: 8px;
	}

	.lock-badge {
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-muted);
	}

	.reels-cta-box {
		background: var(--card-bg-subtle);
		padding: 1.25rem;
		border-radius: 18px;
		border: 2px dashed var(--yellow-color);
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		text-align: center;
	}

	.reels-cta-box p {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0;
	}

	.cta-btn {
		width: 100%;
		font-size: 0.95rem;
	}

	/* REELS CSS */
	.reels-feed-container {
		width: 100%;
		height: calc(100vh - 170px);
		overflow-y: scroll;
		scroll-snap-type: y mandatory;
		border-radius: 28px;
		background: #090d16;
		position: relative;
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
		padding: 1.25rem;
		box-sizing: border-box;
		overflow: hidden;
	}

	.reel-top-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		z-index: 20;
	}

	.reel-badge {
		padding: 0.35rem 0.85rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 800;
		background: rgba(255, 255, 255, 0.15);
		backdrop-filter: blur(10px);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.right-top-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.audio-btn {
		padding: 0.3rem 0.65rem;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.2);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.3);
		color: white;
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
	}

	.reel-index {
		font-size: 0.85rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.8);
	}

	.scene {
		width: 100%;
		height: calc(100% - 90px);
		perspective: 1200px;
		cursor: pointer;
		margin: auto 0;
	}

	.card {
		width: 100%;
		height: 100%;
		position: relative;
		transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
		transform-style: preserve-3d;
	}

	.card.is-flipped {
		transform: rotateY(180deg);
	}

	.card-face {
		position: absolute;
		width: 100%;
		height: 100%;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		border-radius: 24px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
		overflow: hidden;
		box-sizing: border-box;
	}

	.card-face.front {
		background: linear-gradient(145deg, #1e293b, #0f172a);
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		padding: 2rem;
	}

	.bg-card-img {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		z-index: 0;
		filter: brightness(0.6);
	}

	.face-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1;
		background: linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.85) 100%);
	}

	.front-content {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.category-tag {
		align-self: flex-start;
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		color: #38bdf8;
		background: rgba(56, 189, 248, 0.25);
		padding: 0.25rem 0.75rem;
		border-radius: 8px;
	}

	.card-title {
		font-size: 3.2rem;
		font-weight: 900;
		color: white;
		margin: 0;
		line-height: 1.1;
		text-shadow: 0 4px 16px rgba(0, 0, 0, 0.7);
	}

	.tap-flip-hint {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		font-weight: 700;
		color: #cbd5e1;
		margin-top: 0.5rem;
	}

	.card-face.back {
		transform: rotateY(180deg);
		background: linear-gradient(145deg, #1e293b, #0f172a);
		padding: 1.75rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	.back-content {
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
		height: 100%;
		justify-content: space-between;
	}

	.back-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.card-title-small {
		font-size: 2rem;
		font-weight: 900;
		color: #38bdf8;
		margin: 0;
	}

	.back-badge {
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		color: #94a3b8;
		background: rgba(255, 255, 255, 0.1);
		padding: 0.2rem 0.6rem;
		border-radius: 6px;
	}

	.description-box {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 16px;
		padding: 1.25rem;
		font-size: 1.05rem;
		line-height: 1.6;
		color: white;
	}

	.gallery-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: center;
	}

	.back-img {
		width: 100%;
		max-height: 180px;
		object-fit: cover;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.next-img-btn {
		font-size: 0.75rem;
		padding: 0.35rem 0.75rem;
		border-radius: 8px;
		background: rgba(56, 189, 248, 0.2);
		color: #38bdf8;
		border: 1px solid rgba(56, 189, 248, 0.4);
		cursor: pointer;
	}

	.back-hint {
		justify-content: center;
		color: #94a3b8;
	}

	.reel-scroll-hint {
		z-index: 20;
		text-align: center;
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

	@keyframes bounce {
		0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
		40% { transform: translateY(-6px); }
		60% { transform: translateY(-3px); }
	}
</style>

