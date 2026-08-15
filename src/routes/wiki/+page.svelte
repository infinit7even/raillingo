<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { ignoredCardsStore } from '$lib/stores/ignoredCardsStore';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import CategoryFilter from '$lib/components/CategoryFilter.svelte';
	import type { Card } from '$lib/types/cards';

	import { toastStore } from '$lib/stores/toastStore';

	let { data } = $props();
	let user = $derived(data?.user);

	let cards = $state<Card[]>([]);
	import { globalCategoryStore } from '$lib/stores/globalCategoryStore';

	let ignoredIds = $state<Set<string>>(new Set());
	let searchQuery = $state('');
	let selectedCategory = $state('ALL');
	let selectedLetter = $state<string>('ALL');
	let showOnlyIgnored = $state(false);
	let expandedCardId = $state<string | null>(null);

	onMount(() => {
		const unsubCards = cardsStore.subscribe((c) => (cards = c));
		const unsubIgnored = ignoredCardsStore.subscribe((ids) => (ignoredIds = ids));
		const unsubCategory = globalCategoryStore.subscribe((cat) => (selectedCategory = cat));
		return () => {
			unsubCards();
			unsubIgnored();
			unsubCategory();
		};
	});

	let ignoredCount = $derived(ignoredIds.size);

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

	// La Wiki mostra rigorosamente solo le card che possiedono un acronimo reale
	let wikiCards = $derived(cards.filter(isAcronymCard));

	let availableCategories = $derived.by<string[]>(() => {
		const set = new Set<string>();
		for (const c of cards) {
			if (c.category && c.category.trim()) {
				set.add(c.category.trim());
			}
		}
		return Array.from(set).sort();
	});

	// Get available letters from titles (memoized array)
	let availableLetters = $derived.by<string[]>(() => {
		const set = new Set<string>();
		for (const card of wikiCards) {
			const titleText = card.title?.trim() || card.fullName?.trim() || '';
			const first = titleText ? titleText.charAt(0).toUpperCase() : '#';
			if (first >= 'A' && first <= 'Z') {
				set.add(first);
			} else {
				set.add('#');
			}
		}
		return Array.from(set).sort();
	});

	// Sorted alphabetically and filtered
	let filteredSortedCards = $derived(
		[...wikiCards]
			.sort((a, b) =>
				(a.title || a.fullName || '').localeCompare(b.title || b.fullName || '', 'it', {
					sensitivity: 'base'
				})
			)
			.filter((c) => {
				// Category filter
				const matchesCategory =
					selectedCategory === 'ALL' || (c.category && c.category.trim() === selectedCategory);

				// Letter filter
				const titleText = c.title?.trim() || c.fullName?.trim() || '';
				const firstLetter = titleText ? titleText.charAt(0).toUpperCase() : '#';
				const matchesLetter =
					selectedLetter === 'ALL' ||
					(selectedLetter === '#'
						? !(firstLetter >= 'A' && firstLetter <= 'Z')
						: firstLetter === selectedLetter);

				// Ignored filter
				const matchesIgnored = !showOnlyIgnored || ignoredIds.has(c.id);

				// Search query
				const q = searchQuery.toLowerCase().trim();
				const matchesSearch =
					!q ||
					(c.title && c.title.toLowerCase().includes(q)) ||
					(c.fullName && c.fullName.toLowerCase().includes(q)) ||
					(c.description && c.description.toLowerCase().includes(q)) ||
					(c.tags && c.tags.some((t) => t.toLowerCase().includes(q)));

				return matchesCategory && matchesLetter && matchesIgnored && matchesSearch;
			})
	);

	function toggleCardExpand(id: string) {
		expandedCardId = expandedCardId === id ? null : id;
	}

	async function toggleIgnored(e: MouseEvent, cardId: string) {
		e.stopPropagation();
		const isNowIgnored = await ignoredCardsStore.toggleIgnored(cardId);
		toastStore.show({
			message: isNowIgnored ? '⭐ Scheda ignorata dal ripasso' : '✨ Scheda riattivata nel ripasso',
			actionLabel: 'Annulla',
			onAction: async () => {
				await ignoredCardsStore.toggleIgnored(cardId);
			}
		});
	}

	async function handleClearAllIgnored() {
		const previousIgnored = Array.from(ignoredIds);
		await ignoredCardsStore.clearAll();
		showOnlyIgnored = false;

		toastStore.show({
			message: '✨ Tutte le schede sono state riattivate nel ripasso!',
			actionLabel: 'Annulla',
			onAction: async () => {
				await ignoredCardsStore.setIgnoredIds(previousIgnored);
			}
		});
	}
</script>

<div class="wiki-container">
	<!-- Page Header -->
	<PageHeader
		title="Wiki & Dizionario Ferroviario"
		subtitle="Consultazione rapida di tutti gli acronimi in ordine alfabetico e gestione card ignorate."
		icon="/emoji/books_3d.png"
		variant="blue"
	/>

	<!-- Standalone Category Filter directly below PageHeader -->
	<CategoryFilter
		categories={availableCategories}
		{selectedCategory}
		onSelect={(cat) => (selectedCategory = cat)}
	/>

	<!-- Global Search Bar & Actions Toolbar -->
	<div class="search-section">
		<div class="search-bar-row">
			<div class="search-box">
				<span class="search-icon">🔍</span>
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Cerca acronimo, spiegazione..."
					class="search-input"
				/>
				{#if searchQuery}
					<button class="clear-btn" onclick={() => (searchQuery = '')}>✕</button>
				{/if}
			</div>

			<div class="search-actions-group">
				<button
					type="button"
					class="duo-btn filter-ignored-chip"
					class:active-filter={showOnlyIgnored}
					onclick={() => (showOnlyIgnored = !showOnlyIgnored)}
					title="Mostra solo schede ignorate"
				>
					⭐ <span class="action-btn-label">Ignorate</span> ({ignoredCount})
				</button>

				{#if ignoredIds.size > 0}
					<button
						type="button"
						class="duo-btn duo-btn-purple clear-all-ignored-btn"
						onclick={handleClearAllIgnored}
						title="Riattiva tutte le schede ignorate"
					>
						✨ <span class="action-btn-label">Riattiva ({ignoredIds.size})</span>
					</button>
				{/if}

				{#if !user}
					<a
						href="/api/auth/login"
						class="duo-btn sync-btn discord-sync-btn discord-wiki-login-btn"
						title="Accedi con Discord"
					>
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
						<span class="action-btn-label">ACCEDI</span>
					</a>
				{/if}
			</div>
		</div>

		<!-- Alphabet Filter Bar -->
		<div class="alphabet-bar">
			<button
				class="letter-btn"
				class:active={selectedLetter === 'ALL'}
				onclick={() => (selectedLetter = 'ALL')}
			>
				TUTTI
			</button>
			{#each availableLetters as letter}
				<button
					class="letter-btn"
					class:active={selectedLetter === letter}
					onclick={() => (selectedLetter = letter)}
				>
					{letter}
				</button>
			{/each}
		</div>
	</div>

	<!-- Alphabetical Compact Cards List -->
	<div class="cards-section">
		<div class="result-count">
			Trovati <strong>{filteredSortedCards.length}</strong> acronimi in ordine alfabetico
		</div>

		<div class="compact-grid">
			{#each filteredSortedCards as card}
				{@const isExpanded = expandedCardId === card.id}
				{@const isIgnored = ignoredIds.has(card.id)}

				<div class="compact-card" class:expanded={isExpanded} class:is-ignored-card={isIgnored}>
					<div class="compact-card-header">
						<button class="header-main-btn" onclick={() => toggleCardExpand(card.id)}>
							<div class="title-row">
								<!-- Mostra SOLO l'acronimo nei titoli della wiki -->
								<h3 class="card-title">{card.title || card.fullName}</h3>
								{#if isIgnored}
									<span class="ignored-pill-badge">⚠️ IGNORATA</span>
								{/if}
							</div>

							<div class="meta-row">
								{#if card.images && card.images.length > 0}
									<span class="photo-indicator">📷 {card.images.length} foto</span>
								{/if}
								<span class="expand-arrow">{isExpanded ? '▲' : '▼'}</span>
							</div>
						</button>

						<!-- Stellina Ignora / Disignora globale -->
						<button
							class="star-ignored-btn"
							class:ignored={isIgnored}
							onclick={(e) => toggleIgnored(e, card.id)}
							title={isIgnored
								? 'Card ignorata dai minigiochi. Clicca per riattivarla'
								: 'Fai clic sulla stellina per ignorare la card nei minigiochi'}
							aria-label="Toggle ignorata"
						>
							★
						</button>
					</div>

					<!-- Expandable Details on Tap -->
					{#if isExpanded}
						<div class="expanded-details">
							{#if card.fullName}
								<div class="fullname-text-detail">
									<strong>Titolo completo:</strong>
									{card.fullName}
								</div>
							{/if}

							<p class="description">{card.description}</p>

							{#if card.category}
								<div class="category-info-row">
									<span class="cat-label">Categoria:</span>
									<span class="cat-val">{card.category}</span>
								</div>
							{/if}

							{#if card.tags && card.tags.length > 0}
								<div class="tags-list">
									{#each card.tags as tag}
										<span class="tag-pill">#{tag}</span>
									{/each}
								</div>
							{/if}

							{#if card.images && card.images.length > 0}
								<div class="gallery">
									{#each card.images as imgUrl}
										<img
											src={imgUrl}
											alt={card.title}
											class="gallery-thumb"
											loading="lazy"
											decoding="async"
										/>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{:else}
				<div class="empty-wiki">Nessun acronimo trovato corrispondente ai criteri di ricerca.</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.wiki-container {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 600px;
		margin: 0 auto;
	}

	.search-section {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		border-bottom: 5px solid var(--border-depth-color);
		border-radius: 24px;
		padding: 1.15rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
	}

	.search-bar-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
	}

	.search-box {
		position: relative;
		display: flex;
		align-items: center;
		flex: 1;
		min-width: 0;
	}

	.search-actions-group {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-shrink: 0;
	}

	.search-icon {
		position: absolute;
		left: 1rem;
		font-size: 1.15rem;
		pointer-events: none;
		z-index: 2;
	}

	.search-input {
		width: 100%;
		height: 44px;
		padding: 0 2.5rem 0 2.8rem;
		border-radius: 16px;
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-bottom: 3.5px solid var(--border-depth-color);
		color: var(--text-color);
		font-family: 'Outfit', sans-serif;
		font-size: 0.95rem;
		font-weight: 700;
		box-sizing: border-box;
		transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent-color);
		border-bottom-color: var(--accent-depth);
		background: var(--card-bg);
		box-shadow: 0 4px 14px var(--shadow-color);
	}

	.clear-btn {
		position: absolute;
		right: 0.85rem;
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		border-radius: 50%;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 900;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.clear-btn:hover {
		color: var(--text-color);
		border-color: var(--accent-color);
	}

	.alphabet-bar {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
		padding-top: 0.25rem;
		border-top: 1.5px dashed var(--border-color);
	}

	.letter-btn {
		min-width: 34px;
		height: 34px;
		padding: 0 0.5rem;
		border-radius: 10px;
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-bottom: 3px solid var(--border-depth-color);
		color: var(--text-muted);
		font-family: 'Outfit', sans-serif;
		font-size: 0.8rem;
		font-weight: 900;
		cursor: pointer;
		user-select: none;
		transition: all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.letter-btn:hover:not(.active) {
		color: var(--text-color);
		border-color: var(--accent-color);
	}

	.letter-btn:active {
		transform: translateY(2px);
		border-bottom-width: 1.5px;
	}

	.letter-btn.active {
		background: var(--accent-color);
		color: white;
		border-color: var(--accent-depth);
		border-bottom-color: var(--accent-depth);
		box-shadow: 0 3px 10px var(--shadow-color);
	}

	.result-count {
		font-size: 0.875rem;
		color: var(--text-muted);
		margin-bottom: 0.75rem;
	}

	.compact-grid {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.compact-card {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 16px;
		overflow: hidden;
		transition: border-color 0.2s ease;
		content-visibility: auto;
		contain-intrinsic-size: 58px;
	}

	.compact-card.is-ignored-card {
		opacity: 0.85;
		border-style: dashed;
		border-color: var(--yellow-color);
	}

	.compact-card:hover {
		border-color: var(--accent-color);
	}

	.compact-card-header {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		gap: 0.5rem;
	}

	.header-main-btn {
		flex: 1;
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: transparent;
		border: none;
		color: inherit;
		cursor: pointer;
		text-align: left;
		padding: 0;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.card-title {
		font-size: 1.3rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.ignored-pill-badge {
		font-size: 0.68rem;
		font-weight: 900;
		padding: 0.15rem 0.45rem;
		border-radius: 6px;
		background: rgba(234, 179, 8, 0.15);
		color: #eab308;
		border: 1px solid #eab308;
	}

	.star-ignored-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.25rem;
		line-height: 1;
		transition:
			transform 0.2s ease,
			color 0.2s ease;
	}

	.star-ignored-btn.ignored {
		color: var(--yellow-color);
		transform: scale(1.25);
		animation: starPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.meta-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.photo-indicator {
		font-size: 0.75rem;
		color: var(--text-muted);
		font-weight: 600;
	}

	.expand-arrow {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.expanded-details {
		padding: 0.85rem 1.25rem 1.25rem 1.25rem;
		border-top: 1px solid var(--border-color);
		background: var(--card-bg-subtle);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		animation: fadeIn 0.25s ease;
	}

	.fullname-text-detail {
		font-size: 0.95rem;
		color: var(--accent-color);
	}

	.description {
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--text-color);
		margin: 0;
	}

	.category-info-row {
		font-size: 0.8rem;
		display: flex;
		gap: 0.4rem;
	}

	.cat-label {
		font-weight: 800;
		color: var(--text-muted);
	}

	.cat-val {
		font-weight: 800;
		color: var(--green-color);
	}

	.tags-list {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.tag-pill {
		font-size: 0.75rem;
		color: var(--text-muted);
		background: var(--card-bg);
		padding: 0.15rem 0.5rem;
		border-radius: 6px;
	}

	.gallery {
		display: flex;
		gap: 0.6rem;
		overflow-x: auto;
		padding-top: 0.25rem;
	}

	.gallery-thumb {
		width: 100px;
		height: 75px;
		object-fit: cover;
		border-radius: 8px;
		border: 1px solid var(--border-color);
	}

	@media (max-width: 600px) {
		.search-bar-row {
			flex-direction: column;
			align-items: stretch;
		}

		.search-actions-group {
			justify-content: flex-start;
			overflow-x: auto;
			padding-bottom: 0.2rem;
		}
	}

	.filter-ignored-chip,
	.clear-all-ignored-btn,
	.discord-wiki-login-btn {
		height: 36px;
		padding: 0 0.85rem;
		font-size: 0.78rem;
		font-weight: 800;
		border-radius: 12px;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		box-sizing: border-box;
		text-decoration: none;
		line-height: 1;
	}

	.filter-ignored-chip {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		color: var(--text-color);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.filter-ignored-chip.active-filter {
		background: rgba(250, 204, 21, 0.18);
		border-color: var(--yellow-color);
		color: var(--yellow-color);
		box-shadow: 0 2px 8px rgba(250, 204, 21, 0.2);
	}

	.discord-wiki-login-btn {
		background-color: #5865f2;
		border: 1.5px solid #4752c4;
		color: #ffffff;
	}

	.discord-icon-mini {
		width: 15px;
		height: 15px;
		flex-shrink: 0;
	}

	.empty-wiki {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
		background: var(--card-bg);
		border-radius: 20px;
		border: 1px dashed var(--border-color);
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
