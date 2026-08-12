<script lang="ts">
	import type { Card } from '$lib/types/cards';

	let { isOpen, cards, onClose } = $props<{
		isOpen: boolean;
		cards: Card[];
		onClose: () => void;
	}>();

	let searchQuery = $state('');
	let selectedLetter = $state<string>('ALL');
	let expandedId = $state<string | null>(null);

	// Get available initial letters from card titles
	let availableLetters = $derived.by<string[]>(() => {
		const set = new Set<string>();
		for (const card of cards) {
			const first = card.title.trim().charAt(0).toUpperCase();
			if (first >= 'A' && first <= 'Z') {
				set.add(first);
			} else if (first) {
				set.add('#');
			}
		}
		return Array.from(set).sort();
	});

	// Sorted alphabetically and filtered by search and letter
	let filteredSortedCards = $derived.by<Card[]>(() =>
		[...cards]
			.sort((a, b) => a.title.localeCompare(b.title, 'it', { sensitivity: 'base' }))
			.filter((c: Card) => {
				const firstLetter = c.title.trim().charAt(0).toUpperCase();
				const matchesLetter =
					selectedLetter === 'ALL' ||
					(selectedLetter === '#' ? !(firstLetter >= 'A' && firstLetter <= 'Z') : firstLetter === selectedLetter);

				const q = searchQuery.toLowerCase().trim();
				const matchesSearch =
					!q ||
					c.title.toLowerCase().includes(q) ||
					(c.fullName && c.fullName.toLowerCase().includes(q)) ||
					c.description.toLowerCase().includes(q) ||
					(c.tags && c.tags.some((t: string) => t.toLowerCase().includes(q)));

				return matchesLetter && matchesSearch;
			})
	);

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && isOpen) {
			onClose();
		}
	}

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
	}

	function clearFilters() {
		searchQuery = '';
		selectedLetter = 'ALL';
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<div
		class="modal-backdrop"
		onclick={onClose}
		onkeydown={(e) => (e.key === 'Enter' || e.key === 'Escape') && onClose()}
		role="button"
		tabindex="0"
	>
		<div
			class="modal-card duo-card"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<!-- Modal Header -->
			<div class="modal-header">
				<div class="modal-title-group">
					<span class="modal-icon">📚</span>
					<div>
						<h2 class="modal-title">Wiki & Dizionario Ferroviario</h2>
						<p class="modal-subtitle">Indice alfabetico e ricerca rapida in tempo reale</p>
					</div>
				</div>
				<button class="close-btn" onclick={onClose} aria-label="Chiudi">✕</button>
			</div>

			<!-- Search Input Box -->
			<div class="search-box">
				<span class="search-icon">🔍</span>
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Cerca per acronimo, significato o parola chiave..."
					class="duo-input search-input"
				/>
				{#if searchQuery}
					<button class="clear-input-btn" onclick={() => (searchQuery = '')}>✕</button>
				{/if}
			</div>

			<!-- Alphabetical Filter Bar -->
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



			<!-- Results Meta Counter -->
			<div class="results-meta-row">
				<span class="count-text">
					Trovati <strong>{filteredSortedCards.length}</strong> acronimi in ordine alfabetico
				</span>
			</div>

			<!-- Results Cards List -->
			<div class="results-list">
				{#each filteredSortedCards as card (card.id)}
					{@const isExpanded = expandedId === card.id}

					<div class="result-card duo-card" class:expanded={isExpanded}>
						<button class="card-header-btn" onclick={() => toggleExpand(card.id)}>
							<div class="title-group">
								<h3 class="card-title">{card.title}</h3>
								{#if card.fullName}
									<span class="fullname-pill">{card.fullName}</span>
								{/if}
							</div>
							<div class="right-indicator">
								{#if card.images && card.images.length > 0}
									<span class="has-img-badge" title="Contiene foto">📷 {card.images.length}</span>
								{/if}
								<span class="arrow">{isExpanded ? '▲' : '▼'}</span>
							</div>
						</button>

						{#if isExpanded}
							<div class="card-body">
								<p class="description">{card.description}</p>

								{#if card.images && card.images.length > 0}
									<div class="card-images-grid">
										{#each card.images as imgUrl, idx}
											<a href={imgUrl} target="_blank" rel="noopener noreferrer" class="img-thumb-link">
												<img src={imgUrl} alt="{card.title} {idx + 1}" class="card-thumb-img" />
											</a>
										{/each}
									</div>
								{/if}

								{#if card.tags && card.tags.length > 0}
									<div class="tags-row">
										{#each card.tags as tag}
											<span class="tag-pill">#{tag}</span>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{:else}
					<div class="empty-search duo-card">
						<span class="empty-icon">🔎</span>
						<p class="empty-text">Nessun acronimo trovato per i filtri selezionati.</p>
						<button class="duo-btn duo-btn-purple reset-btn" onclick={clearFilters}>
							MOSTRA TUTTI GLI ACRONIMI
						</button>
					</div>
				{/each}
			</div>

			<!-- Footer -->
			<div class="modal-footer">
				<button class="duo-btn duo-btn-gray close-modal-btn" onclick={onClose}>
					CHIUDI
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 300;
		background: rgba(0, 0, 0, 0.8);
		backdrop-filter: blur(10px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		animation: fadeIn 0.2s ease;
	}

	.modal-card {
		width: 100%;
		max-width: 650px;
		max-height: 88vh;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		overflow: hidden;
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		padding: 1.35rem;
		border-radius: 24px;
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
		animation: scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.modal-title {
		font-size: 1.45rem;
		font-weight: 900;
		color: var(--accent-color);
		margin: 0.2rem 0 0 0;
	}

	.close-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		color: var(--text-muted);
		width: 34px;
		height: 34px;
		border-radius: 50%;
		font-size: 1.1rem;
		cursor: pointer;
		font-weight: 900;
		transition: all 0.15s ease;
	}

	.close-btn:hover {
		color: var(--pink-color);
		border-color: var(--pink-color);
		transform: scale(1.08);
	}

	.search-box {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 0.9rem;
		font-size: 1.05rem;
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		padding: 0.85rem 4.5rem 0.85rem 2.6rem;
		font-size: 0.95rem;
		font-weight: 700;
		box-sizing: border-box;
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		color: var(--text-color);
		border-radius: 14px;
		font-family: inherit;
		transition: border-color 0.15s ease;
	}

	.search-input:focus {
		border-color: var(--accent-color);
		outline: none;
	}

	.clear-input-btn {
		position: absolute;
		right: 0.6rem;
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		color: var(--text-muted);
		font-size: 0.72rem;
		font-weight: 800;
		padding: 0.25rem 0.55rem;
		border-radius: 8px;
		cursor: pointer;
	}

	.letter-btn {
		min-width: 28px;
		height: 28px;
		padding: 0 0.35rem;
		font-size: 0.75rem;
		font-weight: 900;
		border-radius: 8px;
		border: 1.5px solid var(--border-color);
		background: var(--card-bg-subtle);
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}

	.letter-btn.active {
		background: var(--green-color);
		color: white;
		border-color: var(--green-depth);
	}

	.results-meta-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.75rem;
		color: var(--text-muted);
		padding: 0.1rem 0;
	}

	.results-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding-right: 0.2rem;
	}

	.result-card {
		padding: 0;
		overflow: hidden;
		border-radius: 14px;
	}

	.card-header-btn {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.85rem 1rem;
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		text-align: left;
	}

	.title-group {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.card-title {
		font-size: 1.15rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.fullname-pill {
		font-size: 0.75rem;
		font-weight: 800;
		padding: 0.15rem 0.5rem;
		border-radius: 6px;
		background: rgba(34, 197, 94, 0.15);
		color: var(--green-color);
		border: 1px solid var(--green-color);
	}

	.right-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.has-img-badge {
		font-size: 0.72rem;
		font-weight: 800;
		padding: 0.15rem 0.45rem;
		border-radius: 6px;
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		color: var(--text-muted);
	}

	.arrow {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.card-body {
		padding: 0.9rem 1rem 1rem 1rem;
		border-top: 1.5px dashed var(--border-color);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: var(--card-bg-subtle);
	}

	.description {
		font-size: 0.92rem;
		line-height: 1.5;
		color: var(--text-color);
		margin: 0;
	}

	.card-images-grid {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		padding-bottom: 0.3rem;
	}

	.card-thumb-img {
		width: 75px;
		height: 75px;
		object-fit: cover;
		border-radius: 10px;
		border: 1.5px solid var(--border-color);
	}

	.tags-row {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.tag-pill {
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.empty-search {
		text-align: center;
		padding: 2rem 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.empty-icon {
		font-size: 2.2rem;
	}

	.empty-text {
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		padding-top: 0.5rem;
		border-top: 2px solid var(--border-color);
	}

	.close-modal-btn {
		width: 100%;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes scaleUp {
		from { transform: scale(0.94); opacity: 0; }
		to { transform: scale(1); opacity: 1; }
	}
</style>
