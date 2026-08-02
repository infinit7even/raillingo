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
	let dailyCard = $state<Card | null>(null);

	onMount(() => {
		const uncards = cardsStore.subscribe((c) => {
			cards = c;
			if (c.length > 0 && !dailyCard) {
				const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
				dailyCard = c[dayOfYear % c.length];
			}
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

	const minigames = [
		{
			id: 'ripasso',
			title: 'Ripasso Flashcard',
			subtitle: 'Acronimo ➔ Descrizione',
			desc: 'Vedi il titolo, ripeti a voce la risposta e tocca per rivelare la descrizione e le foto.',
			href: '/ripasso',
			icon: '📖',
			btnColor: 'duo-btn-blue',
			btnText: 'INIZIA RIPASSO'
		},
		{
			id: 'ripasso-foto',
			title: 'Modalità Foto',
			subtitle: 'Foto ➔ Acronimo ➔ Descrizione',
			desc: 'Guarda l\'immagine, scopri prima il titolo e con un secondo click la descrizione.',
			href: '/ripasso-foto',
			icon: '📷',
			btnColor: 'duo-btn-purple',
			btnText: 'SCOPRI FOTO'
		},
		{
			id: 'ripasso-inverso',
			title: 'Ripasso Inverso',
			subtitle: 'Descrizione ➔ Acronimo',
			desc: 'Leggi la spiegazione e indovina qual è l\'acronimo o termine corrispondente.',
			href: '/ripasso-inverso',
			icon: '🔄',
			btnColor: 'duo-btn-green',
			btnText: 'SFIDA INVERSA'
		},
		{
			id: 'quiz',
			title: 'Quiz a 5 Scelte',
			subtitle: 'Domande a Scelta Multipla',
			desc: 'Scegli l\'opzione corretta fra 5 alternative. Tentativi infiniti disponibili!',
			href: '/quiz',
			icon: '🎯',
			btnColor: 'duo-btn-orange',
			btnText: 'FAIR QUIZ'
		},
		{
			id: 'scrittura',
			title: 'Scrittura Libera',
			subtitle: 'Esercizio Digitazione',
			desc: 'Scrivi a mano le risposte per fissare meglio la memoria visiva e la grafia.',
			href: '/scrittura',
			icon: '✍️',
			btnColor: 'duo-btn-blue',
			btnText: 'PRATICA SCRITTURA'
		},
		{
			id: 'reels',
			title: 'Reels Ferroviari',
			subtitle: 'Feed Verticale Instagram Style',
			desc: 'Scorri in verticale scheda per scheda, rispondi ai quiz al volo e scopri la risposta.',
			href: '/reels',
			icon: '🎬',
			btnColor: 'duo-btn-purple',
			btnText: 'APRI REELS'
		},
		{
			id: 'wiki',
			title: 'Wiki & Indice A-Z',
			subtitle: 'Dizionario Ferroviario',
			desc: 'Elenco completo di tutti gli acronimi in ordine alfabetico e ricerca globale.',
			href: '/wiki',
			icon: '📚',
			btnColor: 'duo-btn-gray',
			btnText: 'SFOGLIA WIKI'
		}
	];

	let totalXP = $derived(stats.quizCorrect * 15 + stats.cardsStudied * 5);
	let gems = $derived(stats.cardsStudied * 10 + 100);
</script>

<div class="dashboard-container">
	<!-- Duolingo Section Header Banner (Screenshot 1) -->
	<section class="duo-chapter-banner">
		<div class="banner-content">
			<span class="banner-subtitle">SEZIONE 1, CAPITOLO 1</span>
			<h1 class="banner-title">Acronimi e Normativa Ferroviaria RFI</h1>
			<p class="banner-desc">Impariamo i termini, i segnali e la trazione con gli esercizi tattili Duolingo</p>
		</div>
		<a href="/ripasso" class="duo-btn duo-btn-blue banner-action-btn">
			🚀 INIZIA LEZIONE
		</a>
	</section>

	<!-- Duolingo Panoramica Profile Card (Screenshot 4) -->
	<section class="duo-panoramica-card duo-card">
		<h2 class="panoramica-title">Panoramica dello Studio</h2>
		<div class="panoramica-grid">
			<div class="panoramica-item">
				<div class="item-icon-box streak-bg">🔥</div>
				<div class="item-text">
					<span class="item-val">{stats.streakDays}</span>
					<span class="item-lbl">Giorni di slancio</span>
				</div>
			</div>

			<div class="panoramica-item">
				<div class="item-icon-box xp-bg">⚡</div>
				<div class="item-text">
					<span class="item-val">{totalXP}</span>
					<span class="item-lbl">Totale XP</span>
				</div>
			</div>

			<div class="panoramica-item">
				<div class="item-icon-box gem-bg">💎</div>
				<div class="item-text">
					<span class="item-val">{gems}</span>
					<span class="item-lbl">Gemme Ferroviarie</span>
				</div>
			</div>

			<div class="panoramica-item">
				<div class="item-icon-box accuracy-bg">🎯</div>
				<div class="item-text">
					<span class="item-val">{stats.quizAnswered > 0 ? Math.round((stats.quizCorrect / stats.quizAnswered) * 100) : 0}%</span>
					<span class="item-lbl">Accuratezza Quiz</span>
				</div>
			</div>
		</div>
	</section>

	<!-- Daily Featured Card Widget (Screenshot 2 style) -->
	{#if dailyCard}
		<section class="duo-daily-widget duo-card">
			<div class="widget-top">
				<span class="duo-badge">⚡ Acronimo del Giorno</span>
				<span class="cat-pill">{dailyCard.category || 'Generale'}</span>
			</div>
			<div class="widget-body">
				<h2 class="widget-term">{dailyCard.title}</h2>
				<p class="widget-meaning">{dailyCard.description}</p>
			</div>
			<a href="/ripasso" class="duo-btn duo-btn-green widget-btn">
				INIZIA ESERCIZIO
			</a>
		</section>
	{/if}

	<!-- Minigames Selector Grid (Screenshot 5 style) -->
	<section class="games-section">
		<h2 class="section-heading">🎮 Modalità di Allenamento</h2>
		<div class="games-grid">
			{#each minigames as game}
				<div class="duo-game-card duo-card">
					<div class="card-header-row">
						<div class="game-emoji-box">
							<span>{game.icon}</span>
						</div>
						<div class="game-titles">
							<span class="game-subtitle">{game.subtitle}</span>
							<h3 class="game-title">{game.title}</h3>
						</div>
					</div>

					<p class="game-desc">{game.desc}</p>

					<!-- Progress bar effect -->
					<div class="duo-progress-track">
						<div class="duo-progress-fill" style="width: {Math.min(100, Math.max(15, stats.cardsStudied * 8))}%"></div>
					</div>

					<a href={game.href} class="duo-btn {game.btnColor} game-action-btn">
						{game.btnText}
					</a>
				</div>
			{/each}
		</div>
	</section>

	<!-- Catalog / Search Section -->
	<section class="catalog-section">
		<div class="catalog-header-row">
			<h2 class="section-heading">📚 Dizionario Rapido ({filteredCards.length})</h2>
			<div class="search-controls">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Cerca acronimo o parola chiave..."
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
					{#if card.images && card.images.length > 0}
						<div class="photo-indicator">📷 {card.images.length} immagini allegate</div>
					{/if}
				</div>
			{:else}
				<div class="duo-card empty-state">
					Nessun acronimo trovato con i filtri correnti.
				</div>
			{/each}
		</div>
	</section>
</div>

<style>
	.dashboard-container {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	/* Duolingo Section Header Banner (Screenshot 1) */
	.duo-chapter-banner {
		background: #1cb0f6;
		border: 2px solid #1899d6;
		border-bottom: 5px solid #1899d6;
		border-radius: 24px;
		padding: 1.75rem 1.5rem;
		color: #ffffff;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		box-shadow: 0 8px 24px rgba(28, 176, 246, 0.25);
	}

	@media (min-width: 640px) {
		.duo-chapter-banner {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
			padding: 2rem 2.25rem;
		}
	}

	.banner-content {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.banner-subtitle {
		font-size: 0.75rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.9;
	}

	.banner-title {
		font-size: 1.8rem;
		font-weight: 900;
		margin: 0;
		color: #ffffff;
		line-height: 1.2;
	}

	.banner-desc {
		font-size: 0.95rem;
		font-weight: 600;
		opacity: 0.92;
		margin: 0;
	}

	.banner-action-btn {
		background-color: #ffffff !important;
		color: #1cb0f6 !important;
		border-color: #e5e5e5 !important;
		border-bottom-color: #cecece !important;
		font-size: 1rem;
		padding: 0.9rem 1.6rem;
		align-self: flex-start;
	}

	@media (min-width: 640px) {
		.banner-action-btn {
			align-self: center;
			flex-shrink: 0;
		}
	}

	/* Duolingo Panoramica Card (Screenshot 4) */
	.duo-panoramica-card {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.panoramica-title {
		font-size: 1.3rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.panoramica-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0.85rem;
	}

	.panoramica-item {
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-bottom: 3px solid var(--border-depth-color);
		border-radius: 16px;
		padding: 0.85rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.item-icon-box {
		width: 40px;
		height: 40px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.3rem;
		flex-shrink: 0;
	}

	.streak-bg { background: rgba(255, 150, 0, 0.15); border: 1px solid var(--orange-color); }
	.xp-bg { background: rgba(255, 200, 0, 0.15); border: 1px solid var(--yellow-color); }
	.gem-bg { background: rgba(28, 176, 246, 0.15); border: 1px solid var(--accent-color); }
	.accuracy-bg { background: rgba(88, 204, 2, 0.15); border: 1px solid var(--green-color); }

	.item-text {
		display: flex;
		flex-direction: column;
		line-height: 1.1;
	}

	.item-val {
		font-size: 1.2rem;
		font-weight: 900;
		color: var(--text-color);
	}

	.item-lbl {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--text-muted);
	}

	/* Daily Widget */
	.duo-daily-widget {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		background: linear-gradient(145deg, var(--card-bg), var(--card-bg-subtle));
		border-color: var(--green-color);
		border-bottom-color: var(--green-depth);
	}

	.widget-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.cat-pill {
		font-size: 0.75rem;
		font-weight: 800;
		background: var(--card-bg-subtle);
		color: var(--text-muted);
		padding: 0.25rem 0.65rem;
		border-radius: 8px;
		border: 1px solid var(--border-color);
	}

	.widget-term {
		font-size: 1.8rem;
		font-weight: 900;
		color: var(--green-color);
		margin: 0 0 0.35rem 0;
	}

	.widget-meaning {
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--text-muted);
		margin: 0;
	}

	.widget-btn {
		align-self: flex-start;
	}

	.section-heading {
		font-size: 1.4rem;
		font-weight: 900;
		margin-bottom: 1rem;
		color: var(--text-color);
	}

	.games-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.25rem;
	}

	.duo-game-card {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		justify-content: space-between;
	}

	.card-header-row {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.game-emoji-box {
		width: 50px;
		height: 50px;
		border-radius: 16px;
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.6rem;
		flex-shrink: 0;
	}

	.game-titles {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}

	.game-subtitle {
		font-size: 0.72rem;
		font-weight: 800;
		text-transform: uppercase;
		color: var(--accent-color);
	}

	.game-title {
		font-size: 1.2rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.game-desc {
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--text-muted);
		margin: 0;
	}

	/* Duolingo Progress Track */
	.duo-progress-track {
		width: 100%;
		height: 12px;
		background: var(--card-bg-subtle);
		border-radius: 9999px;
		overflow: hidden;
		border: 1px solid var(--border-color);
	}

	.duo-progress-fill {
		height: 100%;
		background: var(--green-color);
		border-radius: 9999px;
		transition: width 0.4s ease;
	}

	.game-action-btn {
		width: 100%;
	}

	/* Catalog / Search Section */
	.catalog-header-row {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 1.25rem;
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
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.duo-input {
		padding: 0.75rem 1rem;
		border-radius: 14px;
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		border-bottom-width: 3px;
		color: var(--text-color);
		font-size: 0.9rem;
		font-family: 'Outfit', sans-serif;
		font-weight: 700;
		outline: none;
	}

	.duo-input:focus {
		border-color: var(--accent-color);
	}

	.search-input {
		flex: 1;
		min-width: 200px;
	}

	.cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 1rem;
	}

	.catalog-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.card-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.card-term {
		font-size: 1.3rem;
		font-weight: 900;
		color: var(--accent-color);
		margin: 0;
	}

	.card-meaning {
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--text-muted);
		margin: 0;
	}

	.photo-indicator {
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--accent-color);
	}

	.empty-state {
		grid-column: 1 / -1;
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
	}
</style>

