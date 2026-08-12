<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { statsStore, type StatsData } from '$lib/stores/statsStore';
	import QuickAddCardModal from '$lib/components/QuickAddCardModal.svelte';
	import type { Card } from '$lib/types/cards';

	import { pwaStore } from '$lib/stores/pwaStore';

	let { data } = $props();

	let cards = $state<Card[]>([]);
	let wordOfTheDay = $state<Card | null>(null);
	let isQuickAddOpen = $state(false);
	let isStandalone = $state(false);
	let canInstall = $state(false);
	let user = $derived(data.user);

	let stats = $state<StatsData>({
		cardsStudied: 0,
		quizAnswered: 0,
		quizCorrect: 0,
		streakDays: 1,
		lastStudiedDate: '',
		favorites: []
	});

	function pickRandomWord(cardList: Card[]) {
		if (cardList.length === 0) return;
		const randomIndex = Math.floor(Math.random() * cardList.length);
		wordOfTheDay = cardList[randomIndex];
	}

	onMount(() => {
		const uncards = cardsStore.subscribe((c) => {
			cards = c;
			if (c.length > 0 && !wordOfTheDay) {
				pickRandomWord(c);
			}
		});
		const unstats = statsStore.subscribe((s) => (stats = s));
		const unpwa = pwaStore.subscribe(() => {
			isStandalone = pwaStore.isStandalone;
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

	const lessonNodes = [
		{ id: 1, title: 'FLASHCARD', href: '/flashcard', icon: '/emoji/open_book_3d.png', state: 'active', offset: 0 },
		{ id: 2, title: 'QUIZ', href: '/quiz', icon: '/emoji/star_3d.png', state: 'unlocked', offset: -40 },
		{ id: 3, title: 'REELS', href: '/reels', icon: '/emoji/camera_3d.png', state: 'unlocked', offset: 35 },
		{ id: 4, title: 'SCRITTURA', href: '/scrittura', icon: '/emoji/writing_hand_3d_default.png', state: 'unlocked', offset: -35 },
		{ id: 5, title: 'WIKI', href: '/wiki', icon: '/emoji/books_3d.png', state: 'unlocked', offset: 0 }
	];

	let totalXP = $derived(stats.quizCorrect * 15 + stats.cardsStudied * 5);
	let gems = $derived(stats.quizCorrect * 10 + 100);
</script>

<div class="duo-page-grid">
	<!-- 📍 MAIN CENTRAL COLUMN (Stats Bar Mobile, Parola del Giorno & Path) -->
	<div class="duo-main-column">
		<!-- 📊 Top Stats Bar (Mobile Only) -->
		<a href="/missioni" class="top-stats-row duo-card mobile-top-stats" title="Clicca per aprire le Missioni ed i Dettagli">
			<div class="stat-item streak">
				<img src="/emoji/fire_3d.png" alt="Serie" class="widget-emoji-img" />
				<div class="stat-text-group">
					<span class="stat-lbl">Serie</span>
					<span class="stat-val">{stats.streakDays}</span>
				</div>
			</div>
			<div class="stat-item gems">
				<img src="/emoji/gem_stone_3d.png" alt="Gemme" class="widget-emoji-img" />
				<div class="stat-text-group">
					<span class="stat-lbl">Gemme</span>
					<span class="stat-val">{gems}</span>
				</div>
			</div>
			<div class="stat-item hearts">
				<img src="/emoji/high_voltage_3d.png" alt="XP" class="widget-emoji-img" />
				<div class="stat-text-group">
					<span class="stat-lbl">XP</span>
					<span class="stat-val">{totalXP}</span>
				</div>
			</div>
		</a>

		<!-- 💡 Parola del Giorno Card (Cima alla Home) -->
		{#if wordOfTheDay}
			<section class="word-of-day-section">
				<div class="duo-card word-of-day-card">
					<div class="wod-header">
						<div class="wod-badge">
							<span class="wod-icon">💡</span>
							<span class="wod-badge-text">PAROLA DEL GIORNO</span>
						</div>
						<div class="wod-header-actions">
							<button class="wod-action-btn" onclick={() => pickRandomWord(cards)} title="Scopri un'altra parola">
								🎲 Altra Parola
							</button>
						</div>
					</div>

					<div class="wod-content">
						<div class="wod-title-row">
							<h2 class="wod-title">{wordOfTheDay.title}</h2>
							{#if wordOfTheDay.fullName}
								<span class="wod-fullname">{wordOfTheDay.fullName}</span>
							{/if}
						</div>

						<p class="wod-desc">{wordOfTheDay.description}</p>

						{#if wordOfTheDay.images && wordOfTheDay.images.length > 0}
							<div class="wod-img-container">
								<img src={wordOfTheDay.images[0]} alt={wordOfTheDay.title} class="wod-img" />
							</div>
						{/if}
					</div>
				</div>
			</section>
		{/if}

		<!-- Winding 3D Lesson Path with Owl Mascot & Section Names -->
		<section class="duo-path-section">
			<div class="nodes-container">
				{#each lessonNodes as node, i}
					<div class="node-wrapper" style="transform: translateX({node.offset}px)">
						<a
							href={node.href}
							class="path-node-btn"
							class:active={i === 0}
							title={node.title}
						>
							<img src={node.icon} alt={node.title} class="node-emoji-img" />
						</a>
						<span class="path-node-label">{node.title}</span>
					</div>
				{/each}

				<!-- 🦉 Duolingo Owl Mascot Illustration on Path -->
				<div class="duo-mascot-box">
					<img src="/emoji/owl_3d.png" alt="Mascotte Gufo" class="mascot-img" />
				</div>
			</div>
		</section>
	</div>

	<!-- 📊 RIGHT SIDEBAR COLUMN (Desktop & Mobile Widgets) -->
	<aside class="duo-right-sidebar">
		<!-- Top Stats Row (Desktop Only) -->
		<a href="/missioni" class="top-stats-row duo-card desktop-top-stats" title="Clicca per aprire le Missioni ed i Dettagli">
			<div class="stat-item streak">
				<img src="/emoji/fire_3d.png" alt="Serie" class="widget-emoji-img" />
				<div class="stat-text-group">
					<span class="stat-lbl">Serie</span>
					<span class="stat-val">{stats.streakDays}</span>
				</div>
			</div>
			<div class="stat-item gems">
				<img src="/emoji/gem_stone_3d.png" alt="Gemme" class="widget-emoji-img" />
				<div class="stat-text-group">
					<span class="stat-lbl">Gemme</span>
					<span class="stat-val">{gems}</span>
				</div>
			</div>
			<div class="stat-item hearts">
				<img src="/emoji/high_voltage_3d.png" alt="XP" class="widget-emoji-img" />
				<div class="stat-text-group">
					<span class="stat-lbl">XP</span>
					<span class="stat-val">{totalXP}</span>
				</div>
			</div>
		</a>
		<!-- Widget Missioni Giornaliere -->
		<div class="duo-widget duo-card">
			<div class="widget-header-row">
				<h3 class="widget-title">Missioni giornaliere</h3>
				<a href="/missioni" class="widget-link">VEDI TUTTE &gt;</a>
			</div>
			<div class="mission-item">
				<img src="/emoji/high_voltage_3d.png" alt="XP" class="widget-emoji-img" />
				<div class="mission-info">
					<span class="mission-desc">Guadagna 10 XP</span>
					<div class="duo-progress-track">
						<div class="duo-progress-fill" style="width: {Math.min(100, totalXP * 10)}%"></div>
					</div>
					<span class="mission-count">{Math.min(10, totalXP)} / 10</span>
				</div>
				<img src="/emoji/package_3d.png" alt="Premio" class="widget-emoji-img" />
			</div>
		</div>

		<div class="duo-widget duo-card admin-widget">
			<h3 class="widget-title">Risorse e Link</h3>
			<div class="profile-actions">
				{#if !isStandalone}
					<button
						type="button"
						class="duo-btn duo-btn-green flex-btn install-app-btn"
						onclick={handleInstallApp}
					>
						📲 INSTALLA L'APP
					</button>
				{/if}

				<a href="https://epod.rfi.it" target="_blank" rel="noopener noreferrer" class="duo-btn duo-btn-blue flex-btn">
					📚 DISPENSA RFI
				</a>
				<a href="https://ko-fi.com/infinit7even" target="_blank" rel="noopener noreferrer" class="duo-btn kofi-btn flex-btn">
					<img src="/emoji/sparkles_3d.png" alt="Splendore" class="btn-emoji-img" />
					SOSTIENI IL SITO
				</a>

				{#if user && (user.isAdmin || user.role === 'admin')}
					<a href="/admin" class="duo-btn duo-btn-purple flex-btn">
						🔐 PANNELLO ADMIN
					</a>
					<button
						type="button"
						class="duo-btn duo-btn-green flex-btn quick-add-sidebar-btn"
						onclick={() => (isQuickAddOpen = true)}
					>
						⚡ AGGIUNGI SCHEDA RAPIDA
					</button>
				{/if}
			</div>
		</div>

		<!-- Footer Link to Privacy Policy -->
		<div class="sidebar-privacy-footer">
			<a href="/privacy" class="privacy-link">Informativa sulla Privacy</a>
		</div>
	</aside>
</div>

<!-- Quick 1-Click Add Card Modal for Admin -->
<QuickAddCardModal
	isOpen={isQuickAddOpen}
	cards={cards}
	onClose={() => (isQuickAddOpen = false)}
/>

<style>
	.duo-page-grid {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	@media (min-width: 1024px) {
		.duo-page-grid {
			display: grid;
			grid-template-columns: 1fr 340px;
			gap: 2.5rem;
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
		background-color: var(--green-color);
		border: 2px solid var(--green-depth);
		border-bottom: 6px solid var(--green-depth);
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
		transition: transform 0.1s ease, border-width 0.1s ease;
		user-select: none;
	}

	.path-node-btn.active {
		background-color: var(--green-color);
		border-color: var(--green-depth);
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
		margin-bottom: 1rem;
	}

	.word-of-day-card {
		display: flex;
		flex-direction: column;
		gap: 1rem;
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
		transition: all 0.15s ease;
	}

	.wod-action-btn:hover {
		background: var(--hover-bg);
		border-color: var(--accent-color);
	}

	.wod-content {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
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

	.wod-img-container {
		margin-top: 0.4rem;
		max-height: 200px;
		border-radius: 14px;
		overflow: hidden;
		border: 2px solid var(--border-color);
	}

	.wod-img {
		width: 100%;
		height: 100%;
		max-height: 200px;
		object-fit: cover;
	}

	/* 📊 RIGHT SIDEBAR (Desktop Only >= 1024px) */
	.duo-right-sidebar {
		display: none;
	}

	@media (min-width: 1024px) {
		.duo-right-sidebar {
			display: flex;
			flex-direction: column;
			gap: 1.25rem;
			position: sticky;
			top: 1.5rem;
		}
	}

	.mobile-top-stats {
		display: flex;
		margin-bottom: 1rem;
	}

	.desktop-top-stats {
		display: flex;
		margin-bottom: 0;
	}

	@media (min-width: 1024px) {
		.mobile-top-stats {
			display: none !important;
			margin: 0 !important;
		}
	}

	.top-stats-row {
		display: flex;
		align-items: center;
		justify-content: space-around;
		padding: 0.75rem 1rem;
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
		gap: 0.5rem;
		font-weight: 900;
		font-size: 0.95rem;
	}

	.stat-text-group {
		display: flex;
		flex-direction: column;
		line-height: 1;
	}

	.stat-item.streak { color: var(--orange-color); }
	.stat-item.gems { color: var(--accent-color); }
	.stat-item.hearts { color: var(--pink-color); }

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

	.kofi-btn {
		background-color: #ff5e5b;
		color: #ffffff;
		border-color: #d9423f;
	}

	.kofi-btn:hover:not(:disabled) {
		background-color: #ff7370;
	}

	.btn-emoji-img {
		width: 20px;
		height: 20px;
		object-fit: contain;
	}

	.sidebar-privacy-footer {
		text-align: center;
		padding: 0.5rem 0;
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

	@keyframes bounce {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-5px); }
	}

	@keyframes floatMascot {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-8px); }
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
