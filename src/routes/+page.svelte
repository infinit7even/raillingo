<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { statsStore, type StatsData } from '$lib/stores/statsStore';
	import type { Card } from '$lib/types/cards';

	let cards = $state<Card[]>([]);
	let stats = $state<StatsData>({
		cardsStudied: 0,
		quizAnswered: 0,
		quizCorrect: 0,
		streakDays: 1,
		lastStudiedDate: '',
		favorites: []
	});

	let searchQuery = $state('');
	let selectedCategory = $state<string>('all');

	onMount(() => {
		const uncards = cardsStore.subscribe((c) => {
			cards = c;
		});
		const unstats = statsStore.subscribe((s) => (stats = s));
		return () => {
			uncards();
			unstats();
		};
	});

	let categories = $derived(cardsStore.categories);

	let filteredCards = $derived(
		cards.filter((c) => {
			const matchesCategory = selectedCategory === 'all' || c.category === selectedCategory;
			const q = searchQuery.toLowerCase().trim();
			const matchesSearch =
				!q ||
				c.title.toLowerCase().includes(q) ||
				c.description.toLowerCase().includes(q) ||
				(c.tags && c.tags.some((t) => t.toLowerCase().includes(q)));
			return matchesCategory && matchesSearch;
		})
	);

	const lessonNodes = [
		{ id: 1, title: 'Inizia Ripasso', href: '/ripasso', icon: '⭐', state: 'active', offset: 0 },
		{ id: 2, title: 'Modalità Foto', href: '/ripasso-foto', icon: '📷', state: 'unlocked', offset: -40 },
		{ id: 3, title: 'Ripasso Inverso', href: '/ripasso-inverso', icon: '🔄', state: 'unlocked', offset: 30 },
		{ id: 4, title: 'Cassa Premio', href: '/reels', icon: '📦', state: 'unlocked', offset: -35 },
		{ id: 5, title: 'Quiz 5 Scelte', href: '/quiz', icon: '🎯', state: 'unlocked', offset: 0 },
		{ id: 6, title: 'Scrittura Libera', href: '/scrittura', icon: '✍️', state: 'unlocked', offset: 35 },
		{ id: 7, title: 'Reels Ferroviari', href: '/reels', icon: '🎬', state: 'unlocked', offset: -25 },
		{ id: 8, title: 'Wiki Ferroviario', href: '/wiki', icon: '🏆', state: 'unlocked', offset: 0 }
	];

	let totalXP = $derived(stats.quizCorrect * 15 + stats.cardsStudied * 5);
	let gems = $derived(stats.cardsStudied * 10 + 100);
</script>

<div class="duo-page-grid">
	<!-- 📍 MAIN CENTRAL COLUMN (Path & Chapter Banner) -->
	<div class="duo-main-column">
		<!-- Green Section Header Banner (Screenshot) -->
		<section class="duo-green-banner">
			<div class="banner-text">
				<span class="banner-chap">← SEZIONE 1, CAPITOLO 1</span>
				<h1 class="banner-heading">Concetti e Acronimi Ferroviari RFI</h1>
			</div>
			<a href="/wiki" class="duo-btn duo-btn-guide">
				📋 GUIDA
			</a>
		</section>

		<!-- Winding 3D Lesson Path (Node Tree) -->
		<section class="duo-path-section">
			<div class="nodes-container">
				{#each lessonNodes as node, i}
					<div class="node-wrapper" style="transform: translateX({node.offset}px)">
						{#if i === 0}
							<!-- "INIZIA" Bubble Tooltip above active node -->
							<div class="start-tooltip">
								<span>INIZIA</span>
								<div class="tooltip-arrow"></div>
							</div>
						{/if}

						<a
							href={node.href}
							class="path-node-btn"
							class:active={i === 0}
							title={node.title}
						>
							<span class="node-icon">{node.icon}</span>
						</a>
					</div>
				{/each}

				<!-- Duolingo Owl / Train Mascot Illustration on Path -->
				<div class="duo-mascot-box">
					<span class="mascot-emoji">🦉</span>
				</div>
			</div>
		</section>

		<!-- Catalog / Search Section below Path -->
		<section class="catalog-section">
			<div class="catalog-header-row">
				<h2 class="section-heading">📚 Consultazione Acronimi ({filteredCards.length})</h2>
				<div class="search-controls">
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Cerca acronimo..."
						class="duo-input search-input"
					/>
					<select bind:value={selectedCategory} class="duo-input category-select">
						<option value="all">Tutte le Categorie</option>
						{#each categories as cat}
							<option value={cat}>{cat}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="cards-grid">
				{#each filteredCards as card}
					<div class="duo-card catalog-card">
						<div class="card-top">
							<h3 class="card-term">{card.title}</h3>
							{#if card.category}
								<span class="duo-badge">{card.category}</span>
							{/if}
						</div>
						<p class="card-meaning">{card.description}</p>
					</div>
				{:else}
					<div class="duo-card empty-state">
						Nessun acronimo trovato.
					</div>
				{/each}
			</div>
		</section>
	</div>

	<!-- 📊 RIGHT SIDEBAR COLUMN (Desktop Widgets) -->
	<aside class="duo-right-sidebar">
		<!-- Top Stats Row (Flag, Streak, Gems, Hearts) -->
		<div class="desktop-top-stats duo-card">
			<div class="stat-item" title="Lingua Corso">
				<span class="stat-emoji">🇮🇹</span>
			</div>
			<div class="stat-item streak" title="Giorni di serie">
				<span class="stat-emoji">🔥</span>
				<span class="stat-val">{stats.streakDays}</span>
			</div>
			<div class="stat-item gems" title="Gemme totali">
				<span class="stat-emoji">💎</span>
				<span class="stat-val">{gems}</span>
			</div>
			<div class="stat-item hearts" title="Vite/Cuori">
				<span class="stat-emoji">❤️</span>
				<span class="stat-val">5</span>
			</div>
		</div>

		<!-- Widget 1: Sblocca le classifiche! -->
		<div class="duo-widget duo-card">
			<h3 class="widget-title">Sblocca le classifiche!</h3>
			<div class="widget-row">
				<div class="lock-icon-box">🔒</div>
				<p class="widget-text">
					Completa altre 3 lezioni per partecipare alle classifiche settimanali.
				</p>
			</div>
		</div>

		<!-- Widget 2: Missioni Giornaliere -->
		<div class="duo-widget duo-card">
			<div class="widget-header-row">
				<h3 class="widget-title">Missioni giornaliere</h3>
				<a href="/quiz" class="widget-link">VEDI TUTTE</a>
			</div>
			<div class="mission-item">
				<span class="mission-icon">⚡</span>
				<div class="mission-info">
					<span class="mission-desc">Guadagna 10 XP</span>
					<div class="duo-progress-track">
						<div class="duo-progress-fill" style="width: {Math.min(100, totalXP * 10)}%"></div>
					</div>
					<span class="mission-count">{Math.min(10, totalXP)} / 10</span>
				</div>
				<span class="mission-chest">📦</span>
			</div>
		</div>

		<!-- Widget 3: Salva i tuoi progressi / Profilo -->
		<div class="duo-widget duo-card profile-widget">
			<h3 class="widget-title">Crea un profilo per salvare i tuoi progressi!</h3>
			<div class="profile-actions">
				<a href="/ripasso" class="duo-btn duo-btn-green flex-btn">
					INIZIA LEZIONE
				</a>
				<a href="/quiz" class="duo-btn duo-btn-blue flex-btn">
					ESERCIZIO PACCO
				</a>
			</div>
		</div>
	</aside>
</div>

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

	/* Banner di Capitolo Verde (#58cc02) */
	.duo-green-banner {
		background-color: var(--green-color);
		border: 2px solid var(--green-depth);
		border-bottom: 5px solid var(--green-depth);
		border-radius: 22px;
		padding: 1.5rem 1.75rem;
		color: #ffffff;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		box-shadow: 0 6px 20px rgba(88, 204, 2, 0.2);
	}

	.banner-text {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.banner-chap {
		font-size: 0.78rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.95;
	}

	.banner-heading {
		font-size: 1.75rem;
		font-weight: 900;
		color: #ffffff;
		margin: 0;
		line-height: 1.15;
	}

	.duo-btn-guide {
		background-color: rgba(255, 255, 255, 0.22) !important;
		color: #ffffff !important;
		border-color: rgba(255, 255, 255, 0.3) !important;
		border-bottom-color: rgba(255, 255, 255, 0.5) !important;
		font-size: 0.85rem;
		padding: 0.65rem 1.1rem;
		flex-shrink: 0;
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
	}

	/* Tooltip Bubble "INIZIA" */
	.start-tooltip {
		position: absolute;
		bottom: calc(100% + 10px);
		background-color: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		color: var(--green-color);
		font-family: 'Outfit', sans-serif;
		font-weight: 900;
		font-size: 0.8rem;
		letter-spacing: 0.08em;
		padding: 0.4rem 0.9rem;
		border-radius: 12px;
		box-shadow: 0 4px 12px rgba(0,0,0,0.2);
		animation: bounce 1.8s infinite;
	}

	.tooltip-arrow {
		position: absolute;
		bottom: -6px;
		left: 50%;
		transform: translateX(-50%) rotate(45deg);
		width: 8px;
		height: 8px;
		background: var(--card-bg-subtle);
		border-right: 2px solid var(--border-color);
		border-bottom: 2px solid var(--border-color);
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

	.node-icon {
		font-size: 1.8rem;
		line-height: 1;
	}

	.duo-mascot-box {
		position: absolute;
		right: -40px;
		top: 140px;
		font-size: 4rem;
		animation: floatMascot 3s ease-in-out infinite;
	}

	/* Catalog Cards */
	.catalog-section {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		margin-top: 1rem;
	}

	.catalog-header-row {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	@media (min-width: 640px) {
		.catalog-header-row {
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
		}
	}

	.search-controls {
		display: flex;
		gap: 0.6rem;
	}

	.duo-input {
		padding: 0.65rem 0.9rem;
		border-radius: 14px;
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		border-bottom-width: 3px;
		color: var(--text-color);
		font-size: 0.85rem;
		font-weight: 700;
	}

	.cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 1rem;
	}

	.catalog-card {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.card-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.card-term {
		font-size: 1.2rem;
		font-weight: 900;
		color: var(--accent-color);
		margin: 0;
	}

	.card-meaning {
		font-size: 0.85rem;
		line-height: 1.5;
		color: var(--text-muted);
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
			gap: 1.25rem;
			position: sticky;
			top: 1.5rem;
		}
	}

	.desktop-top-stats {
		display: flex;
		align-items: center;
		justify-content: space-around;
		padding: 0.75rem 1rem;
	}

	.stat-item {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-weight: 900;
		font-size: 1rem;
	}

	.stat-item.streak { color: var(--orange-color); }
	.stat-item.gems { color: var(--accent-color); }
	.stat-item.hearts { color: var(--pink-color); }

	.stat-emoji {
		font-size: 1.3rem;
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

	.widget-row {
		display: flex;
		gap: 0.85rem;
		align-items: center;
	}

	.lock-icon-box {
		width: 44px;
		height: 44px;
		border-radius: 14px;
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.3rem;
		flex-shrink: 0;
	}

	.widget-text {
		font-size: 0.85rem;
		color: var(--text-muted);
		line-height: 1.4;
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

	.mission-icon {
		font-size: 1.4rem;
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

	.mission-chest {
		font-size: 1.4rem;
	}

	.profile-actions {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.flex-btn {
		width: 100%;
		font-size: 0.9rem;
	}

	@keyframes bounce {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-5px); }
	}

	@keyframes floatMascot {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-8px); }
	}
</style>


