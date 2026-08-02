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
		const uncards = cardsStore.subscribe((c) => (cards = c));
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
			color: 'linear-gradient(135deg, #0284c7, #38bdf8)'
		},
		{
			id: 'ripasso-foto',
			title: 'Modalità Foto',
			subtitle: 'Foto ➔ Acronimo ➔ Descrizione',
			desc: 'Guarda l\'immagine, scopri prima il titolo e con un secondo click la descrizione.',
			href: '/ripasso-foto',
			icon: '📷',
			color: 'linear-gradient(135deg, #7c3aed, #a855f7)'
		},
		{
			id: 'ripasso-inverso',
			title: 'Ripasso Inverso',
			subtitle: 'Descrizione ➔ Acronimo',
			desc: 'Leggi la spiegazione e indovina qual è l\'acronimo o termine corrispondente.',
			href: '/ripasso-inverso',
			icon: '🔄',
			color: 'linear-gradient(135deg, #059669, #34d399)'
		},
		{
			id: 'quiz',
			title: 'Quiz a 5 Scelte',
			subtitle: 'Domande a Scelta Multipla',
			desc: 'Scegli l\'opzione corretta fra 5 alternative. Tentativi infiniti disponibili!',
			href: '/quiz',
			icon: '🎯',
			color: 'linear-gradient(135deg, #d97706, #fbbf24)'
		},
		{
			id: 'scrittura',
			title: 'Scrittura Libera',
			subtitle: 'Esercizio Digitazione',
			desc: 'Scrivi a mano le risposte per fissare meglio la memoria visiva e la grafia.',
			href: '/scrittura',
			icon: '✍️',
			color: 'linear-gradient(135deg, #e11d48, #fb7185)'
		}
	];
</script>

<div class="dashboard-container">
	<!-- Hero Header -->
	<section class="hero-section">
		<div class="hero-content">
			<span class="hero-badge">Ferrovie dello Stato Italiane</span>
			<h1 class="hero-title">RF - Rail Focus</h1>
			<p class="hero-desc">
				La tua piattaforma interattiva per memorizzare acronimi, segnali e terminologie del corso ferroviario.
			</p>
			
			<div class="hero-actions">
				<a href="/ripasso" class="primary-btn">
					🚀 Inizia Subito il Ripasso
				</a>
			</div>
		</div>

		<!-- Quick Stats Banner -->
		<div class="stats-banner">
			<div class="stat-item">
				<span class="stat-value">{cards.length}</span>
				<span class="stat-label">Schede in DB</span>
			</div>
			<div class="stat-divider"></div>
			<div class="stat-item">
				<span class="stat-value">{stats.cardsStudied}</span>
				<span class="stat-label">Ripassi Effettuati</span>
			</div>
			<div class="stat-divider"></div>
			<div class="stat-item">
				<span class="stat-value">{stats.quizAnswered > 0 ? Math.round((stats.quizCorrect / stats.quizAnswered) * 100) : 0}%</span>
				<span class="stat-label">Accuratezza Quiz</span>
			</div>
		</div>
	</section>

	<!-- Minigames Selector Grid -->
	<section class="games-section">
		<h2 class="section-title">🎮 Scegli la Modalità di Studio</h2>
		<div class="games-grid">
			{#each minigames as game}
				<a href={game.href} class="game-card">
					<div class="game-icon-box" style="background: {game.color}">
						<span>{game.icon}</span>
					</div>
					<div class="game-info">
						<span class="game-subtitle">{game.subtitle}</span>
						<h3 class="game-title">{game.title}</h3>
						<p class="game-desc">{game.desc}</p>
					</div>
				</a>
			{/each}
		</div>
	</section>

	<!-- Catalog / Search Section -->
	<section class="catalog-section">
		<div class="catalog-header">
			<h2 class="section-title">📚 Consultazione Acronimi ({filteredCards.length})</h2>
			<div class="search-bar">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Cerca acronimo o parola chiave..."
					class="search-input"
				/>
				<select bind:value={selectedCategory} class="category-select">
					<option value="all">Tutte le Categorie</option>
					{#each categories as cat}
						<option value={cat}>{cat}</option>
					{/each}
				</select>
			</div>
		</div>

		<div class="cards-grid">
			{#each filteredCards as card}
				<div class="item-card">
					<div class="item-header">
						<h3 class="item-title">{card.title}</h3>
						{#if card.category}
							<span class="item-cat">{card.category}</span>
						{/if}
					</div>
					<p class="item-desc">{card.description}</p>
					{#if card.images && card.images.length > 0}
						<div class="has-photo-badge">📷 {card.images.length} foto</div>
					{/if}
				</div>
			{:else}
				<div class="empty-state">
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
		gap: 2.5rem;
	}

	.hero-section {
		background: linear-gradient(135deg, var(--card-bg), var(--card-bg-subtle));
		border: 1px solid var(--border-color);
		border-radius: 28px;
		padding: 2.5rem 2rem;
		box-shadow: 0 12px 36px rgba(0, 0, 0, 0.15);
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.hero-content {
		max-width: 650px;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.hero-badge {
		align-self: flex-start;
		padding: 0.35rem 0.85rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		background: var(--accent-light-bg);
		color: var(--accent-color);
		border: 1px solid var(--border-color);
	}

	.hero-title {
		font-size: 3rem;
		font-weight: 900;
		letter-spacing: -0.03em;
		background: linear-gradient(135deg, var(--text-color), var(--accent-color));
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		line-height: 1.1;
	}

	.hero-desc {
		font-size: 1.1rem;
		line-height: 1.6;
		color: var(--text-muted);
	}

	.primary-btn {
		display: inline-flex;
		align-items: center;
		padding: 1rem 1.75rem;
		border-radius: 16px;
		background: linear-gradient(135deg, var(--accent-color), #0284c7);
		color: white;
		font-weight: 800;
		font-size: 1.1rem;
		text-decoration: none;
		box-shadow: 0 6px 20px rgba(2, 132, 199, 0.4);
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	.primary-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 26px rgba(2, 132, 199, 0.5);
	}

	.stats-banner {
		display: flex;
		align-items: center;
		justify-content: space-around;
		background: var(--bg-color);
		padding: 1.25rem 1.5rem;
		border-radius: 20px;
		border: 1px solid var(--border-color);
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.stat-value {
		font-size: 1.75rem;
		font-weight: 900;
		color: var(--accent-color);
	}

	.stat-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-muted);
	}

	.stat-divider {
		width: 1px;
		height: 36px;
		background-color: var(--border-color);
	}

	.section-title {
		font-size: 1.5rem;
		font-weight: 800;
		margin-bottom: 1.25rem;
		color: var(--text-color);
	}

	.games-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.25rem;
	}

	.game-card {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 22px;
		padding: 1.5rem;
		text-decoration: none;
		display: flex;
		gap: 1.25rem;
		align-items: flex-start;
		transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
	}

	.game-card:hover {
		transform: translateY(-3px);
		border-color: var(--accent-color);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
	}

	.game-icon-box {
		width: 52px;
		height: 52px;
		border-radius: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.6rem;
		color: white;
		flex-shrink: 0;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}

	.game-info {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.game-subtitle {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--accent-color);
	}

	.game-title {
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--text-color);
		margin: 0;
	}

	.game-desc {
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--text-muted);
		margin: 0;
	}

	.catalog-header {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	@media (min-width: 640px) {
		.catalog-header {
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
		}
	}

	.search-bar {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.search-input, .category-select {
		padding: 0.75rem 1rem;
		border-radius: 14px;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		color: var(--text-color);
		font-size: 0.9rem;
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

	.item-card {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 18px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.item-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.item-title {
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--accent-color);
		margin: 0;
	}

	.item-cat {
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		background: var(--badge-bg);
		color: var(--text-muted);
	}

	.item-desc {
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--text-muted);
		margin: 0;
	}

	.has-photo-badge {
		font-size: 0.75rem;
		color: var(--accent-color);
		font-weight: 600;
	}

	.empty-state {
		grid-column: 1 / -1;
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
		background: var(--card-bg);
		border-radius: 18px;
		border: 1px dashed var(--border-color);
	}
</style>
