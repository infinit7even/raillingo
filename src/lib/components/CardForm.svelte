<script lang="ts">
	import { onMount } from 'svelte';
	import type { Card } from '$lib/types/cards';
	import { cardsStore } from '$lib/stores/cardsStore';
	import { toastStore } from '$lib/stores/toastStore';
	import { uploadImage } from '$lib/utils/imageUploader';

	let {
		initialCard = null,
		onSave,
		onCancel = undefined,
		onSelectExistingCard = undefined,
		submitLabel = undefined
	} = $props<{
		initialCard?: Card | null;
		onSave: (data: { id?: string } & Omit<Card, 'createdAt' | 'updatedAt'>) => Promise<void> | void;
		onCancel?: () => void;
		onSelectExistingCard?: (card: Card) => void;
		submitLabel?: string;
	}>();

	const DRAFT_KEY = 'rf_card_form_draft';

	// Form fields
	let title = $state('');
	let hasAcronym = $state(false);
	let acronym = $state('');
	let fullName = $state('');
	let description = $state('');
	let category = $state('');
	let customCategory = $state('');
	let images = $state<string[]>([]);
	let showInWiki = $state(true);
	let gameModes = $state<string[]>(['flashcard', 'quiz', 'reels', 'scrittura']);

	let newImageUrl = $state('');
	let uploading = $state(false);
	let saving = $state(false);
	let validationError = $state<string | null>(null);
	let isCloneSearchOpen = $state(false);
	let cloneQuery = $state('');
	let cloneCategoryFilter = $state('ALL');
	let isTitleFocused = $state(false);
	let activeEditCard = $state<Card | null>(null);

	let effectiveEditCard = $derived(initialCard || activeEditCard);

	let effectiveSubmitLabel = $derived.by(() => {
		if (saving) return 'Salvataggio in corso...';
		if (effectiveEditCard?.id) {
			return `💾 SALVA MODIFICHE SCHEDA ("${effectiveEditCard.title}")`;
		}
		if (initialCard) {
			return submitLabel || '💾 SALVA MODIFICHE';
		}
		return submitLabel || '➕ AGGIUNGI SCHEDA';
	});

	// Existing cards for suggestions and duplication
	let allCards = $state<Card[]>([]);

	onMount(() => {
		const unsub = cardsStore.subscribe((c) => (allCards = c));

		// Ripristina bozza salvata se non si sta modificando una scheda specifica
		if (!initialCard && typeof localStorage !== 'undefined') {
			try {
				const savedDraft = localStorage.getItem(DRAFT_KEY);
				if (savedDraft) {
					const draft = JSON.parse(savedDraft);
					title = draft.title || '';
					hasAcronym = Boolean(draft.hasAcronym);
					acronym = draft.acronym || '';
					fullName = draft.fullName || '';
					description = draft.description || '';
					category = draft.category || '';
					customCategory = draft.customCategory || '';
					images = Array.isArray(draft.images) ? draft.images : [];
					showInWiki = draft.showInWiki !== false;
					gameModes = Array.isArray(draft.gameModes) && draft.gameModes.length > 0
						? draft.gameModes
						: ['flashcard', 'quiz', 'reels', 'scrittura'];
				}
			} catch (e) {
				console.warn('Errore lettura bozza scheda:', e);
			}
		}

		return unsub;
	});

	// Salva la bozza ogni volta che i campi cambiano (solo se nuova scheda)
	function saveDraft() {
		if (effectiveEditCard?.id) return; // Non salvare bozza se si sta modificando una card salvata
		if (typeof localStorage === 'undefined') return;

		const draftData = {
			title,
			hasAcronym,
			acronym,
			fullName,
			description,
			category,
			customCategory,
			images,
			showInWiki,
			gameModes
		};
		try {
			localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
		} catch (e) {}
	}

	function clearDraft() {
		title = '';
		hasAcronym = false;
		acronym = '';
		fullName = '';
		description = '';
		category = '';
		customCategory = '';
		images = [];
		showInWiki = true;
		gameModes = ['flashcard', 'quiz', 'reels', 'scrittura'];
		validationError = null;
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(DRAFT_KEY);
		}
		toastStore.show({ message: '🧹 Campi del modulo azzerati', type: 'info' });
	}

	// Categories for dropdown
	let availableCategories = $derived.by<string[]>(() => {
		const set = new Set<string>();
		for (const c of allCards) {
			if (c.category && c.category.trim()) {
				set.add(c.category.trim());
			}
		}
		return Array.from(set).sort();
	});

	// Filtered cards for duplication
	let cloneFilteredCards = $derived.by<Card[]>(() => {
		let list = [...allCards];
		if (cloneCategoryFilter !== 'ALL') {
			list = list.filter((c) => (c.category?.trim() || '') === cloneCategoryFilter);
		}
		const q = cloneQuery.toLowerCase().trim();
		if (q) {
			list = list.filter(
				(c) =>
					c.title.toLowerCase().includes(q) ||
					(c.fullName && c.fullName.toLowerCase().includes(q)) ||
					(c.category && c.category.toLowerCase().includes(q))
			);
		}
		return list.slice(0, 10);
	});

	function cloneCardIntoForm(card: Card) {
		activeEditCard = null;
		title = card.title || '';
		hasAcronym = Boolean(card.hasAcronym || (card.fullName && card.fullName !== card.title));
		acronym = card.acronym || (hasAcronym && card.title.length <= 10 ? card.title : '');
		fullName = card.fullName || '';
		description = card.description || '';
		category = card.category || '';
		images = card.images ? [...card.images] : [];
		showInWiki = card.showInWiki !== false;
		gameModes = Array.isArray(card.gameModes) && card.gameModes.length > 0
			? [...card.gameModes]
			: ['flashcard', 'quiz', 'reels', 'scrittura'];
		isCloneSearchOpen = false;
		saveDraft();
		toastStore.show({ message: `📋 Dati clonati da "${card.title}"!` });
	}

	$effect(() => {
		if (initialCard) {
			activeEditCard = null;
			title = initialCard.title || '';
			hasAcronym = Boolean(initialCard.hasAcronym || (initialCard.fullName && initialCard.fullName !== initialCard.title));
			acronym = initialCard.acronym || (hasAcronym && initialCard.title.length <= 10 ? initialCard.title : '');
			fullName = initialCard.fullName || '';
			description = initialCard.description || '';
			category = initialCard.category || '';
			images = initialCard.images ? [...initialCard.images] : [];
			showInWiki = initialCard.showInWiki !== false;
			gameModes = Array.isArray(initialCard.gameModes) && initialCard.gameModes.length > 0
				? [...initialCard.gameModes]
				: ['flashcard', 'quiz', 'reels', 'scrittura'];
		}
	});

	// Anti-duplicate suggestions
	let titleSuggestions = $derived.by<Card[]>(() => {
		const q = title.trim().toLowerCase();
		if (!q || q.length < 2) return [];
		return allCards.filter(
			(c) =>
				c.id !== effectiveEditCard?.id &&
				(c.title.toLowerCase().includes(q) || (c.fullName && c.fullName.toLowerCase().includes(q)))
		).slice(0, 5);
	});

	function handleSelectExisting(card: Card) {
		activeEditCard = card;
		title = card.title || '';
		hasAcronym = Boolean(card.hasAcronym || (card.fullName && card.fullName !== card.title));
		acronym = card.acronym || '';
		fullName = card.fullName || '';
		description = card.description || '';
		category = card.category || '';
		images = card.images ? [...card.images] : [];
		showInWiki = card.showInWiki !== false;
		gameModes = Array.isArray(card.gameModes) && card.gameModes.length > 0
			? [...card.gameModes]
			: ['flashcard', 'quiz', 'reels', 'scrittura'];
		isTitleFocused = false;
		toastStore.show({ message: `✏️ Passato alla modifica di "${card.title}"` });
		if (onSelectExistingCard) {
			onSelectExistingCard(card);
		}
	}

	function cancelActiveEdit() {
		activeEditCard = null;
		clearDraft();
		if (onCancel) onCancel();
	}

	function toggleGameMode(mode: string) {
		if (gameModes.includes(mode)) {
			// Non permettere di deselezionare tutti i minigiochi se non si vuole
			gameModes = gameModes.filter((m) => m !== mode);
		} else {
			gameModes = [...gameModes, mode];
		}
		saveDraft();
	}

	function addImageUrl() {
		if (newImageUrl.trim()) {
			images = [...images, newImageUrl.trim()];
			newImageUrl = '';
			saveDraft();
		}
	}

	function removeImage(index: number) {
		images = images.filter((_, i) => i !== index);
		saveDraft();
	}

	async function uploadBlob(blob: Blob) {
		if (uploading) return;
		uploading = true;
		toastStore.show({ message: '⏳ Compressione e caricamento immagine...' });
		try {
			const res = await uploadImage(blob, { context: 'card' });
			if (res.url) {
				images = [...images, res.url];
				saveDraft();
				toastStore.show({ message: '🖼️ Immagine compressa e aggiunta alla scheda!' });
			}
		} catch (err: any) {
			console.error("Errore durante l'upload dell'immagine:", err);
			toastStore.show({ message: `⚠️ ${err.message || 'Impossibile caricare l\'immagine'}` });
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

		const finalTitle = title.trim();
		if (!finalTitle) {
			validationError = '⚠️ Il Titolo della scheda è un campo obbligatorio!';
			return;
		}

		const finalCategory = category === '__NEW__' ? customCategory.trim() : category.trim();
		if (!finalCategory) {
			validationError = '⚠️ La Categoria è un campo obbligatorio!';
			return;
		}

		const validImages = images.filter((img) => typeof img === 'string' && img.trim().length > 0);
		const finalAcronym = hasAcronym ? acronym.trim() : '';

		saving = true;
		try {
			await onSave({
				...(effectiveEditCard?.id ? { id: effectiveEditCard.id } : {}),
				title: finalTitle,
				hasAcronym,
				acronym: finalAcronym || undefined,
				fullName: fullName.trim() || (finalAcronym ? finalTitle : undefined),
				description: description.trim(),
				category: finalCategory,
				images: validImages,
				showInWiki,
				gameModes: gameModes.length > 0 ? gameModes : ['flashcard', 'quiz', 'reels', 'scrittura']
			} as any);

			// Pulisci bozza su salvataggio riuscito
			if (typeof localStorage !== 'undefined') {
				localStorage.removeItem(DRAFT_KEY);
			}

			if (activeEditCard) {
				activeEditCard = null;
			}
		} catch (err: any) {
			console.error('Errore nel salvataggio della scheda:', err);
			const errMsg = err?.message || '⚠️ Errore durante il salvataggio della scheda sul server.';
			validationError = errMsg;
			toastStore.show({ message: errMsg });
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

	<!-- Quick Inline Clone Helper -->
	<div class="clone-helper-section">
		<button
			type="button"
			class="clone-helper-trigger-btn"
			class:active={isCloneSearchOpen}
			onclick={() => (isCloneSearchOpen = !isCloneSearchOpen)}
		>
			<span class="c-ico">📋</span>
			<span>{isCloneSearchOpen ? 'Chiudi selettore clonazione' : 'Clona dati da una card esistente...'}</span>
			<span class="c-arr">{isCloneSearchOpen ? '▲' : '▼'}</span>
		</button>

		{#if isCloneSearchOpen}
			<div class="inline-clone-panel duo-card">
				<div class="clone-filter-row">
					<input
						type="text"
						bind:value={cloneQuery}
						placeholder="Cerca titolo o acronimo da clonare..."
						class="duo-input clone-search-input"
					/>
					<select bind:value={cloneCategoryFilter} class="duo-input clone-cat-select">
						<option value="ALL">Tutte le Categorie ({availableCategories.length})</option>
						{#each availableCategories as cat}
							<option value={cat}>{cat}</option>
						{/each}
					</select>
				</div>

				<div class="clone-results-grid">
					{#if cloneFilteredCards.length === 0}
						<div class="no-clone-results">Nessuna card trovata per la ricerca.</div>
					{:else}
						{#each cloneFilteredCards as c}
							<button
								type="button"
								class="clone-card-chip"
								onclick={() => cloneCardIntoForm(c)}
								title="Copia tutti i dati di questa card nel form"
							>
								<span class="chip-title">{c.title}</span>
								{#if c.fullName && c.fullName.trim().toLowerCase() !== c.title.trim().toLowerCase()}<span class="chip-fn">({c.fullName})</span>{/if}
								{#if c.category}<span class="chip-cat">{c.category}</span>{/if}
								<span class="chip-action">📋 Clona</span>
							</button>
						{/each}
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<div class="form-grid">
		<!-- 1. TITOLO (OBBLIGATORIO) -->
		<div class="form-group full-width relative">
			<div class="label-with-hint">
				<label for="card-title-field">Titolo Scheda / Termine * (Obbligatorio)</label>
				<span class="required-badge">Richiesto</span>
			</div>
			<input
				id="card-title-field"
				type="text"
				bind:value={title}
				oninput={saveDraft}
				onfocus={() => (isTitleFocused = true)}
				onblur={() => setTimeout(() => (isTitleFocused = false), 200)}
				placeholder="es: Segnale di Partenza, SCMT, Impresa Ferroviaria..."
				required
				class="duo-input main-title-input"
				autocomplete="off"
			/>

			<!-- Dropdown Suggerimenti Anti-Duplicato -->
			{#if isTitleFocused && titleSuggestions.length > 0}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="suggestions-dropdown duo-card" onmousedown={(e) => e.preventDefault()}>
					<div class="suggestion-header">💡 Scheda simile già presente:</div>
					{#each titleSuggestions as sug}
						<div class="suggestion-item">
							<div class="sug-info">
								<span class="sug-title">{sug.title}</span>
								{#if sug.category}<span class="sug-cat">{sug.category}</span>{/if}
							</div>
							<div class="sug-actions">
								<button type="button" class="sug-action-btn clone" onclick={() => cloneCardIntoForm(sug)}>
									📋 Clona
								</button>
								<button type="button" class="sug-action-btn edit" onclick={() => handleSelectExisting(sug)}>
									✏️ Modifica
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- 2. SPUNTA ACRONIMO & CAMPO OPZIONALE -->
		<div class="form-group full-width acr-toggle-box">
			<label class="custom-checkbox-row">
				<input
					type="checkbox"
					bind:checked={hasAcronym}
					onchange={saveDraft}
					class="styled-checkbox"
				/>
				<span class="checkbox-label-text">
					<strong>È un acronimo / possiede una sigla?</strong> (es. IF, SCMT, RFI)
				</span>
			</label>

			{#if hasAcronym}
				<div class="acronym-input-wrap">
					<label for="card-acronym-field">Sigla / Acronimo Breve</label>
					<input
						id="card-acronym-field"
						type="text"
						bind:value={acronym}
						oninput={saveDraft}
						placeholder="es: SCMT"
						class="duo-input"
					/>
				</div>
			{/if}
		</div>

		<!-- 3. CATEGORIA (OBBLIGATORIA) -->
		<div class="form-group full-width">
			<label for="card-category-field">Categoria * (Obbligatoria)</label>
			<div class="category-input-row">
				<select
					id="card-category-field"
					bind:value={category}
					onchange={saveDraft}
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
						oninput={saveDraft}
						placeholder="Inserisci nome nuova categoria..."
						required
						class="duo-input new-cat-input"
					/>
				{/if}
			</div>
		</div>

		<!-- 4. VISIBILITÀ WIKI & MINIGIOCHI (SPUNTE) -->
		<div class="form-group full-width visibility-section duo-card">
			<span class="visibility-section-title">🌐 Visibilità e Giochi in cui mostrare la scheda</span>
			
			<div class="visibility-toggles-grid">
				<!-- Spunta Mostra nella Wiki -->
				<label class="game-toggle-chip" class:active={showInWiki}>
					<input
						type="checkbox"
						bind:checked={showInWiki}
						onchange={saveDraft}
						class="hidden-toggle-input"
					/>
					<span class="toggle-icon">📚</span>
					<div class="toggle-text">
						<strong>Mostra nella WIKI</strong>
						<span class="toggle-sub">Visibile nel dizionario ed eleggibile per la parola del giorno</span>
					</div>
					<span class="toggle-status-badge">{showInWiki ? '✓ ATTIVA' : '✕ NO'}</span>
				</label>

				<!-- Spunte Minigiochi -->
				<div class="minigames-pills-row">
					<span class="minigames-group-lbl">Mini-giochi:</span>
					<button
						type="button"
						class="game-pill-btn"
						class:checked={gameModes.includes('flashcard')}
						onclick={() => toggleGameMode('flashcard')}
					>
						<span>📖 Flashcard</span>
						<span class="pill-check">{gameModes.includes('flashcard') ? '✓' : '✕'}</span>
					</button>

					<button
						type="button"
						class="game-pill-btn"
						class:checked={gameModes.includes('quiz')}
						onclick={() => toggleGameMode('quiz')}
					>
						<span>⭐ Quiz</span>
						<span class="pill-check">{gameModes.includes('quiz') ? '✓' : '✕'}</span>
					</button>

					<button
						type="button"
						class="game-pill-btn"
						class:checked={gameModes.includes('reels')}
						onclick={() => toggleGameMode('reels')}
					>
						<span>📷 Reels</span>
						<span class="pill-check">{gameModes.includes('reels') ? '✓' : '✕'}</span>
					</button>

					<button
						type="button"
						class="game-pill-btn"
						class:checked={gameModes.includes('scrittura')}
						onclick={() => toggleGameMode('scrittura')}
					>
						<span>✍️ Scrittura / Ripasso</span>
						<span class="pill-check">{gameModes.includes('scrittura') ? '✓' : '✕'}</span>
					</button>
				</div>
			</div>
		</div>

		<!-- 5. DESCRIZIONE -->
		<div class="form-group full-width">
			<label for="card-desc-field">Descrizione & Spiegazione</label>
			<textarea
				id="card-desc-field"
				bind:value={description}
				oninput={saveDraft}
				placeholder="Scrivi qui la definizione completa e l'utilizzo operativo della scheda..."
				rows="3"
				class="duo-input form-textarea"
			></textarea>
		</div>

		<!-- 6. IMMAGINI VISIVE -->
		<div
			class="form-group full-width"
			ondrop={handleDrop}
			ondragover={(e) => e.preventDefault()}
			role="region"
			aria-label="Caricamento immagini"
		>
			<label for="card-image-url-field">Immagini Visive (File, Screenshot Ctrl+V o Link URL)</label>

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
						placeholder="Oppure incolla link URL immagine..."
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

	{#if activeEditCard}
		<div class="active-edit-notice-banner duo-card">
			<span>✏️ Stai modificando la scheda esistente <strong>"{activeEditCard.title}"</strong>. Salva per aggiornarla.</span>
			<button type="button" class="cancel-active-edit-chip" onclick={cancelActiveEdit}>
				✕ Torna a Nuova Scheda
			</button>
		</div>
	{/if}

	<!-- Form Actions with Clear Draft button -->
	<div class="form-actions">
		<button
			type="button"
			class="duo-btn duo-btn-gray clear-draft-btn"
			onclick={clearDraft}
			title="Azzera tutti i campi inseriti"
		>
			🗑️ Pulisci Campi
		</button>

		{#if onCancel || activeEditCard}
			<button type="button" class="duo-btn duo-btn-gray cancel-btn" onclick={cancelActiveEdit}>
				Annulla
			</button>
		{/if}

		<button type="submit" class="duo-btn duo-btn-green save-btn" disabled={saving}>
			{effectiveSubmitLabel}
		</button>
	</div>
</form>

<style>
	.universal-card-form {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		width: 100%;
	}

	.label-with-hint {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.required-badge {
		font-size: 0.68rem;
		font-weight: 900;
		color: #ff4b4b;
		background: rgba(255, 75, 75, 0.12);
		padding: 0.1rem 0.4rem;
		border-radius: 6px;
	}

	.main-title-input {
		font-size: 1rem;
		font-weight: 800;
	}

	.acr-toggle-box {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 14px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.custom-checkbox-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		cursor: pointer;
		user-select: none;
	}

	.styled-checkbox {
		width: 18px;
		height: 18px;
		accent-color: var(--accent-color);
		cursor: pointer;
	}

	.checkbox-label-text {
		font-size: 0.84rem;
		color: var(--text-color);
	}

	.acronym-input-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding-top: 0.4rem;
		border-top: 1px dashed var(--border-color);
	}

	.visibility-section {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 16px;
		padding: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.visibility-section-title {
		font-size: 0.82rem;
		font-weight: 900;
		color: var(--accent-color);
		letter-spacing: 0.02em;
	}

	.visibility-toggles-grid {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.game-toggle-chip {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0.8rem;
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.game-toggle-chip.active {
		border-color: var(--accent-color);
		background: var(--accent-light-bg);
	}

	.hidden-toggle-input {
		display: none;
	}

	.toggle-icon {
		font-size: 1.2rem;
	}

	.toggle-text {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.toggle-text strong {
		font-size: 0.82rem;
		color: var(--text-color);
	}

	.toggle-sub {
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	.toggle-status-badge {
		font-size: 0.7rem;
		font-weight: 900;
		padding: 0.2rem 0.5rem;
		border-radius: 8px;
		background: var(--card-bg-subtle);
		color: var(--text-muted);
	}

	.game-toggle-chip.active .toggle-status-badge {
		background: var(--accent-color);
		color: white;
	}

	.minigames-pills-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem;
		padding-top: 0.35rem;
		border-top: 1px dashed var(--border-color);
	}

	.minigames-group-lbl {
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-muted);
		margin-right: 0.2rem;
	}

	.game-pill-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.65rem;
		border-radius: 10px;
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		color: var(--text-muted);
		font-family: inherit;
		font-size: 0.76rem;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.12s ease;
	}

	.game-pill-btn.checked {
		background: var(--green-color);
		border-color: var(--green-depth);
		color: white;
	}

	.pill-check {
		font-weight: 900;
		font-size: 0.7rem;
	}

	.active-edit-notice-banner {
		background: rgba(28, 176, 246, 0.12);
		border: 1.5px solid var(--accent-color);
		border-radius: 14px;
		padding: 0.75rem 1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.85rem;
		font-weight: 800;
		color: var(--accent-color);
	}

	.cancel-active-edit-chip {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 0.25rem 0.6rem;
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-color);
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s ease;
	}

	.cancel-active-edit-chip:hover {
		background: var(--red-color, #ff4b4b);
		color: white;
		border-color: var(--red-color, #ff4b4b);
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
		grid-template-columns: 1fr;
		gap: 0.9rem;
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
		gap: 0.35rem;
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

	/* Clone Helper Section */
	.clone-helper-section {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.clone-helper-trigger-btn {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.45rem 0.75rem;
		background: var(--card-bg-subtle);
		border: 1.5px dashed var(--border-color);
		border-radius: 12px;
		color: var(--accent-color);
		font-family: 'Outfit', sans-serif;
		font-size: 0.78rem;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.clone-helper-trigger-btn:hover,
	.clone-helper-trigger-btn.active {
		border-color: var(--accent-color);
		background: var(--accent-light-bg);
	}

	.inline-clone-panel {
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		border-radius: 14px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.clone-filter-row {
		display: flex;
		gap: 0.4rem;
	}

	.clone-search-input {
		flex: 1;
		font-size: 0.8rem;
		padding: 0.35rem 0.6rem;
	}

	.clone-cat-select {
		max-width: 180px;
		font-size: 0.75rem;
		padding: 0.35rem 0.5rem;
	}

	.clone-results-grid {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		max-height: 160px;
		overflow-y: auto;
	}

	.no-clone-results {
		text-align: center;
		padding: 0.75rem;
		font-size: 0.76rem;
		color: var(--text-muted);
	}

	.clone-card-chip {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.4rem 0.6rem;
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		cursor: pointer;
		text-align: left;
		transition: all 0.12s ease;
	}

	.clone-card-chip:hover {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
	}

	.chip-title {
		font-weight: 900;
		font-size: 0.82rem;
		color: var(--text-color);
	}

	.chip-fn {
		font-size: 0.74rem;
		color: var(--text-muted);
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.chip-cat {
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		color: var(--accent-color);
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		padding: 0.05rem 0.3rem;
		border-radius: 4px;
	}

	.chip-action {
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--green-color);
		white-space: nowrap;
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
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.45rem 0.6rem;
		background: var(--card-bg-subtle);
		border-radius: 10px;
	}

	.sug-info {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex: 1;
		min-width: 0;
	}

	.sug-title {
		font-weight: 900;
		font-size: 0.85rem;
		color: var(--text-color);
	}

	.sug-cat {
		font-size: 0.68rem;
		color: var(--accent-color);
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		padding: 0.05rem 0.3rem;
	}

	.sug-actions {
		display: flex;
		gap: 0.3rem;
	}

	.sug-action-btn {
		font-size: 0.72rem;
		font-weight: 800;
		padding: 0.25rem 0.5rem;
		border-radius: 6px;
		border: 1px solid var(--border-color);
		cursor: pointer;
		background: var(--card-bg);
		color: var(--text-color);
		transition: all 0.12s ease;
	}

	.sug-action-btn.clone:hover {
		background: var(--green-color);
		color: white;
		border-color: var(--green-color);
	}

	.sug-action-btn.edit:hover {
		background: var(--accent-color);
		color: white;
		border-color: var(--accent-color);
	}

	.upload-controls-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.file-upload-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0.5rem 0.85rem;
		font-size: 0.8rem;
		border-radius: 12px;
		flex-shrink: 0;
	}

	.hidden-file-input {
		display: none;
	}

	.url-input-group {
		flex: 1;
		display: flex;
		gap: 0.35rem;
		min-width: 220px;
	}

	.images-preview-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.img-preview-item {
		position: relative;
		width: 72px;
		height: 72px;
		border-radius: 12px;
		overflow: hidden;
		border: 1.5px solid var(--border-color);
	}

	.preview-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.remove-img-btn {
		position: absolute;
		top: 3px;
		right: 3px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.65rem;
		font-weight: 900;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.remove-img-btn:hover {
		background: #ff4b4b;
	}

	.form-actions {
		display: flex;
		gap: 0.6rem;
		justify-content: flex-end;
		margin-top: 0.5rem;
		flex-wrap: wrap;
	}

	.clear-draft-btn {
		font-size: 0.82rem;
		padding: 0.6rem 0.85rem;
	}

	.cancel-btn {
		font-size: 0.82rem;
		padding: 0.6rem 0.85rem;
	}

	.save-btn {
		font-size: 0.88rem;
		padding: 0.65rem 1.25rem;
		flex: 1;
		justify-content: center;
	}
</style>
