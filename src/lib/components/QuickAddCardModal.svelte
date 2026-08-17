<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import CardForm from '$lib/components/CardForm.svelte';
	import type { Card } from '$lib/types/cards';
	import { fade, scale } from 'svelte/transition';
	import { toastStore } from '$lib/stores/toastStore';

	let { isOpen, onClose } = $props<{
		isOpen: boolean;
		onClose: () => void;
		cards?: Card[];
	}>();

	let activeTab = $state<'form' | 'browse'>('form');
	let searchQuery = $state('');
	let selectedCategory = $state<string>('ALL');
	let clonedFromCard = $state<Card | null>(null);

	let allCards = $state<Card[]>([]);

	onMount(() => {
		const unsub = cardsStore.subscribe((c) => (allCards = c));
		return unsub;
	});

	// Derive unique categories from existing cards
	let availableCategories = $derived.by<string[]>(() => {
		const set = new Set<string>();
		for (const c of allCards) {
			if (c.category && c.category.trim()) {
				set.add(c.category.trim());
			}
		}
		return Array.from(set).sort();
	});

	// Filtered cards for the browse & duplicate tab
	let filteredCards = $derived.by<Card[]>(() => {
		let list = [...allCards];

		if (selectedCategory !== 'ALL') {
			list = list.filter((c) => (c.category?.trim() || '') === selectedCategory);
		}

		const q = searchQuery.toLowerCase().trim();
		if (q) {
			list = list.filter(
				(c) =>
					c.title.toLowerCase().includes(q) ||
					(c.fullName && c.fullName.toLowerCase().includes(q)) ||
					(c.description && c.description.toLowerCase().includes(q)) ||
					(c.category && c.category.toLowerCase().includes(q))
			);
		}

		return list;
	});

	function handleDuplicateCard(card: Card) {
		clonedFromCard = {
			...card,
			id: '', // Ensure new card creation
			title: card.title,
			fullName: card.fullName || '',
			description: card.description || '',
			category: card.category || '',
			images: card.images ? [...card.images] : []
		};
		activeTab = 'form';
		toastStore.show({ message: `📋 Dati clonati da "${card.title}"! Modifica e salva.` });
	}

	function handleResetClone() {
		clonedFromCard = null;
	}

	async function handleSaveCard(data: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>) {
		await cardsStore.addCard(data);
		clonedFromCard = null;
		activeTab = 'form';
		onClose();
	}

	function handleCloseModal() {
		onClose();
	}
</script>

{#if isOpen}
	<div
		class="modal-backdrop"
		onclick={handleCloseModal}
		onkeydown={(e) => e.key === 'Escape' && handleCloseModal()}
		role="presentation"
		transition:fade={{ duration: 140 }}
	>
		<div
			class="modal-card duo-card"
			onclick={(e) => e.stopPropagation()}
			role="presentation"
			transition:scale={{ start: 0.94, duration: 180 }}
		>
			<!-- Header -->
			<div class="modal-header">
				<div class="modal-title-group">
					<span class="modal-icon">⚡</span>
					<div class="title-text-wrap">
						<h2>Aggiungi Scheda</h2>
						<span class="modal-subtitle">Crea nuove card o clona da schede esistenti</span>
					</div>
				</div>
				<button class="close-btn" onclick={handleCloseModal} aria-label="Chiudi modal">✕</button>
			</div>

			<!-- Navigation Mode Tabs -->
			<div class="modal-tabs-bar">
				<button
					type="button"
					class="modal-tab-btn"
					class:active={activeTab === 'form'}
					onclick={() => (activeTab = 'form')}
				>
					<span>✍️</span>
					<span>Nuova Scheda</span>
					{#if clonedFromCard}
						<span class="clone-tab-badge">📋 Clonata</span>
					{/if}
				</button>

				<button
					type="button"
					class="modal-tab-btn"
					class:active={activeTab === 'browse'}
					onclick={() => (activeTab = 'browse')}
				>
					<span>🔍</span>
					<span>Cerca & Duplica</span>
					<span class="tab-count-pill">{allCards.length}</span>
				</button>
			</div>

			<!-- Modal Body Content -->
			<div class="modal-body">
				{#if activeTab === 'form'}
					<!-- Clone Info Notice Banner -->
					{#if clonedFromCard}
						<div class="cloned-notice-banner duo-card" transition:fade={{ duration: 120 }}>
							<div class="notice-info">
								<span class="notice-icon">📋</span>
								<div class="notice-text">
									<strong>Modalità Duplicazione Attiva</strong>
									<span>Stai creando una nuova scheda basata su <em>"{clonedFromCard.title}"</em>.</span>
								</div>
							</div>
							<button type="button" class="reset-clone-btn" onclick={handleResetClone} title="Azzera e crea scheda vuota">
								✕ Scheda Vuota
							</button>
						</div>
					{/if}

					<!-- Universal Card Form -->
					<CardForm
						initialCard={clonedFromCard}
						onSave={handleSaveCard}
						onCancel={handleCloseModal}
						submitLabel={clonedFromCard ? '⚡ SALVA SCHEDA DUPLICATA' : '⚡ AGGIUNGI ORA SCHEDA'}
					/>
				{:else}
					<!-- Browse, Search & Duplicate Tab -->
					<div class="browse-duplicate-panel">
						<!-- Live Search Input -->
						<div class="browse-search-bar">
							<span class="search-ico">🔍</span>
							<input
								type="text"
								bind:value={searchQuery}
								placeholder="Cerca per acronimo, significato, categoria o testo..."
								class="browse-search-input"
							/>
							{#if searchQuery}
								<button type="button" class="clear-search-btn" onclick={() => (searchQuery = '')}>
									✕
								</button>
							{/if}
						</div>

						<!-- Categories Horizontal Filter Pills -->
						<div class="category-pills-row">
							<button
								type="button"
								class="cat-chip-btn"
								class:active={selectedCategory === 'ALL'}
								onclick={() => (selectedCategory = 'ALL')}
							>
								🏷️ Tutte ({allCards.length})
							</button>
							{#each availableCategories as cat}
								{@const count = allCards.filter((c) => c.category === cat).length}
								<button
									type="button"
									class="cat-chip-btn"
									class:active={selectedCategory === cat}
									onclick={() => (selectedCategory = cat)}
								>
									{cat} ({count})
								</button>
							{/each}
						</div>

						<!-- Existing Cards List for Duplication -->
						<div class="browse-cards-list">
							{#if filteredCards.length === 0}
								<div class="browse-empty-state">
									<p>Nessuna scheda trovata con i filtri selezionati.</p>
								</div>
							{:else}
								{#each filteredCards as card (card.id)}
									<div class="browse-card-item duo-card">
										{#if card.images && card.images.length > 0}
											<div class="card-thumb-box">
												<img src={card.images[0]} alt="" class="card-thumb-img" />
											</div>
										{/if}

										<div class="browse-card-details">
											<div class="card-title-line">
												<span class="bcard-title">{card.title}</span>
												{#if card.fullName && card.fullName.trim().toLowerCase() !== card.title.trim().toLowerCase()}
													<span class="bcard-fullname">({card.fullName})</span>
												{/if}
												{#if card.category}
													<span class="bcard-cat-badge">{card.category}</span>
												{/if}
											</div>

											{#if card.description}
												<p class="bcard-desc">{card.description}</p>
											{/if}
										</div>

										<div class="browse-card-actions">
											<button
												type="button"
												class="duo-btn duo-btn-green clone-action-btn"
												onclick={() => handleDuplicateCard(card)}
												title="Clona i campi di questa scheda per crearne una nuova"
											>
												<span>📋</span>
												<span>Duplica</span>
											</button>
										</div>
									</div>
								{/each}
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 999;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		box-sizing: border-box;
	}

	.modal-card {
		width: 100%;
		max-width: 680px;
		max-height: 88vh;
		overflow-y: auto;
		background: var(--card-bg);
		border-radius: 24px;
		border: 2px solid var(--border-color);
		border-bottom: 6px solid var(--border-depth-color);
		box-shadow: 0 20px 48px rgba(0, 0, 0, 0.45);
		padding: 1.25rem 1.4rem;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.65rem;
		border-bottom: 2px solid var(--border-color);
		gap: 0.5rem;
	}

	.modal-title-group {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.modal-icon {
		font-size: 1.4rem;
		flex-shrink: 0;
	}

	.title-text-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.modal-header h2 {
		font-family: 'Outfit', sans-serif;
		font-size: 1.25rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
		line-height: 1.2;
	}

	.modal-subtitle {
		font-size: 0.74rem;
		font-weight: 700;
		color: var(--text-muted);
	}

	.close-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		color: var(--text-muted);
		width: 32px;
		height: 32px;
		border-radius: 50%;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 900;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
		flex-shrink: 0;
	}

	.close-btn:hover {
		color: var(--text-color);
		border-color: var(--accent-color);
		background: var(--hover-bg);
	}

	/* Modal Mode Tabs */
	.modal-tabs-bar {
		display: flex;
		gap: 0.4rem;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 14px;
		padding: 0.25rem;
	}

	.modal-tab-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.45rem 0.75rem;
		border-radius: 10px;
		border: 1.5px solid transparent;
		background: transparent;
		color: var(--text-muted);
		font-family: 'Outfit', sans-serif;
		font-size: 0.82rem;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.15s ease;
		user-select: none;
	}

	.modal-tab-btn:hover {
		color: var(--text-color);
	}

	.modal-tab-btn.active {
		background: var(--card-bg);
		border-color: var(--border-color);
		color: var(--accent-color);
		box-shadow: 0 2px 8px var(--shadow-color);
	}

	.clone-tab-badge {
		background: var(--green-color);
		color: #ffffff;
		font-size: 0.65rem;
		font-weight: 900;
		padding: 0.1rem 0.4rem;
		border-radius: 6px;
	}

	.tab-count-pill {
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		color: var(--text-muted);
		font-size: 0.68rem;
		font-weight: 900;
		padding: 0.05rem 0.35rem;
		border-radius: 9999px;
	}

	.modal-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* Clone Notice Banner */
	.cloned-notice-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0.65rem 0.85rem;
		background: rgba(88, 204, 2, 0.12);
		border: 1.5px solid var(--green-color);
		border-radius: 14px;
	}

	.notice-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.notice-icon {
		font-size: 1.2rem;
	}

	.notice-text {
		display: flex;
		flex-direction: column;
		font-size: 0.76rem;
		color: var(--text-color);
	}

	.notice-text strong {
		color: var(--green-color);
		font-size: 0.8rem;
	}

	.reset-clone-btn {
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		border-radius: 8px;
		padding: 0.25rem 0.55rem;
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--text-muted);
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.12s ease;
	}

	.reset-clone-btn:hover {
		color: #ff5e5b;
		border-color: #ff5e5b;
	}

	/* Browse & Duplicate Panel */
	.browse-duplicate-panel {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.browse-search-bar {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-radius: 12px;
		padding: 0.45rem 0.75rem;
	}

	.search-ico {
		font-size: 0.9rem;
		color: var(--text-muted);
	}

	.browse-search-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-color);
		font-family: 'Outfit', sans-serif;
		font-size: 0.85rem;
		font-weight: 700;
	}

	.clear-search-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 0.85rem;
		cursor: pointer;
	}

	.category-pills-row {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		overflow-x: auto;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
		padding: 2px 0;
	}

	.category-pills-row::-webkit-scrollbar {
		display: none;
	}

	.cat-chip-btn {
		display: inline-flex;
		align-items: center;
		padding: 0.3rem 0.6rem;
		border-radius: 9999px;
		border: 1.5px solid var(--border-color);
		background: var(--card-bg-subtle);
		color: var(--text-muted);
		font-family: 'Outfit', sans-serif;
		font-size: 0.72rem;
		font-weight: 800;
		white-space: nowrap;
		cursor: pointer;
		transition: all 0.12s ease;
		flex-shrink: 0;
	}

	.cat-chip-btn:hover {
		color: var(--text-color);
		border-color: var(--accent-color);
	}

	.cat-chip-btn.active {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
		font-weight: 900;
	}

	.browse-cards-list {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		max-height: 380px;
		overflow-y: auto;
		padding-right: 0.2rem;
	}

	.browse-empty-state {
		padding: 2rem;
		text-align: center;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.browse-card-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.65rem 0.85rem;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 14px;
		transition: all 0.15s ease;
	}

	.browse-card-item:hover {
		background: var(--hover-bg);
		border-color: var(--accent-color);
	}

	.card-thumb-box {
		width: 48px;
		height: 48px;
		border-radius: 8px;
		overflow: hidden;
		flex-shrink: 0;
		border: 1px solid var(--border-color);
		background: #000;
	}

	.card-thumb-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.browse-card-details {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.card-title-line {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.bcard-title {
		font-family: 'Outfit', sans-serif;
		font-size: 0.92rem;
		font-weight: 900;
		color: var(--text-color);
	}

	.bcard-fullname {
		font-size: 0.78rem;
		color: var(--text-muted);
		font-weight: 700;
	}

	.bcard-cat-badge {
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		color: var(--accent-color);
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		padding: 0.08rem 0.35rem;
	}

	.bcard-desc {
		font-size: 0.76rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.35;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.browse-card-actions {
		flex-shrink: 0;
	}

	.clone-action-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		height: 32px;
		padding: 0 0.65rem;
		font-size: 0.76rem;
		font-weight: 800;
		border-radius: 10px;
		white-space: nowrap;
	}

	@media (max-width: 600px) {
		.modal-card {
			padding: 1rem;
		}

		.browse-card-item {
			flex-direction: column;
			align-items: stretch;
			gap: 0.5rem;
		}

		.browse-card-actions {
			display: flex;
			justify-content: flex-end;
		}
	}
</style>
