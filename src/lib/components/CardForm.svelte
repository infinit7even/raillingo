<script lang="ts">
	import { onMount } from 'svelte';
	import type { Card } from '$lib/types/cards';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { toastStore } from '$lib/stores/toastStore';
	import { compressImage } from '$lib/utils/imageCompressor';

	let {
		initialCard = null,
		onSave,
		onCancel = undefined,
		onSelectExistingCard = undefined,
		submitLabel = 'Salva Scheda'
	} = $props<{
		initialCard?: Card | null;
		onSave: (data: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void> | void;
		onCancel?: () => void;
		onSelectExistingCard?: (card: Card) => void;
		submitLabel?: string;
	}>();

	let title = $state('');
	let fullName = $state('');
	let description = $state('');
	let category = $state('');
	let customCategory = $state('');
	let images = $state<string[]>([]);
	let newImageUrl = $state('');
	let uploading = $state(false);
	let saving = $state(false);
	let validationError = $state<string | null>(null);

	// Existing cards and category list for suggestions
	let allCards = $state<Card[]>([]);

	onMount(() => {
		const unsub = cardsStore.subscribe((c) => (allCards = c));
		return unsub;
	});

	// Derive unique existing categories for quick selection
	let availableCategories = $derived.by<string[]>(() => {
		const set = new Set<string>();
		for (const c of allCards) {
			if (c.category && c.category.trim()) {
				set.add(c.category.trim());
			}
		}
		return Array.from(set).sort();
	});

	$effect(() => {
		if (initialCard) {
			title = initialCard.title || '';
			fullName = initialCard.fullName || '';
			description = initialCard.description || '';
			category = initialCard.category || '';
			images = initialCard.images ? [...initialCard.images] : [];
		} else {
			title = '';
			fullName = '';
			description = '';
			category = '';
			customCategory = '';
			images = [];
		}
		newImageUrl = '';
		validationError = null;
	});

	// Suggestions for anti-duplicate
	let titleSuggestions = $derived.by<Card[]>(() => {
		const q = title.trim().toLowerCase();
		if (!q || q.length < 2) return [];
		return allCards.filter(
			(c) =>
				c.id !== initialCard?.id &&
				(c.title.toLowerCase().includes(q) || (c.fullName && c.fullName.toLowerCase().includes(q)))
		).slice(0, 5);
	});

	let fullNameSuggestions = $derived.by<Card[]>(() => {
		const q = fullName.trim().toLowerCase();
		if (!q || q.length < 2) return [];
		return allCards.filter(
			(c) =>
				c.id !== initialCard?.id &&
				((c.fullName && c.fullName.toLowerCase().includes(q)) || c.title.toLowerCase().includes(q))
		).slice(0, 5);
	});

	function handleSelectExisting(card: Card) {
		if (onSelectExistingCard) {
			onSelectExistingCard(card);
		} else {
			// Populate local form in edit mode
			title = card.title || '';
			fullName = card.fullName || '';
			description = card.description || '';
			category = card.category || '';
			images = card.images ? [...card.images] : [];
		}
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
		toastStore.show({ message: '⏳ Compressione e caricamento immagine...' });
		try {
			// Comprimi l'immagine in WebP ottimizzato (massimo 1MB)
			const compressedFile = await compressImage(blob, {
				maxSizeMB: 1,
				maxWidth: 1920,
				maxHeight: 1920,
				quality: 0.82
			});

			const formData = new FormData();
			formData.append('file', compressedFile, 'pasted-card.webp');
			const res = await fetch('/api/upload', {
				method: 'POST',
				body: formData
			});

			if (res.ok) {
				const data = await res.json();
				if (data.url) {
					images = [...images, data.url];
					toastStore.show({ message: '🖼️ Immagine compressa e aggiunta alla scheda!' });
				}
			} else {
				const err = await res.json();
				toastStore.show({ message: `⚠️ ${err.error || 'Errore caricamento immagine'}` });
			}
		} catch (err) {
			console.error("Errore durante l'upload dell'immagine:", err);
			toastStore.show({ message: '⚠️ Impossibile caricare l\'immagine' });
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
		if (!items || uploading) return;
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item.type.indexOf('image') !== -1) {
				e.preventDefault();
				e.stopPropagation();
				const blob = item.getAsFile();
				if (blob && blob.size > 0) {
					uploadBlob(blob);
				}
				break;
			}
		}
	}

	function handleDrop(e: DragEvent) {
		const files = e.dataTransfer?.files;
		if (!files || files.length === 0) return;
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			if (file.type.startsWith('image/')) {
				e.preventDefault();
				uploadBlob(file);
				break;
			}
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		validationError = null;

		const finalCategory = category === '__NEW__' ? customCategory.trim() : category.trim();

		// Validation rules:
		// 1. Category is MANDATORY
		if (!finalCategory) {
			validationError = '⚠️ La Categoria è un campo obbligatorio!';
			return;
		}

		// 2. At least 2 fields filled out among (Acronimo, Titolo, Descrizione, Categoria)
		const filledFieldsCount = [
			title.trim(),
			fullName.trim(),
			description.trim(),
			finalCategory
		].filter(Boolean).length;

		if (filledFieldsCount < 2) {
			validationError =
				'⚠️ Devi compilare almeno 2 campi della scheda (es. Categoria + Acronimo, Titolo o Descrizione).';
			return;
		}

		saving = true;
		try {
			await onSave({
				title: title.trim(),
				fullName: fullName.trim() || undefined,
				description: description.trim(),
				category: finalCategory,
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
	{#if validationError}
		<div class="validation-error-box duo-card">
			{validationError}
		</div>
	{/if}

	<div class="form-grid">
		<!-- Campo Categoria (OBBLIGATORIO) -->
		<div class="form-group full-width">
			<label for="card-category-field">Categoria * (Obbligatoria)</label>
			<div class="category-input-row">
				<select
					id="card-category-field"
					bind:value={category}
					required
					class="duo-input select-category"
				>
					<option value="" disabled>-- Seleziona una categoria --</option>
					{#each availableCategories as cat}
						<option value={cat}>{cat}</option>
					{/each}
					<option value="__NEW__">➕ Crea nuova categoria...</option>
				</select>

				{#if category === '__NEW__'}
					<input
						type="text"
						bind:value={customCategory}
						placeholder="Inserisci nome nuova categoria..."
						required
						class="duo-input new-cat-input"
					/>
				{/if}
			</div>
		</div>

		<!-- Acronimo / Sigla -->
		<div class="form-group relative">
			<label for="card-title-field">Acronimo / Sigla Breve</label>
			<input
				id="card-title-field"
				type="text"
				bind:value={title}
				placeholder="es: IF, SCMT, RFI..."
				class="duo-input"
				autocomplete="off"
			/>

			<!-- Dropdown Suggerimenti Anti-Duplicato -->
			{#if titleSuggestions.length > 0}
				<div class="suggestions-dropdown duo-card">
					<div class="suggestion-header">💡 Card esistente trovata! Clicca per modificarla:</div>
					{#each titleSuggestions as sug}
						<button
							type="button"
							class="suggestion-item"
							onclick={() => handleSelectExisting(sug)}
						>
							<span class="sug-title">{sug.title}</span>
							{#if sug.fullName}
								<span class="sug-fullname">({sug.fullName})</span>
							{/if}
							<span class="sug-badge">✏️ Apri in modifica</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Titolo / Significato Esteso -->
		<div class="form-group relative">
			<label for="card-fullname-field">Titolo / Significato Esteso</label>
			<input
				id="card-fullname-field"
				type="text"
				bind:value={fullName}
				placeholder="es: Impresa Ferroviaria"
				class="duo-input"
				autocomplete="off"
			/>

			<!-- Dropdown Suggerimenti Anti-Duplicato per Titolo -->
			{#if fullNameSuggestions.length > 0}
				<div class="suggestions-dropdown duo-card">
					<div class="suggestion-header">💡 Card esistente trovata! Clicca per modificarla:</div>
					{#each fullNameSuggestions as sug}
						<button
							type="button"
							class="suggestion-item"
							onclick={() => handleSelectExisting(sug)}
						>
							<span class="sug-title">{sug.title}</span>
							{#if sug.fullName}
								<span class="sug-fullname">({sug.fullName})</span>
							{/if}
							<span class="sug-badge">✏️ Apri in modifica</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Descrizione -->
		<div class="form-group full-width">
			<label for="card-desc-field">Descrizione & Spiegazione</label>
			<textarea
				id="card-desc-field"
				bind:value={description}
				placeholder="Scrivi qui la definizione completa e l'utilizzo operativo dell'acronimo/termine..."
				rows="3"
				class="duo-input form-textarea"
			></textarea>
		</div>

		<!-- Immagini Visive -->
		<div
			class="form-group full-width"
			ondrop={handleDrop}
			ondragover={(e) => e.preventDefault()}
			role="region"
			aria-label="Caricamento immagini"
		>
			<label for="card-image-url-field"
				>Immagini Visive (Carica File, Incolla dagli appunti o inserisci URL)</label
			>

			<div class="upload-controls-row">
				<label class="file-upload-btn duo-btn duo-btn-blue">
					<span>{uploading ? '⏳ Caricamento...' : '📁 Sfoglia Immagine'}</span>
					<input
						type="file"
						accept="image/png,image/jpeg,image/webp"
						onchange={handleFileUpload}
						disabled={uploading}
						class="hidden-file-input"
					/>
				</label>

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
					<button type="button" class="duo-btn duo-btn-gray" onclick={addImageUrl}> URL </button>
				</div>
			</div>
			<p class="paste-hint-text">
				💡 Puoi anche fare <strong>Incolla (Ctrl+V)</strong> per caricare direttamente uno screenshot!
			</p>

			{#if images.length > 0}
				<div class="images-preview-grid">
					{#each images as img, i}
						<div class="img-preview-item duo-card">
							<img src={img} alt="Anteprima {i + 1}" class="preview-img" />
							<button
								type="button"
								class="remove-img-btn"
								onclick={() => removeImage(i)}
								title="Rimuovi immagine"
							>
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

	.validation-error-box {
		background: rgba(239, 68, 68, 0.15);
		border: 1.5px solid #ef4444;
		color: #f87171;
		padding: 0.85rem;
		border-radius: 14px;
		font-weight: 800;
		font-size: 0.88rem;
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.full-width {
		grid-column: 1 / -1;
	}

	.relative {
		position: relative;
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

	.category-input-row {
		display: flex;
		gap: 0.5rem;
	}

	.select-category {
		flex: 1;
	}

	.new-cat-input {
		flex: 1;
	}

	.form-textarea {
		resize: vertical;
		font-family: inherit;
		min-height: 75px;
	}

	/* Suggestions anti-duplicate dropdown */
	.suggestions-dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		z-index: 100;
		background: var(--card-bg);
		border: 2px solid var(--accent-color);
		border-radius: 16px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.suggestion-header {
		font-size: 0.72rem;
		font-weight: 900;
		color: var(--accent-color);
		text-transform: uppercase;
		padding: 0.25rem 0.5rem;
	}

	.suggestion-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 10px;
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		color: var(--text-color);
		cursor: pointer;
		text-align: left;
		transition: background 0.15s ease;
	}

	.suggestion-item:hover {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
	}

	.sug-title {
		font-weight: 900;
		font-size: 0.95rem;

	}

	.sug-fullname {
		font-size: 0.8rem;
		color: var(--text-muted);
		flex: 1;
	}

	.sug-badge {
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--accent-color);
		white-space: nowrap;
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
