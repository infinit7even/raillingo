<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { statsStore, type StatsData } from '$lib/stores/statsStore';
	import WikiSearchModal from '$lib/components/WikiSearchModal.svelte';
	import QuickAddCardModal from '$lib/components/QuickAddCardModal.svelte';
	import type { Card } from '$lib/types/cards';

	let { data } = $props();

	let cards = $state<Card[]>([]);
	let isWikiModalOpen = $state(false);
	let isQuickAddOpen = $state(false);
	let user = $derived(data.user);

	let stats = $state<StatsData>({
		cardsStudied: 0,
		quizAnswered: 0,
		quizCorrect: 0,
		streakDays: 1,
		lastStudiedDate: '',
		favorites: []
	});

	let searchQuery = $state('');

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

	let filteredCards = $derived(
		cards.filter((c) => {
			const q = searchQuery.toLowerCase().trim();
			const matchesSearch =
				!q ||
				c.title.toLowerCase().includes(q) ||
				c.description.toLowerCase().includes(q) ||
				(c.tags && c.tags.some((t) => t.toLowerCase().includes(q)));
			return matchesSearch;
		})
	);

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
	<!-- 📍 MAIN CENTRAL COLUMN (Path) -->
	<div class="duo-main-column">
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
				</div>
			</div>

			<div class="cards-grid">
				{#each filteredCards as card}
					<div class="duo-card catalog-card">
						<div class="card-top">
							<h3 class="card-term">{card.title}</h3>
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
		<!-- Top Stats Row (Serie, Gemme, XP) -->
		<div class="desktop-top-stats duo-card">
			<div class="stat-item streak" title="Giorni di serie">
				<img src="/emoji/fire_3d.png" alt="" aria-hidden="true" class="widget-emoji-img" />
				<span class="stat-lbl">Serie</span>
				<span class="stat-val">{stats.streakDays}</span>
			</div>
			<div class="stat-item gems" title="Gemme da quiz corretti">
				<img src="/emoji/gem_stone_3d.png" alt="" aria-hidden="true" class="widget-emoji-img" />
				<span class="stat-lbl">Gemme</span>
				<span class="stat-val">{gems}</span>
			</div>
			<div class="stat-item hearts" title="Punti XP da interazioni">
				<img src="/emoji/high_voltage_3d.png" alt="" aria-hidden="true" class="widget-emoji-img" />
				<span class="stat-lbl">XP</span>
				<span class="stat-val">{totalXP}</span>
			</div>
		</div>

		<!-- Widget Missioni Giornaliere (Links ONLY to /missioni when clicking VEDI TUTTE) -->
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

		<!-- Widget Login / Profilo e Salva Progressi -->
		<div class="duo-widget duo-card profile-widget">
			<h3 class="widget-title">{user ? `Profilo (${user.username})` : 'Salva i tuoi Progressi'}</h3>
			<p class="widget-desc-text">
				{user ? 'I tuoi dati e la tua serie sono sincronizzati.' : 'Accedi con Discord per non perdere mai la tua serie e le tue gemme.'}
			</p>
			<div class="profile-actions">
				{#if user && (user.isAdmin || user.role === 'admin')}
					<a href="/admin" class="duo-btn duo-btn-purple flex-btn">
						PANNELLO ADMIN
					</a>
				{/if}
				{#if !user}
					<a href="/login" class="duo-btn duo-btn-blue flex-btn login-save-btn">
						🔑 ACCEDI E SALVA PROGRESSI
					</a>
				{/if}
				<a href="/ripasso" class="duo-btn duo-btn-green flex-btn">
					INIZIA LEZIONE
				</a>
				{#if user}
					<a href="/api/auth/logout" class="duo-btn duo-btn-gray flex-btn">
						DISCONNETTI
					</a>
				{/if}
				{#if user && (user.isAdmin || user.role === 'admin')}
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

<!-- Interactive Instant Wiki Search Modal -->
<WikiSearchModal
	isOpen={isWikiModalOpen}
	cards={cards}
	onClose={() => (isWikiModalOpen = false)}
/>

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
		padding: 0.75rem 0.85rem;
	}

	.stat-item {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-weight: 900;
		font-size: 0.9rem;
	}

	.stat-item.streak { color: var(--orange-color); }
	.stat-item.gems { color: var(--accent-color); }
	.stat-item.hearts { color: var(--pink-color); }

	.stat-lbl {
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		opacity: 0.8;
	}

	.widget-desc-text {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0.25rem 0 0.5rem 0;
		line-height: 1.4;
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
