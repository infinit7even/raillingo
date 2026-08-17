<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { statsStore, type StatsData } from '$lib/stores/statsStore';
	import QuickAddCardModal from '$lib/components/QuickAddCardModal.svelte';
	import type { Card } from '$lib/types/cards';

	import { pwaStore } from '$lib/stores/pwaStore';
	import { loginWithDiscord, logoutUser } from '$lib/auth-client';

	let { data } = $props();

	function isAcronymCard(c: Card): boolean {
		if (!c.title || !c.title.trim()) return false;
		const title = c.title.trim();
		const fullName = c.fullName?.trim() || '';

		// Se fullName esiste ed è diverso dal titolo, è un acronimo con espansione (es. BEM -> Blocco Elettrico Manuale)
		if (fullName && fullName.toLowerCase() !== title.toLowerCase()) {
			return true;
		}

		// Se il titolo è lungo o contiene descrizioni di segnali visivi ("fisso", "lampeggiante", "spenta", "temporanea"), non è un acronimo
		if (title.length > 12) return false;
		const lower = title.toLowerCase();
		if (
			lower.includes('fisso') ||
			lower.includes('lampeggiante') ||
			lower.includes('alternat') ||
			lower.includes('spenta') ||
			lower.includes('temporanea') ||
			lower.includes('permanente')
		) {
			return false;
		}

		return true;
	}

	// Seed iniziale letto una sola volta dai dati del server (non reattivo)
	const seed = (() => {
		const list: Card[] = data.initialCards ?? [];
		const acronyms = list.filter(isAcronymCard);
		const pool = acronyms.length > 0 ? acronyms : list;
		const word = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
		return { list, word };
	})();

	let cards = $state<Card[]>(seed.list);
	let wordOfTheDay = $state<Card | null>(seed.word);
	let isQuickAddOpen = $state(false);
	let canInstall = $state(false);
	let isSpinning = $state(false);
	let isChangingWord = $state(false);
	let user = $derived(data.user);

	let stats = $state<StatsData>({
		cardsStudied: 0,
		quizAnswered: 0,
		quizCorrect: 0,
		streakDays: 1,
		lastStudiedDate: '',
		favorites: []
	});

	let acronymCards = $derived(cards.filter(isAcronymCard));

	function pickRandomWord(cardList: Card[]) {
		const pool = cardList.filter(isAcronymCard);
		const targetList = pool.length > 0 ? pool : cardList;
		if (targetList.length === 0) return;
		const randomIndex = Math.floor(Math.random() * targetList.length);
		wordOfTheDay = targetList[randomIndex];
	}

	function handleNextWord() {
		const pool = acronymCards.length > 0 ? acronymCards : cards;
		if (pool.length === 0 || isSpinning) return;
		isSpinning = true;
		isChangingWord = true;

		setTimeout(() => {
			pickRandomWord(cards);
			isChangingWord = false;
		}, 150);

		setTimeout(() => {
			isSpinning = false;
		}, 450);
	}

	onMount(() => {
		const uncards = cardsStore.subscribe((c) => {
			if (c.length > 0) {
				cards = c;
				if (!wordOfTheDay) {
					pickRandomWord(c);
				}
			}
		});
		const unstats = statsStore.subscribe((s) => (stats = s));
		const unpwa = pwaStore.subscribe(() => {
			canInstall = pwaStore.canInstall;
		});

		return () => {
			uncards();
			unstats();
			unpwa();
		};
	});

	async function handleInstallApp() {
		await pwaStore.promptInstall();
	}

	async function handleLogout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		window.location.href = '/';
	}

	const lessonNodes = [
		{
			id: 1,
			title: 'FLASHCARD',
			href: '/flashcard',
			icon: '/emoji/open_book_3d.png',
			state: 'active',
			offset: 0
		},
		{
			id: 2,
			title: 'QUIZ',
			href: '/quiz',
			icon: '/emoji/star_3d.png',
			state: 'unlocked',
			offset: -40
		},
		{
			id: 3,
			title: 'REELS',
			href: '/reels',
			icon: '/emoji/camera_3d.png',
			state: 'unlocked',
			offset: 35
		},
		{
			id: 4,
			title: 'WIKI',
			href: '/wiki',
			icon: '/emoji/books_3d.png',
			state: 'unlocked',
			offset: -35
		},
		{
			id: 5,
			title: 'APPUNTI',
			href: '/notes',
			icon: '/emoji/clipboard_3d.png',
			state: 'unlocked',
			offset: 0
		}
	];

	let totalXP = $derived(stats.quizCorrect * 15 + stats.cardsStudied * 5);
	let gems = $derived(stats.quizCorrect * 10 + 100);
</script>

<div class="duo-page-grid">
	<!-- 📍 MAIN CENTRAL COLUMN -->
	<div class="duo-main-column">
		<!--  Parola del Giorno Card -->
		{#if wordOfTheDay}
			<section class="word-of-day-section">
				<div class="duo-card word-of-day-card">
					<div class="wod-header">
						<div class="wod-badge">
							<span class="wod-icon">💡</span>
							<span class="wod-badge-text">PAROLA DEL GIORNO</span>
						</div>
						<div class="wod-header-actions">
							<button
								class="wod-action-btn"
								class:is-spinning={isSpinning}
								onclick={handleNextWord}
								disabled={isSpinning}
								title="Scopri un'altra parola"
							>
								<span class="dice-icon" class:spin={isSpinning}>🎲</span> Random
							</button>
						</div>
					</div>

					<div class="wod-content" class:wod-pop={isChangingWord}>
						<div class="wod-title-row">
							<h2 class="wod-title">{wordOfTheDay.title}</h2>
							{#if wordOfTheDay.fullName && wordOfTheDay.fullName.trim().toLowerCase() !== wordOfTheDay.title.trim().toLowerCase()}
								<span class="wod-fullname">{wordOfTheDay.fullName}</span>
							{/if}
						</div>

						<p class="wod-desc">{wordOfTheDay.description}</p>
					</div>
				</div>
			</section>
		{/if}

		<!-- 🎯 Widget Missioni Giornaliere -->
		<div class="duo-widget duo-card mobile-missions-widget">
			<div class="widget-header-row">
				<h3 class="widget-title">Missioni giornaliere</h3>
				<a href="/missions" class="widget-link">VEDI TUTTE &gt;</a>
			</div>
			<div class="mission-item">
				<img src="/emoji/high_voltage_3d.png" alt="XP" width="24" height="24" decoding="async" class="widget-emoji-img" />
				<div class="mission-info">
					<span class="mission-desc">Guadagna 10 XP</span>
					<div class="duo-progress-track">
						<div class="duo-progress-fill" style="width: {Math.min(100, totalXP * 10)}%"></div>
					</div>
					<span class="mission-count">{Math.min(10, totalXP)} / 10</span>
				</div>
				<img src="/emoji/package_3d.png" alt="Premio" width="24" height="24" decoding="async" class="widget-emoji-img" />
			</div>
		</div>

		<!-- Winding 3D Lesson Path with Owl Mascot & Section Names -->
		<section class="duo-path-section">
			<div class="nodes-container">
				{#each lessonNodes as node, i}
					<div class="node-wrapper" style="transform: translateX({node.offset}px)">
						<a href={node.href} class="path-node-btn" class:active={i === 0} title={node.title}>
							<img src={node.icon} alt={node.title} width="36" height="36" decoding="async" class="node-emoji-img" />
						</a>
						<span class="path-node-label">{node.title}</span>
					</div>
				{/each}

				<!-- 🦉 Duolingo Owl Mascot Illustration on Path -->
				<div class="duo-mascot-box">
					<img src="/emoji/owl_3d.png" alt="Mascotte Gufo" width="80" height="80" decoding="async" class="mascot-img" />
				</div>
			</div>
		</section>
	</div>

	<!-- 📊 RIGHT SIDEBAR COLUMN (Desktop & Mobile Widgets) -->
	<aside class="duo-right-sidebar">
		<!-- Top Stats Row (Desktop Only) -->
		<a
			href="/missions"
			class="top-stats-row duo-card desktop-top-stats"
			title="Clicca per aprire le Missioni ed i Dettagli"
		>
			<div class="stat-item streak">
				<img src="/emoji/fire_3d.png" alt="Serie" width="24" height="24" decoding="async" class="widget-emoji-img" />
				<div class="stat-text-group">
					<span class="stat-lbl">Serie</span>
					<span class="stat-val">{stats.streakDays}</span>
				</div>
			</div>
			<div class="stat-item gems">
				<img src="/emoji/gem_stone_3d.png" alt="Gemme" width="24" height="24" decoding="async" class="widget-emoji-img" />
				<div class="stat-text-group">
					<span class="stat-lbl">Gemme</span>
					<span class="stat-val">{gems}</span>
				</div>
			</div>
			<div class="stat-item hearts">
				<img src="/emoji/high_voltage_3d.png" alt="XP" width="24" height="24" decoding="async" class="widget-emoji-img" />
				<div class="stat-text-group">
					<span class="stat-lbl">XP</span>
					<span class="stat-val">{totalXP}</span>
				</div>
			</div>
		</a>
		<!-- Widget Missioni Giornaliere (Desktop Only) -->
		<div class="duo-widget duo-card desktop-missions-widget">
			<div class="widget-header-row">
				<h3 class="widget-title">Missioni giornaliere</h3>
				<a href="/missions" class="widget-link">VEDI TUTTE &gt;</a>
			</div>
			<div class="mission-item">
				<img src="/emoji/high_voltage_3d.png" alt="XP" width="24" height="24" decoding="async" class="widget-emoji-img" />
				<div class="mission-info">
					<span class="mission-desc">Guadagna 10 XP</span>
					<div class="duo-progress-track">
						<div class="duo-progress-fill" style="width: {Math.min(100, totalXP * 10)}%"></div>
					</div>
					<span class="mission-count">{Math.min(10, totalXP)} / 10</span>
				</div>
				<img src="/emoji/package_3d.png" alt="Premio" width="24" height="24" decoding="async" class="widget-emoji-img" />
			</div>
		</div>

		<div class="duo-widget duo-card admin-widget">
			<h3 class="widget-title">Risorse e Link</h3>
			<div class="profile-actions">
				{#if canInstall}
					<button
						type="button"
						class="duo-btn duo-btn-red flex-btn install-app-btn"
						onclick={handleInstallApp}
					>
						📲 INSTALLA L'APP
					</button>
				{/if}

				{#if user}
					<button type="button" class="duo-btn duo-btn-red flex-btn home-logout-btn" onclick={handleLogout}>
						🚪 LOGOUT ({user.username})
					</button>
				{:else}
					<button type="button" class="duo-btn sync-btn discord-sync-btn flex-btn" onclick={() => loginWithDiscord('/')}>
						<svg
							class="discord-icon-mini"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 127.14 96.36"
							width="20"
							height="20"
							fill="currentColor"
						>
							<path
								d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.92,53.87,53,48.8,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.92,96.1,53,91,65.69,84.69,65.69Z"
							/>
						</svg>
						<span>ACCEDI CON DISCORD</span>
					</button>
				{/if}
				<a
					href="https://ko-fi.com/infinit7even"
					target="_blank"
					rel="noopener noreferrer"
					class="duo-btn duo-btn-green flex-btn"
				>
					<img src="/emoji/sparkles_3d.png" alt="Splendore" width="20" height="20" decoding="async" class="btn-emoji-img" />
					SOSTIENI IL PROGETTO
				</a>

				{#if user && (user.isAdmin || user.role === 'admin')}
					<a href="/admin" class="duo-btn duo-btn-purple flex-btn"> 🔐 PANNELLO ADMIN </a>
				{/if}
			</div>
		</div>

		<!-- Footer Link to Privacy Policy (Visibile a fine pagina su Mobile & Desktop) -->
		<div class="sidebar-privacy-footer">
			<a href="/privacy" class="privacy-link">Informativa sulla Privacy</a>
		</div>
	</aside>
</div>

<!-- Quick 1-Click Add Card Modal for Admin -->
<QuickAddCardModal isOpen={isQuickAddOpen} {cards} onClose={() => (isQuickAddOpen = false)} />

<style>
	.duo-page-grid {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	@media (min-width: 1024px) {
		.duo-page-grid {
			display: grid;
			grid-template-columns: 1fr 320px;
			gap: 2rem;
			align-items: start;
		}
	}

	/* 📍 Serpeggiante Node Path */
	.duo-path-section {
		padding: 3rem 0;
		display: flex;
		justify-content: center;
	}

	.nodes-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2.2rem;
		position: relative;
		width: 100%;
		max-width: 400px;
	}

	.node-wrapper {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		transition: transform 0.3s ease;
		gap: 0.35rem;
	}

	.path-node-label {
		font-family: 'Outfit', sans-serif;
		font-weight: 800;
		font-size: 0.75rem;
		color: var(--text-color);
		background: var(--card-bg-subtle);
		padding: 0.2rem 0.55rem;
		border-radius: 8px;
		border: 1px solid var(--border-color);
		white-space: nowrap;
	}

	.path-node-btn {
		width: 68px;
		height: 68px;
		border-radius: 50%;
		background-color: var(--brand-color, var(--green-color));
		border: 2px solid var(--brand-depth, var(--green-depth));
		border-bottom: 6px solid var(--brand-depth, var(--green-depth));
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
		transition:
			transform 0.1s ease,
			border-width 0.1s ease;
		user-select: none;
	}

	.path-node-btn.active {
		background-color: var(--brand-color, var(--green-color));
		border-color: var(--brand-depth, var(--green-depth));
		transform: scale(1.08);
	}

	.path-node-btn:active {
		transform: translateY(3px) scale(1.02);
		border-bottom-width: 2px;
	}

	.node-emoji-img {
		width: 36px;
		height: 36px;
		object-fit: contain;
	}

	.duo-mascot-box {
		position: absolute;
		right: -45px;
		top: 140px;
		animation: floatMascot 3s ease-in-out infinite;
	}

	.mascot-img {
		width: 80px;
		height: 80px;
		object-fit: contain;
	}

	/* 💡 Parola del Giorno Card (Style Duolingo 3D) */
	.word-of-day-section {
		width: 100%;
		margin-bottom: 0;
	}

	.word-of-day-card {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 0.75rem 1rem;
	}

	.wod-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		border-bottom: 1.5px solid var(--border-color);
		padding-bottom: 0.75rem;
	}

	.wod-badge {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: var(--accent-light-bg);
		padding: 0.3rem 0.75rem;
		border-radius: 999px;
		border: 1px solid var(--accent-color);
	}

	.wod-icon {
		font-size: 1rem;
	}

	.wod-badge-text {
		font-size: 0.75rem;
		font-weight: 900;
		color: var(--accent-color);
		letter-spacing: 0.08em;
	}

	.wod-header-actions {
		display: flex;
		gap: 0.4rem;
	}

	.wod-action-btn {
		font-size: 0.78rem;
		font-weight: 800;
		padding: 0.35rem 0.7rem;
		border-radius: 12px;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		color: var(--text-color);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.wod-action-btn:hover:not(:disabled) {
		background: var(--hover-bg);
		border-color: var(--accent-color);
		transform: translateY(-1px);
	}

	.wod-action-btn:active:not(:disabled) {
		transform: translateY(1px);
	}

	.dice-icon {
		display: inline-block;
		transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.dice-icon.spin {
		transform: rotate(360deg) scale(1.3);
	}

	.wod-content {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		transition: opacity 0.2s ease, transform 0.2s ease;
	}

	.wod-content.wod-pop {
		opacity: 0.3;
		transform: scale(0.97) translateY(4px);
	}

	.wod-title-row {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.wod-title {
		font-size: 1.8rem;
		font-weight: 900;
		color: var(--accent-color);
		margin: 0;
		letter-spacing: 0.02em;
	}

	.wod-fullname {
		font-size: 0.95rem;
		font-weight: 800;
		color: var(--text-color);
		opacity: 0.9;
	}

	.wod-desc {
		font-size: 0.95rem;
		line-height: 1.55;
		color: var(--text-color);
		opacity: 0.92;
		margin: 0;
	}



	/* 📊 RIGHT SIDEBAR (Desktop Only >= 1024px) */
	.duo-right-sidebar {
		display: none;
	}

	@media (min-width: 1024px) {
		.duo-right-sidebar {
			display: flex;
			flex-direction: column;
			gap: 0.75rem;
			position: sticky;
			top: 1.5rem;
		}
	}

	.duo-main-column {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.mobile-missions-widget {
		margin: 0;
	}

	.desktop-top-stats {
		display: flex;
		margin-bottom: 0;
	}

	@media (max-width: 1023px) {
		.desktop-top-stats,
		.desktop-missions-widget,
		.duo-path-section {
			display: none !important;
		}
	}

	@media (min-width: 1024px) {
		.mobile-missions-widget {
			display: none !important;
			margin: 0 !important;
		}
	}

	.top-stats-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 0.35rem;
		text-decoration: none;
		transition: transform 0.15s ease;
	}

	.top-stats-row:hover {
		transform: translateY(-2px);
		border-color: var(--accent-color);
	}

	.stat-item {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-weight: 900;
		font-size: 0.95rem;
		flex: 1;
	}

	.stat-item + .stat-item {
		border-left: 1px solid var(--border-color);
	}

	.stat-text-group {
		display: flex;
		flex-direction: column;
		line-height: 1;
	}

	.stat-item.streak {
		color: var(--orange-color);
	}
	.stat-item.gems {
		color: var(--accent-color);
	}
	.stat-item.hearts {
		color: var(--pink-color);
	}

	.stat-lbl {
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		opacity: 0.8;
	}

	.stat-val {
		font-size: 1.05rem;
		font-weight: 900;
	}

	.widget-emoji-img {
		width: 24px;
		height: 24px;
		object-fit: contain;
	}

	.duo-widget {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.widget-title {
		font-size: 1.05rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.widget-header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.widget-link {
		font-size: 0.75rem;
		font-weight: 900;
		color: var(--accent-color);
		text-decoration: none;
		letter-spacing: 0.05em;
	}

	.mission-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: var(--card-bg-subtle);
		padding: 0.75rem;
		border-radius: 14px;
		border: 2px solid var(--border-color);
	}

	.mission-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.mission-desc {
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--text-color);
	}

	.mission-count {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--text-muted);
	}

	.duo-progress-track {
		width: 100%;
		height: 10px;
		background: var(--card-bg);
		border-radius: 9999px;
		overflow: hidden;
		border: 1px solid var(--border-color);
	}

	.duo-progress-fill {
		height: 100%;
		background: var(--yellow-color);
		border-radius: 9999px;
	}

	.profile-actions {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.flex-btn {
		width: 100%;
		font-size: 0.85rem;
		text-align: center;
		text-decoration: none;
	}

	.install-app-btn {
		background-color: #ff5e5b;
		color: #ffffff;
		border-color: #d9423f;
	}

	.install-app-btn:hover:not(:disabled) {
		background-color: #ff7370;
	}

	.btn-emoji-img {
		width: 20px;
		height: 20px;
		object-fit: contain;
	}

	.sidebar-privacy-footer {
		text-align: center;
		padding: 0 0 0.5rem 0;
		margin: 0;
	}

	.discord-sync-btn {
		background-color: #5865f2 !important;
		color: #ffffff !important;
		border: none !important;
		border-bottom: 4px solid #4752c4 !important;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		text-decoration: none;
		transition: filter 0.15s ease, transform 0.1s ease;
	}

	.discord-icon-mini {
		width: 20px;
		height: 20px;
		max-width: 20px;
		max-height: 20px;
		flex-shrink: 0;
	}

	.discord-sync-btn:hover {
		filter: brightness(1.1);
	}

	.discord-sync-btn:active {
		transform: translateY(2px);
		border-bottom-width: 2px;
	}

	.home-logout-btn {
		background-color: #ff4b4b !important;
		color: #ffffff !important;
		border: none !important;
		border-bottom: 4px solid #ea2b2b !important;
		transition: filter 0.15s ease, transform 0.1s ease;
	}

	.home-logout-btn:hover {
		filter: brightness(1.1);
	}

	.home-logout-btn:active {
		transform: translateY(2px);
		border-bottom-width: 2px;
	}

	@media (max-width: 1023px) {
		.duo-right-sidebar {
			display: flex;
			flex-direction: column;
			gap: 0.85rem;
			width: 100%;
			margin: 0;
		}
	}

	.privacy-link {
		font-size: 0.75rem;
		color: var(--text-muted);
		text-decoration: none;
		font-weight: 700;
	}

	.privacy-link:hover {
		color: var(--accent-color);
	}

	@keyframes floatMascot {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-8px);
		}
	}

	@media (max-width: 640px) {
		.duo-path-section {
			padding: 2rem 0;
		}

		.nodes-container {
			max-width: 320px;
			gap: 1.8rem;
		}

		.duo-mascot-box {
			right: -25px;
			top: 110px;
		}

		.mascot-img {
			width: 64px;
			height: 64px;
		}

		.path-node-btn {
			width: 60px;
			height: 60px;
			border-bottom-width: 5px;
		}

		.node-emoji-img {
			width: 30px;
			height: 30px;
		}

		.path-node-label {
			font-size: 0.7rem;
			padding: 0.15rem 0.4rem;
		}
	}
</style>
