<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import type { Card } from '$lib/types/cards';

	let { data } = $props();

	// Local state
	let cards = $state<Card[]>([]);
	let user = $state(data.user);
	let error = $state(data.error);

	// Form state for creating / editing card
	let editingCardId = $state<string | null>(null);
	let title = $state('');
	let description = $state('');
	let category = $state('');
	let images = $state<string[]>([]);
	let newImageUrl = $state('');
	let uploading = $state(false);

	let searchQuery = $state('');
	let announcementText = $state('');
	let announcementSaved = $state(false);

	let existingCategories = $derived([...new Set(cards.map((c) => c.category).filter((cat): cat is string => Boolean(cat)))].sort());

	onMount(() => {
		const unsubscribe = cardsStore.subscribe((c) => (cards = c));
		fetch('/api/announcements')
			.then((res) => res.json())
			.then((d) => {
				if (d.announcement) announcementText = d.announcement;
			})
			.catch(() => {});

		return unsubscribe;
	});

	async function handleSaveAnnouncement(e: Event) {
		e.preventDefault();
		try {
			const res = await fetch('/api/announcements', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: announcementText })
			});
			if (res.ok) {
				announcementSaved = true;
				setTimeout(() => (announcementSaved = false), 3000);
			}
		} catch (err) {}
	}

	function resetForm() {
		editingCardId = null;
		title = '';
		description = '';
		category = '';
		images = [];
		newImageUrl = '';
	}

	function startEdit(card: Card) {
		editingCardId = card.id;
		title = card.title;
		description = card.description;
		category = card.category || '';
		images = card.images ? [...card.images] : [];
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function addImageUrl() {
		if (newImageUrl.trim()) {
			images = [...images, newImageUrl.trim()];
			newImageUrl = '';
		}
	}

	function removeImage(index: number) {
		images = images.filter((_, i) => i !== index);
	}

	async function handleFileUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) return;

		uploading = true;
		const formData = new FormData();
		formData.append('file', input.files[0]);

		try {
			const res = await fetch('/api/upload', {
				method: 'POST',
				body: formData
			});
			if (res.ok) {
				const data = await res.json();
				if (data.url) {
					images = [...images, data.url];
				}
			}
		} catch (err) {
			console.error("Errore durante l'upload:", err);
		} finally {
			uploading = false;
			input.value = '';
		}
	}

	async function handleSaveCard(e: Event) {
		e.preventDefault();
		if (!title.trim() || !description.trim()) return;

		if (editingCardId) {
			const existing = cards.find((c) => c.id === editingCardId);
			if (existing) {
				await cardsStore.updateCard({
					...existing,
					title: title.trim(),
					description: description.trim(),
					category: category.trim() || undefined,
					images: images.length > 0 ? images : undefined
				});
			}
		} else {
			await cardsStore.addCard({
				title: title.trim(),
				description: description.trim(),
				category: category.trim() || undefined,
				images: images.length > 0 ? images : undefined
			});
		}

		resetForm();
	}

	async function handleDeleteCard(id: string) {
		if (confirm('Sei sicuro di voler eliminare questa scheda?')) {
			await cardsStore.deleteCard(id);
		}
	}

	function exportJSON() {
		const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(cards, null, 2));
		const downloadAnchor = document.createElement('a');
		downloadAnchor.setAttribute('href', dataStr);
		downloadAnchor.setAttribute('download', `rail_focus_cards_${new Date().toISOString().split('T')[0]}.json`);
		document.body.appendChild(downloadAnchor);
		downloadAnchor.click();
		downloadAnchor.remove();
	}

	let filteredCards = $derived(
		cards.filter(
			(c) =>
				!searchQuery ||
				c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				c.description.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);
</script>

<div class="admin-container">
	{#if !user}
		<!-- Login View -->
		<div class="login-card">
			<div class="login-badge">Area Riservata</div>
			<h1 class="login-title">Pannello Amministratore</h1>
			<p class="login-desc">
				L'accesso al pannello di gestione è riservato esclusivamente all'amministratore autorizzato
				<strong>(Discord ID: 691289686093725736)</strong>.
			</p>

			{#if error}
				<div class="error-banner">
					⚠️ Errore di autenticazione: {error === 'unauthorized' ? 'Utente Discord non autorizzato!' : error}
				</div>
			{/if}

			<a href="/api/auth/login" class="discord-login-btn">
				<svg class="discord-icon" viewBox="0 0 24 24" fill="currentColor">
					<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
				</svg>
				Accedi con Discord
			</a>
		</div>
	{:else}
		<!-- Admin Panel Dashboard -->
		<div class="admin-panel">
			<!-- Header Admin Bar (NO photos as requested) -->
			<div class="admin-top duo-card">
				<div class="user-info">
					<div>
						<span class="user-name">👤 {user.username}</span>
						<span class="user-role">ID Discord: {user.userId} • Email: {user.email || 'N/D'}</span>
					</div>
				</div>

				<div class="top-actions">
					<button class="duo-btn duo-btn-blue export-btn" onclick={exportJSON}>
						📥 ESPORTA DB JSON
					</button>
					<a href="/api/auth/logout" class="duo-btn duo-btn-gray logout-btn">
						Esci
					</a>
				</div>
			</div>

			<!-- Platform Announcement Form -->
			<form class="announcement-card duo-card" onsubmit={handleSaveAnnouncement}>
				<h2 class="form-title">📢 Annuncio di Piattaforma (Visibile in Home)</h2>
				<p class="form-desc">Scrivi un annuncio o messaggio per tutti gli utenti da mostrare nell'intestazione della Home.</p>

				{#if announcementSaved}
					<div class="save-success-banner">
						✓ Annuncio salvato e pubblicato in Home!
					</div>
				{/if}

				<div class="form-group">
					<textarea
						bind:value={announcementText}
						placeholder="Scrivi qui l'annuncio dell'amministratore (es: Nuovi acronimi caricati nel DB!)..."
						rows="2"
						class="duo-input form-textarea"
					></textarea>
				</div>

				<div class="form-actions">
					<button type="submit" class="duo-btn duo-btn-purple save-btn">
						📢 PUBBLICA ANNUNCIO IN HOME
					</button>
				</div>
			</form>

			<!-- Card Editor Form -->
			<form class="editor-card duo-card" onsubmit={handleSaveCard}>
				<h2 class="form-title">
					{editingCardId ? '✏️ Modifica Scheda' : '➕ Aggiungi Nuova Card Informativa (PostgreSQL DB)'}
				</h2>

				<div class="form-grid">
					<div class="form-group">
						<label for="card-title">Acronimo / Titolo *</label>
						<input
							id="card-title"
							type="text"
							bind:value={title}
							placeholder="Es: RFI, SCMT, ETCS..."
							required
							class="duo-input form-input"
						/>
					</div>

					<div class="form-group">
						<label for="card-cat">Categoria ({existingCategories.length} esistenti)</label>
						<input
							id="card-cat"
							list="categories-list"
							type="text"
							bind:value={category}
							placeholder="Cerca o inserisci categoria..."
							class="duo-input form-input"
						/>
						<datalist id="categories-list">
							{#each existingCategories as cat}
								<option value={cat}></option>
							{/each}
						</datalist>
					</div>
				</div>

				<div class="form-group">
					<label for="card-desc">A cosa serve / Descrizione *</label>
					<textarea
						id="card-desc"
						bind:value={description}
						placeholder="Scrivi esattamente a cosa serve o la spiegazione dettagliata..."
						rows="4"
						required
						class="duo-input form-textarea"
					></textarea>
				</div>

				<!-- Images Section -->
				<div class="form-group">
					<span class="group-title-label">Immagini per la card ({images.length})</span>
					
					<div class="image-uploader">
						<div class="url-input-row">
							<input
								type="url"
								bind:value={newImageUrl}
								placeholder="Inserisci URL immagine (https://...)"
								class="duo-input form-input"
							/>
							<button type="button" class="duo-btn duo-btn-gray add-img-btn" onclick={addImageUrl}>
								+ Aggiungi URL
							</button>
						</div>

						<div class="file-input-row">
							<label class="duo-btn duo-btn-gray file-upload-label">
								📁 {uploading ? 'Caricamento...' : 'Carica da dispositivo'}
								<input type="file" accept="image/*" onchange={handleFileUpload} disabled={uploading} hidden />
							</label>
						</div>
					</div>

					{#if images.length > 0}
						<div class="images-preview-grid">
							{#each images as imgUrl, index}
								<div class="preview-box">
									<img src={imgUrl} alt="Preview {index}" class="preview-thumb" />
									<button type="button" class="remove-img-btn" onclick={() => removeImage(index)}>
										✕
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Form Actions -->
				<div class="form-actions">
					{#if editingCardId}
						<button type="button" class="duo-btn duo-btn-gray cancel-btn" onclick={resetForm}>
							Annulla
						</button>
					{/if}
					<button type="submit" class="duo-btn duo-btn-green save-btn">
						{editingCardId ? 'Salva Modifiche DB' : '➕ AGGIUNGI AL DB POSTGRESQL'}
					</button>
				</div>
			</form>

			<!-- Existing Cards List -->
			<div class="list-section">
				<div class="list-header">
					<h2>Schede nel DB ({filteredCards.length})</h2>
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Filtra tra le schede..."
						class="search-input"
					/>
				</div>

				<div class="cards-list">
					{#each filteredCards as card}
						<div class="admin-card-item">
							<div class="card-main-info">
								<div class="item-title-row">
									<h3 class="card-item-title">{card.title}</h3>
									{#if card.category}
										<span class="cat-pill">{card.category}</span>
									{/if}
									{#if card.images && card.images.length > 0}
										<span class="img-count-pill">📷 {card.images.length}</span>
									{/if}
								</div>
								<p class="card-item-desc">{card.description}</p>
							</div>

							<div class="item-actions">
								<button class="edit-btn" onclick={() => startEdit(card)}>
									✏️ Modifica
								</button>
								<button class="delete-btn" onclick={() => handleDeleteCard(card.id)}>
									🗑️ Elimina
								</button>
							</div>
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
		max-width: 800px;
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

	.export-btn, .logout-btn {
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
		margin: 0;
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	@media (max-width: 600px) {
		.form-grid {
			grid-template-columns: 1fr;
		}
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.form-group label, .group-title-label {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-color);
	}

	.form-input, .form-textarea {
		padding: 0.85rem;
		border-radius: 12px;
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		color: var(--text-color);
		font-size: 0.95rem;
	}

	.form-input:focus, .form-textarea:focus {
		outline: none;
		border-color: var(--accent-color);
	}

	.image-uploader {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.url-input-row {
		display: flex;
		gap: 0.5rem;
	}

	.url-input-row .form-input {
		flex: 1;
	}

	.add-img-btn {
		padding: 0.85rem 1rem;
		border-radius: 12px;
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		color: var(--accent-color);
		font-weight: 700;
		cursor: pointer;
		white-space: nowrap;
	}

	.file-upload-label {
		display: inline-block;
		padding: 0.6rem 1rem;
		border-radius: 10px;
		background: var(--card-bg-subtle);
		border: 1px dashed var(--border-color);
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		text-align: center;
	}

	.images-preview-grid {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-top: 0.5rem;
	}

	.preview-box {
		position: relative;
		width: 80px;
		height: 80px;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid var(--border-color);
	}

	.preview-thumb {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.remove-img-btn {
		position: absolute;
		top: 4px;
		right: 4px;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		border: none;
		border-radius: 50%;
		width: 22px;
		height: 22px;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.form-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		margin-top: 0.5rem;
	}

	.cancel-btn {
		padding: 0.85rem 1.25rem;
		border-radius: 14px;
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		color: var(--text-color);
		font-weight: 700;
		cursor: pointer;
	}

	.save-btn {
		padding: 0.85rem 1.5rem;
		border-radius: 14px;
		background: linear-gradient(135deg, var(--accent-color), #0284c7);
		color: white;
		border: none;
		font-weight: 800;
		font-size: 1rem;
		cursor: pointer;
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

	.search-input {
		padding: 0.6rem 1rem;
		border-radius: 10px;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		color: var(--text-color);
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
	}

	@media (max-width: 600px) {
		.admin-card-item {
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

	.cat-pill, .img-count-pill {
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

		/* Truncate text */
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.item-actions {
		display: flex;
		gap: 0.5rem;
	}

	.edit-btn, .delete-btn {
		padding: 0.5rem 0.85rem;
		border-radius: 10px;
		font-size: 0.8rem;
		font-weight: 700;
		border: 1px solid var(--border-color);
		cursor: pointer;
	}

	.edit-btn {
		background: var(--card-bg-subtle);
		color: var(--text-color);
	}

	.delete-btn {
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
		border-color: rgba(239, 68, 68, 0.3);
	}
</style>
