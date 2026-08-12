<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import type { Card } from '$lib/types/cards';

	let cards = $state<Card[]>([]);
	let searchQuery = $state('');
	let selectedLetter = $state<string>('ALL');
	let expandedCardId = $state<string | null>(null);

	onMount(() => {
		const unsubscribe = cardsStore.subscribe((c) => (cards = c));
		return unsubscribe;
	});

	// Get available letters from titles
	let availableLetters = $derived(() => {
		const set = new Set<string>();
		for (const card of cards) {
			const first = card.title.trim().charAt(0).toUpperCase();
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
		[...cards]
			.sort((a, b) => a.title.localeCompare(b.title, 'it', { sensitivity: 'base' }))
			.filter((c) => {
				// Letter filter
				const firstLetter = c.title.trim().charAt(0).toUpperCase();
				const matchesLetter =
					selectedLetter === 'ALL' ||
					(selectedLetter === '#' ? !(firstLetter >= 'A' && firstLetter <= 'Z') : firstLetter === selectedLetter);

				// Search query
				const q = searchQuery.toLowerCase().trim();
				const matchesSearch =
					!q ||
					c.title.toLowerCase().includes(q) ||
					(c.fullName && c.fullName.toLowerCase().includes(q)) ||
					c.description.toLowerCase().includes(q) ||
					(c.tags && c.tags.some((t) => t.toLowerCase().includes(q)));

				return matchesLetter && matchesSearch;
			})
	);

	function toggleCardExpand(id: string) {
		expandedCardId = expandedCardId === id ? null : id;
	}
</script>

<div class="wiki-container">
	<!-- Page Header -->
	<PageHeader
		title="Wiki & Dizionario Ferroviario"
		subtitle="Consultazione rapida di tutti gli acronimi in ordine alfabetico e ricerca globale."
		badge="Dizionario RFI"
		icon="/emoji/books_3d.png"
		variant="blue"
	/>

	<!-- Global Search Bar & Category Filter -->
	<div class="search-section">
		<div class="search-box">
			<span class="search-icon">🔍</span>
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Cerca acronimo, parola chiave o spiegazione nella Wiki..."
				class="search-input"
			/>
			{#if searchQuery}
				<button class="clear-btn" onclick={() => (searchQuery = '')}>✕</button>
			{/if}
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
			{#each availableLetters() as letter}
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

				<div class="compact-card" class:expanded={isExpanded}>
					<button class="compact-card-header" onclick={() => toggleCardExpand(card.id)}>
						<div class="title-row">
							<h3 class="card-title">{card.title}</h3>
							{#if card.fullName}
								<span class="fullname-pill">{card.fullName}</span>
							{/if}
						</div>

						<div class="meta-row">
							{#if card.images && card.images.length > 0}
								<span class="photo-indicator">📷 {card.images.length} foto</span>
							{/if}
							<span class="expand-arrow">{isExpanded ? '▲' : '▼'}</span>
						</div>
					</button>

					<!-- Expandable Description on Tap -->
					{#if isExpanded}
						<div class="expanded-details">
							<p class="description">{card.description}</p>

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
										<img src={imgUrl} alt={card.title} class="gallery-thumb" />
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{:else}
				<div class="empty-wiki">
					Nessun acronimo trovato corrispondente ai criteri di ricerca.
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.wiki-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 600px;
		margin: 0 auto;
	}

	.search-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 24px;
		padding: 1.25rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
	}

	.search-box {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 1rem;
		font-size: 1.1rem;
	}

	.search-input {
		width: 100%;
		padding: 0.9rem 2.5rem 0.9rem 2.8rem;
		border-radius: 16px;
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		color: var(--text-color);
		font-size: 1rem;
		transition: border-color 0.2s ease;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent-color);
	}

	.clear-btn {
		position: absolute;
		right: 1rem;
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 1rem;
		cursor: pointer;
	}

	.alphabet-bar {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.letter-btn {
		min-width: 32px;
		height: 32px;
		padding: 0 0.4rem;
		border-radius: 8px;
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		color: var(--text-muted);
		font-size: 0.8rem;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.letter-btn.active {
		background: var(--accent-color);
		color: white;
		border-color: var(--accent-color);
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
	}

	.compact-card:hover {
		border-color: var(--accent-color);
	}

	.compact-card-header {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
		background: transparent;
		border: none;
		color: inherit;
		cursor: pointer;
		text-align: left;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.card-title {
		font-size: 1.3rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.fullname-pill {
		font-size: 0.8rem;
		font-weight: 800;
		padding: 0.15rem 0.55rem;
		border-radius: 6px;
		background: rgba(34, 197, 94, 0.15);
		color: var(--green-color);
		border: 1px solid var(--green-color);
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
		padding: 0 1.25rem 1.25rem 1.25rem;
		border-top: 1px solid var(--border-color);
		background: var(--card-bg-subtle);
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		animation: fadeIn 0.25s ease;
	}

	.description {
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--text-color);
		margin-top: 0.85rem;
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

	.empty-wiki {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
		background: var(--card-bg);
		border-radius: 20px;
		border: 1px dashed var(--border-color);
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(6px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
