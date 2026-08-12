<script lang="ts">
	import { onMount } from 'svelte';
	import type { Card } from '$lib/types/cards';

	let {
		initialCard = null,
		existingCategories = [],
		onSave,
		onCancel = undefined,
		submitLabel = 'Salva Scheda'
	} = $props<{
		initialCard?: Card | null;
		existingCategories?: string[];
		onSave: (data: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void> | void;
		onCancel?: () => void;
		submitLabel?: string;
	}>();

	let title = $state('');
	let fullName = $state('');
	let description = $state('');
	let categoryInput = $state('');
	let selectedCategories = $state<string[]>([]);
	let images = $state<string[]>([]);
	let newImageUrl = $state('');
	let uploading = $state(false);
	let saving = $state(false);

	$effect(() => {
		if (initialCard) {
			title = initialCard.title || '';
			fullName = initialCard.fullName || '';
			description = initialCard.description || '';
			const cats = initialCard.categories && initialCard.categories.length > 0 
				? initialCard.categories 
				: initialCard.category ? [initialCard.category] : [];
			selectedCategories = [...cats];
			categoryInput = '';
			images = initialCard.images ? [...initialCard.images] : [];
		} else {
			title = '';
			fullName = '';
			description = '';
			selectedCategories = [];
			categoryInput = '';
			images = [];
		}
		newImageUrl = '';
	});

	function toggleCategory(cat: string) {
		if (selectedCategories.includes(cat)) {
			selectedCategories = selectedCategories.filter((c) => c !== cat);
		} else {
			selectedCategories = [...selectedCategories, cat];
		}
	}

	function addCategoryFromInput() {
		const raw = categoryInput.trim();
		if (!raw) return;
		const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
		for (const p of parts) {
			if (!selectedCategories.includes(p)) {
				selectedCategories = [...selectedCategories, p];
			}
		}
		categoryInput = '';
	}

	function removeCategory(cat: string) {
		selectedCategories = selectedCategories.filter((c) => c !== cat);
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

	async function uploadBlob(blob: Blob) {
		uploading = true;
		try {
			const formData = new FormData();
			formData.append('file', blob, `upload-${Date.now()}.png`);
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
			console.error("Errore durante l'upload dell'immagine:", err);
		} finally {
			uploading = false;
		}
	}

	async function handleFileUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) return;
		await uploadBlob(input.files[0]);
		input.value = '';
	}

	function handlePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item.type.indexOf('image') !== -1) {
				e.preventDefault();
				const blob = item.getAsFile();
				if (blob) {
					uploadBlob(blob);
				}
			}
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!title.trim() || !description.trim()) return;

		if (categoryInput.trim()) {
			addCategoryFromInput();
		}

		saving = true;
		try {
			await onSave({
				title: title.trim(),
				fullName: fullName.trim() || undefined,
				description: description.trim(),
				category: selectedCategories.length > 0 ? selectedCategories[0] : undefined,
				categories: selectedCategories.length > 0 ? selectedCategories : undefined,
				images: images.length > 0 ? images : undefined
			});
		} catch (err) {
			console.error('Errore nel salvataggio della scheda:', err);
		} finally {
			saving = false;
		}
	}
</script>

<form class="universal-card-form" onsubmit={handleSubmit}>
	<div class="form-grid">
		<!-- Acronimo / Titolo -->
		<div class="form-group">
			<label for="card-title-field">Acronimo / Sigla Breve *</label>
			<input
				id="card-title-field"
				type="text"
				bind:value={title}
				placeholder="es: IF, SCMT, ANSFISA..."
				required
				class="duo-input"
			/>
		</div>

		<!-- Significato Esteso / Full Name -->
		<div class="form-group">
			<label for="card-fullname-field">Significato Esteso / Acronimo Completo</label>
			<input
				id="card-fullname-field"
				type="text"
				bind:value={fullName}
				placeholder="es: Impresa Ferroviaria"
				class="duo-input"
			/>
		</div>

		<!-- Categorie -->
		<div class="form-group full-width">
			<label for="card-category-input">Categorie (Seleziona esistenti o digita e premi Invio / Virgola)</label>
			
			{#if existingCategories && existingCategories.length > 0}
				<div class="existing-chips-pool">
					{#each existingCategories as cat}
						{@const isSel = selectedCategories.includes(cat)}
						<button
							type="button"
							class="cat-chip-btn"
							class:selected={isSel}
							onclick={() => toggleCategory(cat)}
						>
							{isSel ? '✓ ' : '+ '}{cat}
						</button>
					{/each}
				</div>
			{/if}

			<div class="cat-input-row">
				<input
					id="card-category-input"
					type="text"
					bind:value={categoryInput}
					placeholder="Aggiungi nuova categoria (es: Segnalamento, Trazione)..."
					class="duo-input"
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ',') {
							e.preventDefault();
							addCategoryFromInput();
						}
					}}
				/>
				<button type="button" class="duo-btn duo-btn-gray add-cat-btn" onclick={addCategoryFromInput}>
					Aggiungi
				</button>
			</div>

			{#if selectedCategories.length > 0}
				<div class="selected-tags-box">
					<span class="selected-label">Selezionate:</span>
					{#each selectedCategories as cat}
						<span class="tag-badge">
							{cat}
							<button type="button" class="remove-tag-btn" onclick={() => removeCategory(cat)}>✕</button>
						</span>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Descrizione / Spiegazione -->
		<div class="form-group full-width">
			<label for="card-desc-field">Spiegazione & Utilizzo Dettagliato *</label>
			<textarea
				id="card-desc-field"
				bind:value={description}
				placeholder="Scrivi qui la definizione completa e l'utilizzo operativo dell'acronimo..."
				rows="3"
				required
				class="duo-input form-textarea"
			></textarea>
		</div>

		<!-- Gestione Immagini -->
		<div class="form-group full-width">
			<label for="card-image-url-field">Immagini Visive (Carica File, Incolla dagli appunti o inserisci URL)</label>

			<div class="upload-controls-row">
				<!-- File Upload Input -->
				<label class="file-upload-btn duo-btn duo-btn-blue">
					<span>{uploading ? '⏳ Caricamento...' : '📁 Sfoglia Immagine'}</span>
					<input
						type="file"
						accept="image/*"
						onchange={handleFileUpload}
						disabled={uploading}
						class="hidden-file-input"
					/>
				</label>

				<!-- Paste Hint & URL Input -->
				<div class="url-input-group">
					<input
						id="card-image-url-field"
						type="url"
						bind:value={newImageUrl}
						placeholder="Oppure incolla qui un link URL di un'immagine..."
						class="duo-input"
						onpaste={handlePaste}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								addImageUrl();
							}
						}}
					/>
					<button type="button" class="duo-btn duo-btn-gray" onclick={addImageUrl}>
						+ URL
					</button>
				</div>
			</div>
			<p class="paste-hint-text">💡 Puoi anche fare <strong>Incolla (Ctrl+V)</strong> per caricare direttamente uno screenshot copiato negli appunti!</p>

			<!-- Gallery Preview Grid -->
			{#if images.length > 0}
				<div class="images-preview-grid">
					{#each images as img, i}
						<div class="img-preview-item duo-card">
							<img src={img} alt="Anteprima {i + 1}" class="preview-img" />
							<button type="button" class="remove-img-btn" onclick={() => removeImage(i)} title="Rimuovi immagine">
								✕
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Form Actions -->
	<div class="form-actions">
		{#if onCancel}
			<button type="button" class="duo-btn duo-btn-gray cancel-btn" onclick={onCancel}>
				Annulla
			</button>
		{/if}
		<button type="submit" class="duo-btn duo-btn-green save-btn" disabled={saving}>
			{saving ? 'Salvataggio in corso...' : submitLabel}
		</button>
	</div>
</form>

<style>
	.universal-card-form {
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
		width: 100%;
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.full-width {
		grid-column: 1 / -1;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.form-group label {
		font-size: 0.82rem;
		font-weight: 800;
		color: var(--text-color);
		letter-spacing: 0.02em;
	}

	.existing-chips-pool {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-bottom: 0.4rem;
	}

	.cat-chip-btn {
		font-size: 0.72rem;
		font-weight: 800;
		padding: 0.25rem 0.55rem;
		border-radius: 10px;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.cat-chip-btn.selected {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.cat-input-row {
		display: flex;
		gap: 0.4rem;
	}

	.add-cat-btn {
		white-space: nowrap;
		font-size: 0.78rem;
	}

	.selected-tags-box {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.4rem;
	}

	.selected-label {
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-muted);
	}

	.tag-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.75rem;
		font-weight: 800;
		padding: 0.2rem 0.55rem;
		border-radius: 8px;
		background: var(--accent-light-bg);
		color: var(--accent-color);
		border: 1px solid var(--accent-color);
	}

	.remove-tag-btn {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 900;
		padding: 0;
		line-height: 1;
	}

	.form-textarea {
		resize: vertical;
		font-family: inherit;
		min-height: 75px;
	}

	.upload-controls-row {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.file-upload-btn {
		cursor: pointer;
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		white-space: nowrap;
		font-size: 0.82rem;
		padding: 0.55rem 0.85rem;
	}

	.hidden-file-input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
		width: 100%;
		height: 100%;
	}

	.url-input-group {
		flex: 1;
		display: flex;
		gap: 0.4rem;
		min-width: 240px;
	}

	.paste-hint-text {
		font-size: 0.72rem;
		color: var(--text-muted);
		margin: 0.2rem 0 0 0;
	}

	.images-preview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(85px, 1fr));
		gap: 0.6rem;
		margin-top: 0.5rem;
	}

	.img-preview-item {
		position: relative;
		aspect-ratio: 16/10;
		padding: 0;
		overflow: hidden;
		border-radius: 12px;
	}

	.preview-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.remove-img-btn {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.75);
		color: #ffffff;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 900;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.6rem;
		margin-top: 0.5rem;
	}

	.save-btn {
		font-size: 0.88rem;
		padding: 0.65rem 1.25rem;
	}

	@media (max-width: 640px) {
		.form-grid {
			grid-template-columns: 1fr;
		}

		.upload-controls-row {
			flex-direction: column;
			align-items: stretch;
		}

		.url-input-group {
			width: 100%;
			min-width: 0;
		}
	}
</style>
