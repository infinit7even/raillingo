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
	let announcement = $state('');
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
	let selectedCategory = $state<string>('all');

	onMount(() => {
		const uncards = cardsStore.subscribe((c) => {
			cards = c;
		});
		const unstats = statsStore.subscribe((s) => (stats = s));

		fetch('/api/announcements')
			.then((res) => res.json())
			.then((d) => {
				if (d.announcement) announcement = d.announcement;
			})
			.catch(() => {});

		return () => {
			uncards();
			unstats();
		};
	});

	let categories = $derived(cardsStore.categories);

	let filteredCards = $derived(
		cards.filter((c) => {
			const matchesCategory =
				selectedCategory === 'all' ||
				c.category === selectedCategory ||
				(c.categories && c.categories.includes(selectedCategory));
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
		{ id: 1, title: 'Inizia Flashcard', href: '/ripasso', icon: '/emoji/open_book_3d.png', state: 'active', offset: 0 },
		{ id: 2, title: 'Quiz a 5 Scelte', href: '/quiz', icon: '/emoji/star_3d.png', state: 'unlocked', offset: -40 },
		{ id: 3, title: 'Reels Ferroviari', href: '/reels', icon: '/emoji/camera_3d.png', state: 'unlocked', offset: 35 },
		{ id: 4, title: 'Scrittura Libera', href: '/scrittura', icon: '/emoji/writing_hand_3d_default.png', state: 'unlocked', offset: -35 },
		{ id: 5, title: 'Wiki & Indice', href: '/wiki', icon: '/emoji/books_3d.png', state: 'unlocked', offset: 0 }
	];

	let totalXP = $derived(stats.quizCorrect * 15 + stats.cardsStudied * 5);
	let gems = $derived(stats.quizCorrect * 10 + 100);
</script>

<div class="duo-page-grid">
	<!-- 📍 MAIN CENTRAL COLUMN (Path & Chapter Banner) -->
	<div class="duo-main-column">
		<!-- Green Section Header Banner -->
		<section class="duo-green-banner">
			<div class="banner-text">
				<span class="banner-chap">CORSO FERROVIARIO RFI</span>
				<h1 class="banner-heading">Acronimi e Termini Tecnici</h1>
			</div>

			<div class="banner-actions">
				{#if user && user.isAdmin}
					<!-- 1-Click Quick Add Card Button for Admin -->
					<button
						class="duo-btn duo-btn-purple quick-add-btn"
						onclick={() => (isQuickAddOpen = true)}
						title="Aggiungi rapidamente una nuova scheda"
					>
						⚡ AGGIUNGI CARD
					</button>
					<a
						href="/admin"
						class="duo-btn duo-btn-gray admin-link-btn"
						title="Accedi al Pannello di Gestione Admin"
					>
						⚙️ ADMIN
					</a>
				{/if}

				<!-- Sleek Lens Search Button for Instant Wiki Modal -->
				<button
					class="duo-btn duo-btn-guide lens-btn"
					onclick={() => (isWikiModalOpen = true)}
					aria-label="Ricerca Rapida Wiki"
					title="Ricerca Rapida Wiki"
				>
					🔍
				</button>
			</div>
		</section>

		{#if announcement && announcement.trim()}
			<!-- Platform Announcement Box (Rendered ONLY if admin posted an announcement) -->
			<div class="announcement-banner-box duo-card">
				<span class="announcement-badge">📢 ANNUNCIO PIATTAFORMA</span>
				<p class="announcement-content-text">{announcement}</p>
			</div>
		{/if}

		<!-- Winding 3D Lesson Path with Owl Mascot & Section Names -->
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
				{#if user && user.isAdmin}
					<a href="/admin" class="duo-btn duo-btn-purple flex-btn">
						⚙️ Pannello Admin
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

	.announcement-banner-box {
		margin-top: 1rem;
		background: linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(59, 130, 246, 0.15));
		border: 2px solid #a855f7;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.announcement-badge {
		font-size: 0.72rem;
		font-weight: 900;
		color: #a855f7;
		letter-spacing: 0.06em;
	}

	.announcement-content-text {
		font-size: 0.95rem;
		font-weight: 700;
		line-height: 1.45;
		color: var(--text-color);
		margin: 0;
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
		font-size: 1.1rem;
		padding: 0.5rem 0.85rem;
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 14px;
		cursor: pointer;
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
		padding: 0.2rem 0.5rem;
		border-radius: 8px;
		border: 1px solid var(--border-color);
		white-space: nowrap;
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
		.duo-green-banner {
			padding: 1rem 1.15rem;
			border-radius: 18px;
		}

		.banner-heading {
			font-size: 1.35rem;
		}

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
