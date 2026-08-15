<script lang="ts">
	import { onMount } from 'svelte';
	import { statsStore, type StatsData } from '$lib/stores/statsStore';

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
		const unstats = statsStore.subscribe((s) => (stats = s));
		return unstats;
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

	let { data } = $props<{ data?: { user?: { username: string; email?: string } | null } }>();
	let user = $derived(data?.user || null);

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		window.location.href = '/';
	}

	function claimReward(missionId: string) {
		claimedMissions[missionId] = true;
	}
</script>

<div class="missioni-page-container duo-card">
	<div class="missions-header">
		<img src="/emoji/package_3d.png" alt="Missioni" class="missions-icon-img" />
		<div class="missions-titles">
			<span class="missions-subtitle">SFIDE E OBIETTIVI</span>
			<h1 class="missions-heading">Missioni Giornaliere</h1>
			<p class="missions-desc">Completa le missioni quotidiane per sbloccare gemme ed XP!</p>
		</div>
	</div>

	<!-- Box opzionale Sincronizzazione / Salvataggio Progressi DB -->
	<div class="sync-progress-box duo-card">
		{#if user}
			<div class="sync-info-row">
				<div class="sync-text-col">
					<span class="sync-status-text"
						>✅ Progressi sincronizzati per <strong>{user.username}</strong></span
					>
					<span class="sync-caption-text"
						>I tuoi progressi vengono salvati automaticamente e sincronizzati su tutti i
						dispositivi.</span
					>
				</div>
				<button class="duo-btn duo-btn-gray sync-btn" onclick={logout}> DISCONNETTI </button>
			</div>
		{:else}
			<div class="sync-info-row">
				<div class="sync-text-col">
					<span class="sync-desc-text">Salva i tuoi progressi, fai il login</span>
					<span class="sync-caption-text"
						>Accedi con Discord per sincronizzare serie, gemme e XP su tutti i tuoi dispositivi.</span
					>
				</div>
				<a href="/api/auth/login?returnUrl=/missioni" class="duo-btn sync-btn discord-sync-btn">
					<svg
						class="discord-icon-mini"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 127.14 96.36"
						fill="currentColor"
					>
						<path
							d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.92,53.87,53,48.8,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.92,96.1,53,91,65.69,84.69,65.69Z"
						/>
					</svg>
					ACCEDI CON DISCORD
				</a>
			</div>
		{/if}
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
		<a href="/" class="duo-btn duo-btn-blue cta-btn"> TORNA ALLA HOME </a>
	</div>
</div>

<style>
	.missioni-page-container {
		max-width: 620px;
		margin: 0 auto;
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

	.sync-progress-box {
		padding: 1rem 1.25rem;
	}

	.sync-info-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.sync-text-col {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.sync-caption-text {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
		line-height: 1.35;
	}

	.sync-desc-text,
	.sync-status-text {
		font-size: 0.95rem;
		font-weight: 800;
		color: var(--text-color);
	}

	.sync-btn {
		font-size: 0.8rem;
		padding: 0.5rem 0.9rem;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.discord-sync-btn {
		background-color: #5865f2;
		color: white;
		border-bottom: 4px solid #4752c4;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		transition:
			filter 0.15s ease,
			transform 0.1s ease;
	}

	.discord-sync-btn:hover {
		filter: brightness(1.1);
	}

	.discord-sync-btn:active {
		transform: translateY(2px);
		border-bottom-width: 2px;
	}

	.discord-icon-mini {
		width: 18px;
		height: 18px;
	}

	.reels-cta-box {
		padding-top: 0.5rem;
	}

	.cta-btn {
		width: 100%;
		font-size: 0.95rem;
		text-align: center;
		text-decoration: none;
	}
</style>
