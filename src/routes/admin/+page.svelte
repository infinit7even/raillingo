<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import type { Card } from '$lib/types/cards';

	import CardForm from '$lib/components/CardForm.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { loginWithDiscord, logoutUser } from '$lib/auth-client';
	import { toastStore } from '$lib/stores/toastStore';
	import { matchesCategory } from '$lib/stores/globalCategoryStore';

	let { data } = $props();

	// Local state
	let cards = $state<Card[]>([]);
	let trashCards = $state<Card[]>([]);
	let activeTab = $state<'active' | 'trash'>('active');

	let user = $derived(data.user);
	let error = $derived(data.error);
	let isAdmin = $derived(
		Boolean(
			user &&
			(user.isAdmin === true ||
			 user.role === 'admin' ||
			 user.id === '691289686093725736')
		)
	);

	async function logout() {
		await logoutUser();
	}

	// Form state for editing card inline
	let editingCard = $state<Card | null>(null);
	let searchQuery = $state('');
	let selectedCategoryFilter = $state('ALL');

	// Category batch edit state
	let isCategoryAccordionOpen = $state(false);
	let categoryToRename = $state<string | null>(null);
	let newCategoryName = $state('');
	let renamingInProgress = $state(false);
	let categorySearchQuery = $state('');

	// Derived category stats map
	let categoryStats = $derived.by<{ category: string; count: number }[]>(() => {
		const map = new Map<string, number>();
		for (const c of cards) {
			const cat = c.category && c.category.trim() ? c.category.trim() : 'Senza Categoria';
			map.set(cat, (map.get(cat) || 0) + 1);
		}
		return Array.from(map.entries())
			.map(([category, count]) => ({ category, count }))
			.sort((a, b) => b.count - a.count);
	});

	let filteredCategoryStats = $derived.by(() => {
		const q = categorySearchQuery.toLowerCase().trim();
		if (!q) return categoryStats;
		return categoryStats.filter((s) => s.category.toLowerCase().includes(q));
	});

	async function loadTrash() {
		trashCards = await cardsStore.fetchTrash();
	}

	onMount(() => {
		const unsubscribe = cardsStore.subscribe((c) => {
			cards = c;
		});
		loadTrash();
		return unsubscribe;
	});

	function resetForm() {
		editingCard = null;
	}

	function startEdit(card: Card) {
		if (editingCard?.id === card.id) {
			editingCard = null;
			return;
		}
		editingCard = card;
	}

	async function handleSaveCard(cardData: { id?: string } & Omit<Card, 'createdAt' | 'updatedAt'>) {
		try {
			const targetId = cardData.id || editingCard?.id;
			if (targetId) {
				const savedId = targetId;
				await cardsStore.updateCard({
					...(editingCard || {}),
					...cardData,
					id: targetId
				} as Card);
				editingCard = null;
				toastStore.show({ message: '💾 Scheda aggiornata con successo!' });
				setTimeout(() => {
					const el = document.getElementById(`admin-card-${savedId}`);
					if (el) {
						el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
					}
				}, 60);
			} else {
				await cardsStore.addCard(cardData as any);
				resetForm();
				toastStore.show({ message: '✨ Nuova scheda creata con successo!' });
			}
		} catch (err: any) {
			console.error('Errore durante il salvataggio della scheda:', err);
			toastStore.show({ message: `⚠️ ${err.message || 'Errore salvataggio scheda'}` });
			throw err;
		}
	}

	async function handleDeleteCard(id: string) {
		try {
			await cardsStore.deleteCard(id);
			if (editingCard?.id === id) {
				resetForm();
			}
			await loadTrash();
			toastStore.show({ message: '🗑️ Scheda spostata nel cestino!' });
		} catch (err: any) {
			console.error('Errore durante l\'eliminazione della scheda:', err);
			toastStore.show({ message: `⚠️ ${err.message || 'Errore eliminazione scheda'}` });
		}
	}

	async function handleRestoreCard(id: string) {
		try {
			await cardsStore.restoreCard(id);
			await loadTrash();
			toastStore.show({ message: '♻️ Scheda ripristinata con successo!' });
		} catch (err: any) {
			console.error('Errore ripristino scheda:', err);
			toastStore.show({ message: `⚠️ ${err.message || 'Errore ripristino scheda'}` });
		}
	}

	async function handlePermanentDeleteCard(id: string) {
		if (confirm('Sei sicuro di voler eliminare DEFINITIVAMENTE questa scheda e le sue immagini? Questa azione è irreversibile.')) {
			try {
				await cardsStore.permanentDeleteCard(id);
				trashCards = trashCards.filter((c) => c.id !== id);
				toastStore.show({ message: '✕ Scheda eliminata definitivamente' });
			} catch (err: any) {
				console.error('Errore eliminazione definitiva:', err);
				toastStore.show({ message: `⚠️ ${err.message || 'Errore eliminazione definitiva'}` });
			}
		}
	}

	function filterCardsByCategory(catName: string) {
		selectedCategoryFilter = catName;
		const listSection = document.querySelector('.list-section');
		if (listSection) {
			listSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	async function handleBatchRenameCategory(oldCat: string) {
		const trimmedNew = newCategoryName.trim();
		if (!trimmedNew) return;
		if (trimmedNew === oldCat) {
			categoryToRename = null;
			newCategoryName = '';
			return;
		}

		const destinationExists = categoryStats.some(
			(s) => s.category.toLowerCase() === trimmedNew.toLowerCase() && s.category !== oldCat
		);

		if (destinationExists) {
			if (
				!confirm(
					`La categoria "${trimmedNew}" esiste già.\n\nVuoi unire le schede di "${oldCat}" nella categoria "${trimmedNew}"?`
				)
			) {
				return;
			}
		}

		renamingInProgress = true;
		try {
			const count = await cardsStore.updateCategoryBatch(oldCat, trimmedNew);
			toastStore.show({
				message: `🏷️ Aggiornate ${count} schede con la nuova categoria "${trimmedNew}"`
			});
			categoryToRename = null;
			newCategoryName = '';
		} catch (err: any) {
			console.error('Errore durante la modifica della categoria:', err);
			toastStore.show({ message: `⚠️ ${err.message || 'Errore modifica categoria'}` });
		} finally {
			renamingInProgress = false;
		}
	}

	// Media cleanup state
	let mediaLoading = $state(false);
	let mediaInfo = $state<{
		totalFiles: number;
		totalBytes: number;
		referencedFiles: number;
		orphanedCount: number;
		orphanedBytes: number;
	} | null>(null);

	async function scanMedia() {
		mediaLoading = true;
		try {
			const res = await fetch('/api/admin/clean-uploads');
			if (res.ok) {
				mediaInfo = await res.json();
			} else {
				alert('Impossibile scansionare i file multimediali.');
			}
		} catch (err) {
			console.error('Errore durante scansione media:', err);
		} finally {
			mediaLoading = false;
		}
	}

	async function cleanOrphanedMedia() {
		if (!mediaInfo || mediaInfo.orphanedCount === 0) return;
		if (
			!confirm(
				`Vuoi eliminare definitivamente i ${mediaInfo.orphanedCount} file orfani non collegati ad alcuna scheda o appunto?`
			)
		) {
			return;
		}

		mediaLoading = true;
		try {
			const res = await fetch('/api/admin/clean-uploads', { method: 'POST' });
			if (res.ok) {
				const result = await res.json();
				alert(`Pulizia completata! Eliminati ${result.deletedCount} file (${result.freedFormatted} liberati).`);
				await scanMedia();
			} else {
				alert('Errore durante l\'eliminazione dei file orfani.');
			}
		} catch (err) {
			console.error('Errore durante pulizia media:', err);
		} finally {
			mediaLoading = false;
		}
	}

	function exportJSON() {
		const dataStr =
			'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(cards, null, 2));
		const downloadAnchor = document.createElement('a');
		downloadAnchor.setAttribute('href', dataStr);
		downloadAnchor.setAttribute(
			'download',
			`rail_focus_cards_${new Date().toISOString().split('T')[0]}.json`
		);
		document.body.appendChild(downloadAnchor);
		downloadAnchor.click();
		downloadAnchor.remove();
	}

	let filteredCards = $derived(
		cards.filter((c) => {
			const matchesCat =
				selectedCategoryFilter === 'Senza Categoria'
					? !c.category || !c.category.trim()
					: matchesCategory(c.category, selectedCategoryFilter);

			const q = searchQuery.toLowerCase().trim();
			const matchesQuery =
				!q ||
				c.title.toLowerCase().includes(q) ||
				(c.fullName && c.fullName.toLowerCase().includes(q)) ||
				(c.acronym && c.acronym.toLowerCase().includes(q)) ||
				c.description.toLowerCase().includes(q) ||
				(c.category && c.category.toLowerCase().includes(q));

			return matchesCat && matchesQuery;
		})
	);

	let filteredTrashCards = $derived(
		trashCards.filter((c) => {
			const q = searchQuery.toLowerCase().trim();
			return (
				!q ||
				c.title.toLowerCase().includes(q) ||
				(c.fullName && c.fullName.toLowerCase().includes(q)) ||
				(c.acronym && c.acronym.toLowerCase().includes(q)) ||
				c.description.toLowerCase().includes(q) ||
				(c.category && c.category.toLowerCase().includes(q))
			);
		})
	);
</script>

<div class="admin-container">
	<PageHeader
		title="Pannello Amministratore"
		subtitle="Gestione schede, categorie e cestino database"
		icon="/emoji/star_3d.png"
		variant="blue"
		mobileOpenNav={true}
	/>

	{#if !user || !isAdmin}
		<!-- Login / Unauthorized View -->
		<div class="login-card duo-card">
			<div class="login-badge">Area Riservata</div>
			<h1 class="login-title">Pannello Amministratore</h1>
			<p class="login-desc">
				L'accesso al pannello di gestione è riservato esclusivamente all'amministratore autorizzato
				<strong>(Discord ID: 691289686093725736)</strong>.
			</p>

			{#if user && !isAdmin}
				<div class="error-banner">
					⚠️ Non disponi dei permessi di amministratore per questo account (ID utente: {user.userId || user.id}).
				</div>
			{:else if error}
				<div class="error-banner">
					⚠️ Errore di autenticazione: {error === 'unauthorized'
						? 'Utente Discord non autorizzato!'
						: error}
				</div>
			{/if}

			<button type="button" class="duo-btn discord-login-btn flex-btn" onclick={() => loginWithDiscord('/admin')}>
				<svg class="discord-icon-mini" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
					<path
						d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
					/>
				</svg>
				Accedi con Discord
			</button>
		</div>
	{:else}
		<!-- Admin Panel Dashboard -->
		<div class="admin-panel">
			<!-- Header Admin Bar -->
			<div class="admin-top duo-card">
				<div class="user-info">
					<span class="user-name">👤 {user.name || user.username || 'Admin'}</span>
					<span class="user-role">ID: {user.userId || user.id}</span>
				</div>

				<div class="top-actions">
					<button class="duo-btn duo-btn-blue export-btn" onclick={exportJSON}>
						📥 ESPORTA JSON
					</button>
					<button class="duo-btn duo-btn-gray logout-btn" onclick={logout}> Esci </button>
				</div>
			</div>

			<!-- Compact Collapsible Sezione Gestione Categorie -->
			<div class="categories-accordion-card duo-card">
				<button
					type="button"
					class="accordion-toggle-btn"
					onclick={() => (isCategoryAccordionOpen = !isCategoryAccordionOpen)}
				>
					<div class="accordion-title-group">
						<span class="accordion-icon">🏷️</span>
						<span class="accordion-title">Gestione Categorie ({categoryStats.length})</span>
					</div>
					<span class="accordion-arrow">{isCategoryAccordionOpen ? '▲ Riduci' : '▼ Espandi'}</span>
				</button>

				{#if isCategoryAccordionOpen}
					<div class="accordion-content">
						<div class="category-search-box">
							<input
								type="text"
								bind:value={categorySearchQuery}
								placeholder="Cerca tra le categorie..."
								class="duo-input cat-search-input"
							/>
						</div>

						<div class="category-chips-scroll">
							{#each filteredCategoryStats as stat}
								<div
									class="category-stat-item duo-card"
									class:is-renaming-active={categoryToRename === stat.category}
								>
									<div class="stat-main">
										<span class="category-name">{stat.category}</span>
										<span class="category-count-badge">{stat.count} card</span>
									</div>

									{#if categoryToRename === stat.category}
										<div class="rename-inline-box">
											<div class="rename-fields-wrapper">
												<input
													type="text"
													bind:value={newCategoryName}
													placeholder="Nuovo nome categoria..."
													class="duo-input rename-input"
													onkeydown={(e) => {
														if (e.key === 'Enter') {
															e.preventDefault();
															handleBatchRenameCategory(stat.category);
														} else if (e.key === 'Escape') {
															categoryToRename = null;
															newCategoryName = '';
														}
													}}
												/>

												<select
													bind:value={newCategoryName}
													class="duo-input quick-merge-select"
													title="Unisci in un'altra categoria esistente"
												>
													<option value={newCategoryName} disabled>-- Unisci a esistente --</option>
													{#each categoryStats.filter((s) => s.category !== stat.category) as targetStat}
														<option value={targetStat.category}>
															Unisci in "{targetStat.category}" ({targetStat.count} card)
														</option>
													{/each}
												</select>
											</div>

											<div class="rename-actions-row">
												<button
													class="duo-btn duo-btn-green save-cat-btn"
													disabled={renamingInProgress || !newCategoryName.trim()}
													onclick={() => handleBatchRenameCategory(stat.category)}
												>
													{renamingInProgress ? '⏳...' : '💾 Salva'}
												</button>
												<button
													class="duo-btn duo-btn-gray cancel-cat-btn"
													onclick={() => {
														categoryToRename = null;
														newCategoryName = '';
													}}
												>
													✕
												</button>
											</div>
										</div>
									{:else}
										<div class="category-card-actions">
											<button
												class="cat-action-btn filter"
												onclick={() => filterCardsByCategory(stat.category)}
												title="Filtra schede"
											>
												🔍 Filtra
											</button>
											<button
												class="cat-action-btn rename"
												onclick={() => {
													categoryToRename = stat.category;
													newCategoryName = stat.category;
												}}
												title="Rinomina categoria"
											>
												✏️ Rinomina
											</button>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Media Cleaner Panel -->
			<div class="media-cleaner-card duo-card">
				<div class="cleaner-header">
					<div>
						<h2 class="section-title">🧹 Pulizia File & Immagini Non Utilizzate</h2>
						<p class="section-subtitle">
							Scansiona la cartella degli upload per eliminare i file non collegati alle schede.
						</p>
					</div>
					<button class="duo-btn duo-btn-blue scan-btn" disabled={mediaLoading} onclick={scanMedia}>
						{mediaLoading ? '⏳ Scansione...' : '🔍 Scansiona'}
					</button>
				</div>

				{#if mediaInfo}
					<div class="media-stats-grid">
						<div class="media-stat-box">
							<span class="m-val">{mediaInfo.totalFiles}</span>
							<span class="m-lbl">File Totali ({((mediaInfo.totalBytes || 0) / 1024 / 1024).toFixed(2)} MB)</span>
						</div>
						<div class="media-stat-box success">
							<span class="m-val">{mediaInfo.referencedFiles}</span>
							<span class="m-lbl">In Uso</span>
						</div>
						<div class="media-stat-box warning">
							<span class="m-val">{mediaInfo.orphanedCount}</span>
							<span class="m-lbl">Orfani ({((mediaInfo.orphanedBytes || 0) / 1024 / 1024).toFixed(2)} MB)</span>
						</div>
					</div>

					{#if mediaInfo.orphanedCount > 0}
						<div class="clean-action-box">
							<button
								class="duo-btn duo-btn-red clean-btn"
								disabled={mediaLoading}
								onclick={cleanOrphanedMedia}
							>
								{mediaLoading
									? '⏳ Eliminazione...'
									: `🗑️ Elimina Definitivamente ${mediaInfo.orphanedCount} File Orfani`}
							</button>
						</div>
					{:else}
						<p class="all-clean-text">✨ Tutti i file multimediali sono collegati e in uso!</p>
					{/if}
				{/if}
			</div>

			<!-- Navigazione Tab: Schede Attive / Cestino -->
			<div class="admin-tabs-row">
				<button
					class="admin-tab-btn"
					class:active={activeTab === 'active'}
					onclick={() => (activeTab = 'active')}
				>
					📋 Schede Attive ({cards.length})
				</button>
				<button
					class="admin-tab-btn trash-tab"
					class:active={activeTab === 'trash'}
					onclick={() => {
						activeTab = 'trash';
						loadTrash();
					}}
				>
					🗑️ Cestino ({trashCards.length})
				</button>
			</div>

			{#if activeTab === 'active'}
				<!-- List Sezione Schede Attive -->
				<div class="list-section">
					<div class="list-header">
						<div class="list-filters">
							<select bind:value={selectedCategoryFilter} class="duo-input category-select-filter">
								<option value="ALL">Tutte le Categorie ({categoryStats.length})</option>
								{#each categoryStats as stat}
									<option value={stat.category}>{stat.category} ({stat.count})</option>
								{/each}
							</select>

							<input
								type="text"
								bind:value={searchQuery}
								placeholder="Cerca schede..."
								class="search-input duo-input"
							/>
						</div>
					</div>

					<div class="cards-list">
						{#if filteredCards.length === 0}
							<div class="empty-list-box duo-card">
								Nessuna scheda trovata con i filtri correnti.
							</div>
						{:else}
							{#each filteredCards as card (card.id)}
								<div
									id={`admin-card-${card.id}`}
									class="admin-card-item duo-card"
									class:is-editing-this={editingCard?.id === card.id}
								>
									{#if editingCard?.id === card.id}
										<div class="inline-edit-wrapper">
											<div class="inline-edit-header">
												<div class="inline-edit-title">
													<span>✏️ Modifica Scheda: <strong>"{card.title}"</strong></span>
												</div>
												<button type="button" class="close-inline-btn" onclick={resetForm}>
													✕ Chiudi
												</button>
											</div>

											<CardForm
												initialCard={editingCard}
												onSave={handleSaveCard}
												onCancel={resetForm}
												submitLabel="💾 Salva Modifiche"
											/>
										</div>
									{:else}
										<div class="card-row-wrapper">
											<div class="card-main-info">
												<div class="item-title-row">
													<h3 class="card-item-title">{card.title}</h3>
													{#if card.acronym}
														<span class="acronym-badge">[{card.acronym}]</span>
													{/if}
													{#if card.fullName && card.fullName.trim().toLowerCase() !== card.title.trim().toLowerCase()}
														<span class="fullname-badge">{card.fullName}</span>
													{/if}
													{#if card.category}
														<span class="category-pill">{card.category}</span>
													{/if}
													{#if card.images && card.images.length > 0}
														<span class="img-count-pill">📷 {card.images.length}</span>
													{/if}
													{#if card.showInWiki === false}
														<span class="wiki-hidden-pill">🚫 No Wiki</span>
													{/if}
												</div>
												<p class="card-item-desc">{card.description}</p>
											</div>

											<div class="item-actions">
												<button class="duo-btn duo-btn-blue edit-btn" onclick={() => startEdit(card)}>
													✏️ Modifica
												</button>
												<button class="duo-btn duo-btn-gray delete-btn" onclick={() => handleDeleteCard(card.id)} title="Sposta nel cestino">
													🗑️ Cestina
												</button>
											</div>
										</div>
									{/if}
								</div>
							{/each}
						{/if}
					</div>
				</div>
			{:else}
				<!-- List Sezione Cestino -->
				<div class="list-section">
					<div class="trash-banner duo-card">
						<span>🗑️ Gli elementi nel cestino rimangono conservati finché non vengono eliminati manualmente.</span>
					</div>

					<div class="list-header">
						<input
							type="text"
							bind:value={searchQuery}
							placeholder="Cerca nel cestino..."
							class="search-input duo-input full-width-search"
						/>
					</div>

					<div class="cards-list">
						{#if filteredTrashCards.length === 0}
							<div class="empty-list-box duo-card">
								✨ Il cestino è vuoto. Nessuna scheda eliminata.
							</div>
						{:else}
							{#each filteredTrashCards as card (card.id)}
								<div class="admin-card-item duo-card in-trash">
									<div class="card-row-wrapper">
										<div class="card-main-info">
											<div class="item-title-row">
												<h3 class="card-item-title">{card.title}</h3>
												{#if card.acronym}
													<span class="acronym-badge">[{card.acronym}]</span>
												{/if}
												{#if card.category}
													<span class="category-pill">{card.category}</span>
												{/if}
												<span class="trash-date-pill">Eliminata</span>
											</div>
											<p class="card-item-desc">{card.description}</p>
										</div>

										<div class="item-actions">
											<button
												class="duo-btn duo-btn-green restore-btn"
												onclick={() => handleRestoreCard(card.id)}
												title="Ripristina la scheda nelle schede attive"
											>
												♻️ Ripristina
											</button>
											<button
												class="duo-btn duo-btn-red perm-delete-btn"
												onclick={() => handlePermanentDeleteCard(card.id)}
												title="Elimina definitivamente la scheda e le sue immagini"
											>
												✕ Elimina Definitivamente
											</button>
										</div>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.admin-container {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		max-width: 800px;
		margin: 0 auto;
		width: 100%;
		box-sizing: border-box;
		padding-bottom: 2.5rem;
	}

	.admin-panel {
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
	}

	.admin-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.85rem 1.15rem;
		background: var(--card-bg);
		border-radius: 16px;
	}

	.user-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.user-name {
		font-size: 0.95rem;
		font-weight: 900;
		color: var(--text-color);
	}

	.user-role {
		font-size: 0.72rem;
		color: var(--text-muted);
		font-weight: 700;
	}

	.top-actions {
		display: flex;
		gap: 0.5rem;
	}

	.export-btn,
	.logout-btn {
		font-size: 0.78rem;
		padding: 0.45rem 0.85rem;
	}

	/* Accordion Categorie */
	.categories-accordion-card {
		padding: 0.75rem 1rem;
		background: var(--card-bg);
		border-radius: 16px;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.accordion-toggle-btn {
		background: none;
		border: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		cursor: pointer;
		padding: 0.25rem 0;
	}

	.accordion-title-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.accordion-icon {
		font-size: 1.1rem;
	}

	.accordion-title {
		font-size: 0.92rem;
		font-weight: 900;
		color: var(--text-color);
	}

	.accordion-arrow {
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--accent-color);
	}

	.accordion-content {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		border-top: 1px solid var(--border-color);
		padding-top: 0.75rem;
	}

	.category-chips-scroll {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.6rem;
		max-height: 260px;
		overflow-y: auto;
		padding-right: 0.25rem;
	}

	.category-stat-item {
		padding: 0.65rem 0.85rem;
		background: var(--card-bg-subtle);
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.stat-main {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.category-name {
		font-size: 0.82rem;
		font-weight: 800;
		color: var(--text-color);
	}

	.category-count-badge {
		font-size: 0.68rem;
		font-weight: 900;
		background: var(--accent-light-bg);
		color: var(--accent-color);
		padding: 0.15rem 0.45rem;
		border-radius: 6px;
	}

	.category-card-actions {
		display: flex;
		gap: 0.4rem;
	}

	.cat-action-btn {
		font-size: 0.72rem;
		font-weight: 800;
		padding: 0.25rem 0.5rem;
		border-radius: 8px;
		border: 1px solid var(--border-color);
		background: var(--card-bg);
		color: var(--text-color);
		cursor: pointer;
	}

	.cat-action-btn.filter:hover {
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.cat-action-btn.rename:hover {
		border-color: var(--yellow-color);
		color: var(--yellow-color);
	}

	.rename-inline-box {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.rename-fields-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.rename-input,
	.quick-merge-select {
		font-size: 0.78rem;
		padding: 0.35rem 0.6rem;
	}

	.rename-actions-row {
		display: flex;
		gap: 0.35rem;
	}

	.save-cat-btn,
	.cancel-cat-btn {
		font-size: 0.72rem;
		padding: 0.3rem 0.6rem;
	}

	/* Media Cleaner */
	.media-cleaner-card {
		padding: 0.85rem 1.15rem;
		background: var(--card-bg);
		border-radius: 16px;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.cleaner-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.section-title {
		font-size: 0.92rem;
		font-weight: 900;
		margin: 0;
		color: var(--text-color);
	}

	.section-subtitle {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin: 0.15rem 0 0 0;
	}

	.scan-btn {
		font-size: 0.78rem;
		padding: 0.45rem 0.85rem;
	}

	.media-stats-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.6rem;
	}

	.media-stat-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.5rem;
		background: var(--card-bg-subtle);
		border-radius: 10px;
		border: 1px solid var(--border-color);
	}

	.m-val {
		font-size: 1.1rem;
		font-weight: 900;
		color: var(--text-color);
	}

	.m-lbl {
		font-size: 0.68rem;
		font-weight: 700;
		color: var(--text-muted);
		text-align: center;
	}

	.media-stat-box.success .m-val {
		color: #22c55e;
	}

	.media-stat-box.warning .m-val {
		color: #f59e0b;
	}

	.clean-btn {
		width: 100%;
		font-size: 0.85rem;
		padding: 0.65rem 1rem;
	}

	.all-clean-text {
		font-size: 0.8rem;
		font-weight: 800;
		color: #22c55e;
		margin: 0;
	}

	/* Tabs */
	.admin-tabs-row {
		display: flex;
		gap: 0.5rem;
	}

	.admin-tab-btn {
		flex: 1;
		padding: 0.7rem 1rem;
		font-size: 0.85rem;
		font-weight: 900;
		border-radius: 14px;
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.admin-tab-btn.active {
		border-color: var(--accent-color);
		background: var(--accent-light-bg);
		color: var(--accent-color);
	}

	.admin-tab-btn.trash-tab.active {
		border-color: #ef4444;
		background: rgba(239, 68, 68, 0.12);
		color: #ef4444;
	}

	/* List Section */
	.list-section {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.trash-banner {
		padding: 0.75rem 1rem;
		background: rgba(239, 68, 68, 0.08);
		border: 1.5px solid #ef4444;
		border-radius: 12px;
		font-size: 0.82rem;
		color: var(--text-color);
		font-weight: 700;
	}

	.list-header {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.list-filters {
		display: flex;
		gap: 0.5rem;
	}

	.category-select-filter {
		max-width: 240px;
		font-size: 0.82rem;
	}

	.search-input {
		flex: 1;
		font-size: 0.82rem;
	}

	.full-width-search {
		width: 100%;
	}

	.cards-list {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.admin-card-item {
		padding: 0.85rem 1.15rem;
		background: var(--card-bg);
		border-radius: 16px;
		transition: all 0.15s ease;
	}

	.card-row-wrapper {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.85rem;
	}

	@media (max-width: 650px) {
		.card-row-wrapper {
			flex-direction: column;
		}

		.item-actions {
			width: 100%;
			justify-content: flex-end;
		}
	}

	.card-main-info {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		flex: 1;
		min-width: 0;
	}

	.item-title-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
	}

	.card-item-title {
		font-size: 1.05rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.acronym-badge {
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--accent-color);
	}

	.fullname-badge {
		font-size: 0.78rem;
		color: var(--text-muted);
		font-weight: 700;
	}

	.category-pill,
	.img-count-pill,
	.wiki-hidden-pill,
	.trash-date-pill {
		font-size: 0.7rem;
		font-weight: 800;
		padding: 0.15rem 0.45rem;
		border-radius: 6px;
		background: var(--card-bg-subtle);
		color: var(--text-muted);
		border: 1px solid var(--border-color);
	}

	.wiki-hidden-pill {
		color: #ef4444;
		border-color: rgba(239, 68, 68, 0.4);
		background: rgba(239, 68, 68, 0.08);
	}

	.trash-date-pill {
		color: #f59e0b;
	}

	.card-item-desc {
		font-size: 0.85rem;
		color: var(--text-muted);
		line-height: 1.45;
		margin: 0;
		word-break: break-word;
	}

	.item-actions {
		display: flex;
		gap: 0.4rem;
		flex-shrink: 0;
		align-items: center;
	}

	.edit-btn,
	.delete-btn,
	.restore-btn,
	.perm-delete-btn {
		font-size: 0.78rem;
		padding: 0.4rem 0.75rem;
		white-space: nowrap;
	}

	.inline-edit-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		width: 100%;
	}

	.inline-edit-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 0.5rem;
		border-bottom: 1.5px solid var(--border-color);
	}

	.inline-edit-title {
		font-size: 0.95rem;
		font-weight: 900;
		color: var(--accent-color);
	}

	.close-inline-btn {
		background: none;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 800;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
	}

	.close-inline-btn:hover {
		color: var(--text-color);
		border-color: var(--text-color);
	}

	.empty-list-box {
		padding: 2rem;
		text-align: center;
		color: var(--text-muted);
		font-size: 0.88rem;
		font-weight: 700;
		background: var(--card-bg);
		border-radius: 16px;
	}

	.login-card {
		padding: 2rem;
		background: var(--card-bg);
		border-radius: 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 1rem;
	}

	.login-badge {
		font-size: 0.75rem;
		font-weight: 900;
		color: var(--accent-color);
		background: var(--accent-light-bg);
		padding: 0.25rem 0.65rem;
		border-radius: 999px;
	}

	.login-title {
		font-size: 1.4rem;
		font-weight: 900;
		margin: 0;
	}

	.login-desc {
		font-size: 0.88rem;
		color: var(--text-muted);
		max-width: 480px;
		line-height: 1.5;
		margin: 0;
	}

	.error-banner {
		padding: 0.75rem 1rem;
		background: rgba(239, 68, 68, 0.15);
		border: 1.5px solid #ef4444;
		border-radius: 12px;
		color: #ef4444;
		font-size: 0.82rem;
		font-weight: 800;
	}

	.discord-login-btn {
		background-color: #5865f2;
		color: #ffffff;
		border: 2px solid #4752c4;
		border-bottom: 4px solid #4752c4;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 900;
		padding: 0.75rem 1.5rem;
		border-radius: 14px;
		cursor: pointer;
	}
</style>
