<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import type { Card } from '$lib/types/cards';

	import CardForm from '$lib/components/CardForm.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { loginWithDiscord, logoutUser } from '$lib/auth-client';

	import { toastStore } from '$lib/stores/toastStore';

	let { data } = $props();

	// Local state
	let cards = $state<Card[]>([]);
	let user = $derived(data.user);
	let error = $derived(data.error);
	let isAdmin = $derived(Boolean(user && (user.isAdmin || user.role === 'admin')));

	async function logout() {
		await logoutUser();
	}

	// Form state for creating / editing card
	let editingCard = $state<Card | null>(null);
	let clonedCard = $state<Card | null>(null);
	let searchQuery = $state('');
	let selectedCategoryFilter = $state('ALL');

	// Category batch edit state
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

	onMount(() => {
		const unsubscribe = cardsStore.subscribe((c) => (cards = c));
		return unsubscribe;
	});

	function resetForm() {
		editingCard = null;
		clonedCard = null;
	}

	function startEdit(card: Card) {
		clonedCard = null;
		if (editingCard?.id === card.id) {
			editingCard = null;
			return;
		}
		editingCard = card;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function startDuplicate(card: Card) {
		editingCard = null;
		clonedCard = {
			...card,
			id: ''
		};
		window.scrollTo({ top: 0, behavior: 'smooth' });
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
				clonedCard = null;
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
		if (confirm('Sei sicuro di voler eliminare questa scheda?')) {
			try {
				await cardsStore.deleteCard(id);
				if (editingCard?.id === id) {
					resetForm();
				}
				toastStore.show({ message: '🗑️ Scheda eliminata con successo!' });
			} catch (err: any) {
				console.error('Errore durante l\'eliminazione della scheda:', err);
				toastStore.show({ message: `⚠️ ${err.message || 'Errore eliminazione scheda'}` });
				alert(`Impossibile eliminare la scheda: ${err.message || 'Errore server'}`);
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

		// Se la categoria di destinazione esiste già, chiedi conferma per l'unione
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

	import { matchesCategory } from '$lib/stores/globalCategoryStore';

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
				c.description.toLowerCase().includes(q) ||
				(c.category && c.category.toLowerCase().includes(q));

			return matchesCat && matchesQuery;
		})
	);
</script>

<div class="admin-container">
	<PageHeader
		title="Pannello Amministratore"
		subtitle="Gestione schede, categorie e database"
		icon="/emoji/star_3d.png"
		variant="blue"
		mobileOpenNav={true}
	/>

	{#if !user || !isAdmin}
		<!-- Login / Unauthorized View -->
		<div class="login-card">
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

			<button type="button" class="discord-login-btn" onclick={() => loginWithDiscord('/admin')}>
				<svg class="discord-icon" viewBox="0 0 24 24" fill="currentColor">
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
					<div>
						<span class="user-name">👤 {user.username}</span>
						<span class="user-role">ID Discord: {user.userId} • Email: {user.email || 'N/D'}</span>
					</div>
				</div>

				<div class="top-actions">
					<button class="duo-btn duo-btn-blue export-btn" onclick={exportJSON}>
						📥 ESPORTA DATI JSON
					</button>
					<button class="duo-btn duo-btn-gray logout-btn" onclick={logout}> Esci </button>
				</div>
			</div>

			<!-- Form Creazione Nuova Card -->
			<div class="editor-card duo-card">
				<h2 class="form-title">
					{#if editingCard}
						✏️ Modifica Scheda: "{editingCard.title}"
					{:else if clonedCard}
						📋 Aggiungi Scheda Duplicata (da "{clonedCard.title}")
					{:else}
						➕ Aggiungi Nuova Card Informativa
					{/if}
				</h2>

				{#if editingCard}
					<div class="admin-clone-notice edit-notice">
						<span>✏️ Stai modificando la scheda <strong>"{editingCard.title}"</strong>. Salva per applicare le modifiche.</span>
						<button type="button" class="cancel-clone-btn" onclick={resetForm}>✕ Annulla Modifica</button>
					</div>
				{:else if clonedCard}
					<div class="admin-clone-notice">
						<span>📋 Stai creando una nuova card clonando i dati di <strong>"{clonedCard.title}"</strong>. Modifica i campi e salva.</span>
						<button type="button" class="cancel-clone-btn" onclick={resetForm}>✕ Azzera</button>
					</div>
				{/if}

				<CardForm
					initialCard={editingCard || clonedCard}
					onSave={handleSaveCard}
					onCancel={(editingCard || clonedCard) ? resetForm : undefined}
					onSelectExistingCard={startEdit}
					submitLabel={editingCard ? '💾 SALVA MODIFICHE SCHEDA' : clonedCard ? '➕ AGGIUNGI SCHEDA DUPLICATA' : '➕ AGGIUNGI SCHEDA'}
				/>
			</div>

			<!-- Sezione Gestione Categorie in Blocco -->
			<div class="categories-admin-card duo-card">
				<div class="categories-header-row">
					<div>
						<h2 class="section-title">🏷️ Gestione Categorie & Conteggio Card ({categoryStats.length})</h2>
						<p class="section-subtitle">
							Rinomina una categoria in blocco o unisci schede tra categorie esistenti.
						</p>
					</div>

					<div class="category-search-box">
						<input
							type="text"
							bind:value={categorySearchQuery}
							placeholder="Cerca categoria..."
							class="duo-input cat-search-input"
						/>
					</div>
				</div>

				<div class="category-stats-grid">
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

										<!-- Quick Merge Select Dropdown -->
										<select
											bind:value={newCategoryName}
											class="duo-input quick-merge-select"
											title="Oppure seleziona una categoria esistente in cui unire le schede"
										>
											<option value={newCategoryName} disabled>-- Oppure unisci a esistente --</option>
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
											{renamingInProgress ? '⏳ Salvo...' : '💾 Salva'}
										</button>
										<button
											class="duo-btn duo-btn-gray cancel-cat-btn"
											onclick={() => {
												categoryToRename = null;
												newCategoryName = '';
											}}
										>
											✕ Annulla
										</button>
									</div>
								</div>
							{:else}
								<div class="category-card-actions">
									<button
										class="cat-action-btn filter"
										onclick={() => filterCardsByCategory(stat.category)}
										title="Visualizza solo le schede appartenenti a questa categoria"
									>
										🔍 Filtra schede
									</button>
									<button
										class="cat-action-btn rename"
										onclick={() => {
											categoryToRename = stat.category;
											newCategoryName = stat.category;
										}}
										title="Rinomina in blocco questa categoria"
									>
										✏️ Rinomina
									</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<!-- Media Cleaner Panel -->
			<div class="media-cleaner-card duo-card">
				<div class="cleaner-header">
					<div>
						<h2 class="section-title">🧹 Pulizia File & Immagini Non Utilizzate</h2>
						<p class="section-subtitle">
							Scansiona la cartella <code>/uploads</code> per identificare ed eliminare le immagini non
							collegate.
						</p>
					</div>
					<button class="duo-btn duo-btn-blue scan-btn" disabled={mediaLoading} onclick={scanMedia}>
						{mediaLoading ? '⏳ Scansione...' : '🔍 Scansiona Uploads'}
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
							<span class="m-lbl">File in Uso</span>
						</div>
						<div class="media-stat-box warning">
							<span class="m-val">{mediaInfo.orphanedCount}</span>
							<span class="m-lbl">File Orfani ({mediaInfo.orphanedBytes ? ((mediaInfo.orphanedBytes || 0) / 1024 / 1024).toFixed(2) : 0} MB)</span>
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
						<p class="all-clean-text">✨ Tutti i file multimediali su disco sono collegati e in uso!</p>
					{/if}
				{/if}
			</div>

			<!-- List Sezione Schede Registrate -->
			<div class="list-section">
				<div class="list-header">
					<h2>Schede Registrate ({filteredCards.length})</h2>

					<div class="list-filters">
						<select bind:value={selectedCategoryFilter} class="duo-input category-select-filter">
							<option value="ALL">Tutte le Categorie</option>
							{#each categoryStats as stat}
								<option value={stat.category}>{stat.category} ({stat.count})</option>
							{/each}
						</select>

						<input
							type="text"
							bind:value={searchQuery}
							placeholder="Filtra tra le schede..."
							class="search-input duo-input"
						/>
					</div>
				</div>

				<div class="cards-list">
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
											<span class="inline-edit-icon">✏️</span>
											<span>Modifica Scheda: <strong>"{card.title}"</strong></span>
										</div>
										<button type="button" class="close-inline-btn" onclick={resetForm}>
											✕ Chiudi Modifica
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
								<div class="card-main-info">
									<div class="item-title-row">
										<h3 class="card-item-title">{card.title}</h3>
										{#if card.fullName && card.fullName.trim().toLowerCase() !== card.title.trim().toLowerCase()}
											<span class="fullname-badge">{card.fullName}</span>
										{/if}
										{#if card.category}
											<span class="category-pill">{card.category}</span>
										{/if}
										{#if card.images && card.images.length > 0}
											<span class="img-count-pill">📷 {card.images.length}</span>
										{/if}
									</div>
									<p class="card-item-desc">{card.description}</p>
								</div>

								<div class="item-actions">
									<button class="duplicate-btn" onclick={() => startDuplicate(card)} title="Duplica e crea nuova scheda da questa">
										📋 Duplica
									</button>
									<button class="edit-btn" onclick={() => startEdit(card)}> ✏️ Modifica </button>
									<button class="delete-btn" onclick={() => handleDeleteCard(card.id)}>
										🗑️ Elimina
									</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.admin-container {
		width: 100%;
		max-width: 850px;
		margin: 0 auto;
	}

	.login-card {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 28px;
		padding: 2.5rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		align-items: center;
		box-shadow: 0 12px 36px rgba(0, 0, 0, 0.15);
	}

	.login-badge {
		padding: 0.25rem 0.85rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		background: var(--accent-light-bg);
		color: var(--accent-color);
		border: 1px solid var(--border-color);
	}

	.login-title {
		font-size: 2.2rem;
		font-weight: 900;
		margin: 0;
	}

	.login-desc {
		color: var(--text-muted);
		line-height: 1.6;
		max-width: 500px;
	}

	.error-banner {
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid #ef4444;
		color: #f87171;
		padding: 0.85rem 1.25rem;
		border-radius: 14px;
		font-size: 0.9rem;
		font-weight: 700;
	}

	.discord-login-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 2rem;
		border-radius: 16px;
		background: #5865f2;
		color: white;
		font-weight: 800;
		font-size: 1.1rem;
		text-decoration: none;
		box-shadow: 0 6px 20px rgba(88, 101, 242, 0.4);
		transition: transform 0.2s ease;
	}

	.discord-login-btn:hover {
		transform: translateY(-2px);
	}

	.discord-icon {
		width: 24px;
		height: 24px;
	}

	/* Dashboard */
	.admin-panel {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.admin-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 20px;
		padding: 1rem 1.5rem;
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.user-name {
		font-weight: 800;
		display: block;
	}

	.user-role {
		font-size: 0.75rem;
		color: var(--accent-color);
		font-weight: 700;
	}

	.top-actions {
		display: flex;
		gap: 0.75rem;
	}

	.export-btn,
	.logout-btn {
		padding: 0.6rem 1rem;
		border-radius: 12px;
		font-size: 0.85rem;
		font-weight: 700;
		text-decoration: none;
		border: 1px solid var(--border-color);
		cursor: pointer;
	}

	.export-btn {
		background: var(--accent-light-bg);
		color: var(--accent-color);
	}

	.logout-btn {
		background: var(--card-bg-subtle);
		color: var(--text-color);
	}

	/* Editor Form */
	.editor-card {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 24px;
		padding: 1.75rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
	}

	.form-title {
		font-size: 1.4rem;
		font-weight: 800;
		margin: 0 0 1rem 0;
	}

	/* Sezione Categorie Admin */
	.categories-admin-card {
		background: var(--card-bg);
		border-radius: 24px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.categories-header-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.cat-search-input {
		font-size: 0.82rem;
		padding: 0.45rem 0.75rem;
		min-width: 180px;
	}

	.category-stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 0.85rem;
	}

	.category-stat-item {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		border-radius: 16px;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	.category-stat-item.is-renaming-active {
		border-color: var(--accent-color);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color) 30%, transparent);
		grid-column: span 1;
	}

	.stat-main {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.category-name {
		font-weight: 900;
		font-size: 0.95rem;
		color: var(--text-color);
		word-break: break-word;
	}

	.category-count-badge {
		font-size: 0.75rem;
		font-weight: 800;
		background: var(--accent-color);
		color: #ffffff;
		padding: 0.2rem 0.6rem;
		border-radius: 12px;
		white-space: nowrap;
	}

	.category-card-actions {
		display: flex;
		gap: 0.4rem;
	}

	.cat-action-btn {
		flex: 1;
		font-size: 0.76rem;
		font-weight: 800;
		padding: 0.35rem 0.5rem;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: center;
	}

	.cat-action-btn.filter {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		color: var(--text-muted);
	}

	.cat-action-btn.filter:hover {
		color: var(--accent-color);
		border-color: var(--accent-color);
		background: var(--accent-light-bg);
	}

	.cat-action-btn.rename {
		background: var(--card-bg);
		border: 1px dashed var(--border-color);
		color: var(--accent-color);
	}

	.cat-action-btn.rename:hover {
		background: var(--accent-color);
		color: #ffffff;
		border-style: solid;
	}

	.rename-inline-box {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
	}

	.rename-fields-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.rename-input {
		font-size: 0.85rem;
		padding: 0.45rem 0.6rem;
		font-weight: 700;
	}

	.quick-merge-select {
		font-size: 0.75rem;
		padding: 0.35rem 0.5rem;
		color: var(--text-muted);
	}

	.rename-actions-row {
		display: flex;
		gap: 0.4rem;
	}

	.save-cat-btn,
	.cancel-cat-btn {
		flex: 1;
		padding: 0.4rem 0.6rem;
		font-size: 0.8rem;
	}

	/* List Section */
	.list-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.list-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.list-filters {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.category-select-filter {
		font-size: 0.85rem;
		padding: 0.55rem 0.85rem;
	}

	.search-input {
		padding: 0.55rem 0.85rem;
		font-size: 0.85rem;
	}

	.cards-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.admin-card-item {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 16px;
		padding: 1.25rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		transition: all 0.2s ease;
	}

	.admin-card-item.is-editing-this {
		flex-direction: column;
		align-items: stretch;
		border-color: var(--accent-color);
		border-width: 2px;
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
		padding: 1.5rem;
		gap: 1rem;
	}

	.inline-edit-wrapper {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.inline-edit-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding-bottom: 0.75rem;
		border-bottom: 1.5px solid var(--border-color);
	}

	.inline-edit-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.05rem;
		font-weight: 800;
		color: var(--accent-color);
	}

	.close-inline-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 10px;
		padding: 0.35rem 0.75rem;
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.close-inline-btn:hover {
		color: #ff5e5b;
		border-color: #ff5e5b;
		background: rgba(255, 94, 91, 0.1);
	}

	@media (max-width: 600px) {
		.admin-card-item:not(.is-editing-this) {
			flex-direction: column;
			align-items: flex-start;
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
	}

	.item-title-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.card-item-title {
		font-size: 1.2rem;
		font-weight: 800;
		color: var(--accent-color);
		margin: 0;
	}

	.fullname-badge {
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--accent-color);
		background: var(--accent-light-bg);
		padding: 0.2rem 0.6rem;
		border-radius: 8px;
		border: 1px solid var(--accent-color);
	}

	.category-pill {
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--green-color);
		background: rgba(34, 197, 94, 0.12);
		padding: 0.15rem 0.55rem;
		border-radius: 8px;
		border: 1px solid var(--green-color);
	}

	.img-count-pill {
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.15rem 0.5rem;
		border-radius: 6px;
		background: var(--card-bg-subtle);
		color: var(--text-muted);
	}

	.card-item-desc {
		font-size: 0.875rem;
		color: var(--text-muted);
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.admin-clone-notice {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0.65rem 0.85rem;
		background: rgba(88, 204, 2, 0.12);
		border: 1.5px solid var(--green-color);
		border-radius: 12px;
		font-size: 0.8rem;
		color: var(--text-color);
		margin-bottom: 0.75rem;
	}

	.cancel-clone-btn {
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		border-radius: 8px;
		padding: 0.25rem 0.55rem;
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--text-muted);
		cursor: pointer;
		white-space: nowrap;
	}

	.cancel-clone-btn:hover {
		color: #ff5e5b;
		border-color: #ff5e5b;
	}

	.item-actions {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.duplicate-btn,
	.edit-btn,
	.delete-btn {
		padding: 0.45rem 0.75rem;
		border-radius: 10px;
		font-size: 0.78rem;
		font-weight: 800;
		border: 1.5px solid var(--border-color);
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.duplicate-btn {
		background: var(--card-bg-subtle);
		color: var(--accent-color);
		border-color: var(--accent-color);
	}

	.duplicate-btn:hover {
		background: var(--accent-light-bg);
	}

	.edit-btn {
		background: var(--card-bg-subtle);
		color: var(--text-color);
	}

	.edit-btn:hover {
		background: var(--hover-bg);
	}

	.delete-btn {
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
		border-color: rgba(239, 68, 68, 0.3);
	}

	.delete-btn:hover {
		background: rgba(239, 68, 68, 0.2);
	}

	.media-cleaner-card {
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		border-radius: 18px;
		padding: 1.5rem;
	}

	.cleaner-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.scan-btn {
		white-space: nowrap;
		font-size: 0.88rem;
		padding: 0.65rem 1.15rem;
	}

	.media-stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
		gap: 0.75rem;
		margin-top: 1.25rem;
	}

	.media-stat-box {
		padding: 0.85rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.25rem;
		background: var(--card-bg-subtle);
		border-radius: 14px;
		border: 1px solid var(--border-color);
	}

	.m-val {
		font-size: 1.4rem;
		font-weight: 900;
		color: var(--accent-color);
	}

	.media-stat-box.warning .m-val {
		color: #f59e0b !important;
	}

	.media-stat-box.success .m-val {
		color: var(--green-color) !important;
	}

	.m-lbl {
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.clean-action-box {
		margin-top: 1.25rem;
		display: flex;
		justify-content: flex-end;
	}

	.all-clean-text {
		margin: 1rem 0 0 0;
		font-size: 0.88rem;
		font-weight: 800;
		color: var(--green-color);
	}
</style>
