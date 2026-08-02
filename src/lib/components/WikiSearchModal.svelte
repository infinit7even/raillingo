<script lang="ts">
	import type { Card } from '$lib/types/cards';

	let { isOpen, cards, onClose } = $props<{
		isOpen: boolean;
		cards: Card[];
		onClose: () => void;
	}>();

	let searchQuery = $state('');
	let expandedId = $state<string | null>(null);

	let filteredCards = $derived(
		cards.filter((c: Card) => {
			const q = searchQuery.toLowerCase().trim();
			return (
				!q ||
				c.title.toLowerCase().includes(q) ||
				c.description.toLowerCase().includes(q) ||
				(c.tags && c.tags.some((t: string) => t.toLowerCase().includes(q))) ||
				(c.category && c.category.toLowerCase().includes(q))
			);
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
			<!-- Header -->
			<div class="modal-header">
				<div class="header-title-box">
					<span class="duo-badge">Ricerca Rapida Wiki</span>
					<h2 class="modal-title">🔍 Consulta Acronimi</h2>
				</div>
				<button class="close-btn" onclick={onClose} aria-label="Chiudi modal">✕</button>
			</div>

			<!-- Search Input Box -->
			<div class="search-box">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Digita per cercare un acronimo o termine..."
					class="duo-input search-input"
					autofocus
				/>
			</div>

			<!-- Results List -->
			<div class="results-list">
				{#each filteredCards as card}
					{@const isExpanded = expandedId === card.id}
					<div class="result-card duo-card" class:expanded={isExpanded}>
						<button class="card-header-btn" onclick={() => toggleExpand(card.id)}>
							<div class="title-group">
								<h3 class="card-title">{card.title}</h3>
								{#if card.category}
									<span class="category-pill">{card.category}</span>
								{/if}
							</div>
							<span class="arrow">{isExpanded ? '▲' : '▼'}</span>
						</button>

						{#if isExpanded}
							<div class="card-body">
								<p class="description">{card.description}</p>
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
						Nessun acronimo trovato per "{searchQuery}".
					</div>
				{/each}
			</div>

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
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		animation: fadeIn 0.2s ease;
	}

	.modal-card {
		width: 100%;
		max-width: 580px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		overflow: hidden;
		animation: scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.modal-title {
		font-size: 1.5rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0.25rem 0 0 0;
	}

	.close-btn {
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		color: var(--text-muted);
		width: 32px;
		height: 32px;
		border-radius: 50%;
		font-size: 1rem;
		cursor: pointer;
	}

	.search-input {
		width: 100%;
		box-sizing: border-box;
		font-size: 1rem;
	}

	.results-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding-right: 0.25rem;
	}

	.result-card {
		padding: 0;
		overflow: hidden;
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
		gap: 0.6rem;
	}

	.card-title {
		font-size: 1.15rem;
		font-weight: 900;
		color: var(--accent-color);
		margin: 0;
	}

	.category-pill {
		font-size: 0.7rem;
		font-weight: 800;
		background: var(--accent-light-bg);
		color: var(--accent-color);
		padding: 0.15rem 0.45rem;
		border-radius: 6px;
	}

	.arrow {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.card-body {
		padding: 0 1rem 1rem 1rem;
		border-top: 1px solid var(--border-color);
		background: var(--card-bg-subtle);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.description {
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--text-color);
		margin-top: 0.65rem;
	}

	.tags-row {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.tag-pill {
		font-size: 0.7rem;
		color: var(--text-muted);
		background: var(--card-bg);
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
	}

	.empty-search {
		text-align: center;
		padding: 2rem;
		color: var(--text-muted);
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
	}

	.close-modal-btn {
		width: 100%;
		font-size: 0.9rem;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes scaleUp {
		from { opacity: 0; transform: scale(0.95); }
		to { opacity: 1; transform: scale(1); }
	}
</style>
