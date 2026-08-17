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
	let isTitleFocused = $state(false);
	let activeEditCard = $state<Card | null>(null);

	let hasImages = $derived(images.length > 0);

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

	// Existing cards for suggestions
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
		if (effectiveEditCard?.id) return;
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
				(!effectiveEditCard || c.id !== effectiveEditCard.id) &&
				(c.title.toLowerCase().includes(q) ||
					(c.acronym && c.acronym.toLowerCase().includes(q)) ||
					(c.fullName && c.fullName.toLowerCase().includes(q)))
		).slice(0, 4);
	});

	function handleSelectExisting(card: Card) {
		if (onSelectExistingCard) {
			onSelectExistingCard(card);
		} else {
			activeEditCard = card;
			title = card.title;
			hasAcronym = Boolean(card.hasAcronym || (card.fullName && card.fullName !== card.title));
			acronym = card.acronym || '';
			fullName = card.fullName || '';
			description = card.description;
			category = card.category || '';
			customCategory = '';
			images = card.images ? [...card.images] : [];
			showInWiki = card.showInWiki !== false;
			gameModes = Array.isArray(card.gameModes) && card.gameModes.length > 0
				? [...card.gameModes]
				: ['flashcard', 'quiz', 'reels', 'scrittura'];
			toastStore.show({ message: `✏️ Modifica scheda "${card.title}"` });
		}
	}

	function cancelActiveEdit() {
		activeEditCard = null;
		if (onCancel) {
			onCancel();
		} else {
			clearDraft();
		}
	}

	function toggleGameMode(mode: string) {
		if (mode === 'reels' && !hasImages) {
			toastStore.show({ message: "📷 Reels richiede almeno un'immagine allegata.", type: 'warning' });
			return;
		}

		if (gameModes.includes(mode)) {
			gameModes = gameModes.filter((m) => m !== mode);
		} else {
			gameModes = [...gameModes, mode];
		}
		saveDraft();
	}

	async function handleFileUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) return;

		const file = target.files[0];
		uploading = true;
		validationError = null;

		try {
			const res = await uploadImage(file, { context: 'card' });
			if (res && res.url) {
				images = [...images, res.url];
				if (!gameModes.includes('reels')) {
					gameModes = [...gameModes, 'reels'];
				}
				saveDraft();
				toastStore.show({ message: '📷 Immagine caricata con successo!' });
			}
		} catch (err: any) {
			validationError = err.message || 'Errore durante il caricamento del file.';
		} finally {
			uploading = false;
			target.value = '';
		}
	}

	function addImageUrl() {
		const clean = newImageUrl.trim();
		if (!clean) return;

		if (!clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('/')) {
			validationError = "L'URL deve iniziare con http://, https:// o /uploads/";
			return;
		}

		images = [...images, clean];
		if (!gameModes.includes('reels')) {
			gameModes = [...gameModes, 'reels'];
		}
		newImageUrl = '';
		saveDraft();
	}

	function removeImage(index: number) {
		images = images.filter((_, i) => i !== index);
		if (images.length === 0) {
			gameModes = gameModes.filter((m) => m !== 'reels');
		}
		saveDraft();
	}

	async function handlePaste(e: ClipboardEvent) {
		if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
			e.preventDefault();
			const file = e.clipboardData.files[0];
			if (file.type.startsWith('image/')) {
				uploading = true;
				try {
					const res = await uploadImage(file, { context: 'card' });
					if (res && res.url) {
						images = [...images, res.url];
						if (!gameModes.includes('reels')) {
							gameModes = [...gameModes, 'reels'];
						}
						saveDraft();
						toastStore.show({ message: '📷 Immagine incollata caricata con successo!' });
					}
				} catch (err: any) {
					validationError = err.message || 'Errore caricamento immagine incollata.';
				} finally {
					uploading = false;
				}
			}
		}
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			const file = e.dataTransfer.files[0];
			if (file.type.startsWith('image/')) {
				uploading = true;
				try {
					const res = await uploadImage(file, { context: 'card' });
					if (res && res.url) {
						images = [...images, res.url];
						if (!gameModes.includes('reels')) {
							gameModes = [...gameModes, 'reels'];
						}
						saveDraft();
						toastStore.show({ message: '📷 Immagine trascinata caricata con successo!' });
					}
				} catch (err: any) {
					validationError = err.message || 'Errore caricamento immagine trascinata.';
				} finally {
					uploading = false;
				}
			}
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		validationError = null;

		const cleanTitle = title.trim();
		const cleanFullName = fullName.trim();
		const cleanAcronym = acronym.trim();
		const finalCategory = (category === '__NEW__' ? customCategory : category).trim();
		const cleanDesc = description.trim();

		if (!cleanTitle) {
			validationError = 'Il campo Titolo è obbligatorio.';
			return;
		}

		if (!finalCategory) {
			validationError = 'Seleziona o specifica una Categoria valida.';
			return;
		}

		// Se reels è abilitato ma non ci sono immagini, avvisa e disabilita reels
		let finalGameModes = [...gameModes];
		if (images.length === 0 && finalGameModes.includes('reels')) {
			finalGameModes = finalGameModes.filter((m) => m !== 'reels');
		}

		saving = true;

		try {
			const payload: { id?: string } & Omit<Card, 'createdAt' | 'updatedAt'> = {
				id: effectiveEditCard?.id || undefined,
				title: cleanTitle,
				hasAcronym,
				acronym: hasAcronym ? cleanAcronym : undefined,
				fullName: cleanFullName || undefined,
				description: cleanDesc,
				category: finalCategory,
				images: images,
				tags: effectiveEditCard?.tags || [],
				showInWiki: showInWiki,
				gameModes: finalGameModes
			};

			await onSave(payload);

			if (!effectiveEditCard?.id) {
				clearDraft();
			}
		} catch (err: any) {
			validationError = err.message || 'Errore durante il salvataggio della scheda.';
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
				<span class="checkbox-label-text">Questa voce include una Sigla / Acronimo</span>
			</label>

			{#if hasAcronym}
				<div class="acronym-subfields-grid">
					<div class="form-group">
						<label for="card-acronym-field">Sigla / Acronimo (es: SCMT, RFI, PL)</label>
						<input
							id="card-acronym-field"
							type="text"
							bind:value={acronym}
							oninput={saveDraft}
							placeholder="es: SCMT"
							class="duo-input"
						/>
					</div>

					<div class="form-group">
						<label for="card-fullname-field">Significato Esteso (Opzionale)</label>
						<input
							id="card-fullname-field"
							type="text"
							bind:value={fullName}
							oninput={saveDraft}
							placeholder="es: Sistema Controllo Marcia Treno"
							class="duo-input"
						/>
					</div>
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
					<span class="minigames-group-lbl">Mini-giochi abilitati:</span>

					<!-- Flashcard Standard -->
					<button
						type="button"
						class="game-pill-btn"
						class:checked={gameModes.includes('flashcard')}
						onclick={() => toggleGameMode('flashcard')}
						title="Include la scheda nelle sessioni Flashcard"
					>
						<span>📖 Flashcard</span>
						<span class="pill-check">{gameModes.includes('flashcard') ? '✓' : '✕'}</span>
					</button>

					<!-- Quiz -->
					<button
						type="button"
						class="game-pill-btn"
						class:checked={gameModes.includes('quiz')}
						onclick={() => toggleGameMode('quiz')}
						title="Include la scheda nei Quiz a scelta multipla"
					>
						<span>⭐ Quiz</span>
						<span class="pill-check">{gameModes.includes('quiz') ? '✓' : '✕'}</span>
					</button>

					<!-- Reels (Richiede Immagine) -->
					<button
						type="button"
						class="game-pill-btn"
						class:checked={hasImages && gameModes.includes('reels')}
						class:disabled={!hasImages}
						onclick={() => toggleGameMode('reels')}
						title={!hasImages ? "Reels richiede almeno un'immagine allegata" : "Feed verticale Reels"}
					>
						<span>📷 Reels {!hasImages ? '(Richiede Foto)' : ''}</span>
						<span class="pill-check">{hasImages && gameModes.includes('reels') ? '✓' : (!hasImages ? '🚫' : '✕')}</span>
					</button>

					<!-- Scrittura -->
					<button
						type="button"
						class="game-pill-btn"
						class:checked={gameModes.includes('scrittura')}
						onclick={() => toggleGameMode('scrittura')}
						title="Include nella digitazione / ripasso libero"
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
		cursor: pointer;
		accent-color: var(--accent-color);
	}

	.checkbox-label-text {
		font-size: 0.88rem;
		font-weight: 800;
		color: var(--text-color);
	}

	.acronym-subfields-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin-top: 0.25rem;
	}

	@media (max-width: 600px) {
		.acronym-subfields-grid {
			grid-template-columns: 1fr;
		}
	}

	.form-grid {
		display: flex;
		flex-direction: column;
		gap: 0.95rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.relative {
		position: relative;
	}

	.form-group label {
		font-size: 0.82rem;
		font-weight: 800;
		color: var(--text-color);
		letter-spacing: 0.02em;
	}

	.form-textarea {
		resize: vertical;
		min-height: 80px;
		font-family: inherit;
		line-height: 1.5;
	}

	.category-input-row {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.select-category {
		cursor: pointer;
	}

	.visibility-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.85rem;
		background: var(--card-bg-subtle);
		border-radius: 16px;
	}

	.visibility-section-title {
		font-size: 0.82rem;
		font-weight: 900;
		color: var(--text-color);
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}

	.visibility-toggles-grid {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.game-toggle-chip {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.65rem 0.85rem;
		background: var(--card-bg);
		border: 2px solid var(--border-color);
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
		font-size: 1.3rem;
	}

	.toggle-text {
		display: flex;
		flex-direction: column;
		flex: 1;
		gap: 0.15rem;
	}

	.toggle-text strong {
		font-size: 0.85rem;
		color: var(--text-color);
	}

	.toggle-sub {
		font-size: 0.72rem;
		color: var(--text-muted);
		font-weight: 600;
	}

	.toggle-status-badge {
		font-size: 0.72rem;
		font-weight: 900;
		padding: 0.2rem 0.5rem;
		border-radius: 8px;
		background: var(--card-bg-subtle);
		color: var(--text-muted);
	}

	.game-toggle-chip.active .toggle-status-badge {
		background: var(--accent-color);
		color: #ffffff;
	}

	.minigames-pills-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.minigames-group-lbl {
		font-size: 0.78rem;
		font-weight: 800;
		color: var(--text-muted);
		width: 100%;
		margin-bottom: 0.15rem;
	}

	.game-pill-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.75rem;
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		border-radius: 10px;
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.game-pill-btn:hover:not(:disabled) {
		border-color: var(--accent-color);
		color: var(--text-color);
	}

	.game-pill-btn.checked {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.game-pill-btn.disabled,
	.game-pill-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
		border-color: var(--border-color);
	}

	.pill-check {
		font-size: 0.75rem;
		font-weight: 900;
	}

	.upload-controls-row {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	@media (min-width: 600px) {
		.upload-controls-row {
			flex-direction: row;
			align-items: center;
		}
	}

	.file-upload-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		position: relative;
		overflow: hidden;
		padding: 0.65rem 1rem;
		font-size: 0.85rem;
		white-space: nowrap;
	}

	.hidden-file-input {
		position: absolute;
		top: 0;
		left: 0;
		opacity: 0;
		width: 100%;
		height: 100%;
		cursor: pointer;
	}

	.url-input-group {
		display: flex;
		gap: 0.45rem;
		flex: 1;
	}

	.images-preview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(85px, 1fr));
		gap: 0.65rem;
		margin-top: 0.65rem;
	}

	.img-preview-item {
		position: relative;
		aspect-ratio: 1;
		border-radius: 12px;
		overflow: hidden;
		padding: 0;
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
		background: rgba(0, 0, 0, 0.75);
		color: white;
		border: none;
		border-radius: 50%;
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		font-weight: 900;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.remove-img-btn:hover {
		background: #ff4b4b;
	}

	.suggestions-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 50;
		background: var(--card-bg);
		margin-top: 0.35rem;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
	}

	.suggestion-header {
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--text-muted);
		padding: 0.2rem 0.4rem;
	}

	.suggestion-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.6rem;
		background: var(--card-bg-subtle);
		border-radius: 8px;
	}

	.sug-info {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.sug-title {
		font-size: 0.85rem;
		font-weight: 800;
		color: var(--text-color);
	}

	.sug-cat {
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.sug-actions {
		display: flex;
		gap: 0.3rem;
		flex-shrink: 0;
	}

	.sug-action-btn {
		padding: 0.25rem 0.5rem;
		font-size: 0.72rem;
		font-weight: 800;
		border-radius: 6px;
		border: 1px solid var(--border-color);
		background: var(--card-bg);
		color: var(--text-color);
		cursor: pointer;
	}

	.sug-action-btn.edit {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.active-edit-notice-banner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: rgba(28, 176, 246, 0.12);
		border: 1.5px solid var(--accent-color);
		border-radius: 12px;
		font-size: 0.85rem;
		color: var(--text-color);
	}

	.cancel-active-edit-chip {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		color: var(--text-color);
		font-size: 0.75rem;
		font-weight: 800;
		padding: 0.3rem 0.6rem;
		border-radius: 8px;
		cursor: pointer;
		white-space: nowrap;
	}

	.form-actions {
		display: flex;
		gap: 0.65rem;
		align-items: center;
		margin-top: 0.5rem;
	}

	.clear-draft-btn {
		font-size: 0.8rem;
		padding: 0.65rem 0.85rem;
		white-space: nowrap;
	}

	.cancel-btn {
		font-size: 0.85rem;
		padding: 0.65rem 1rem;
	}

	.save-btn {
		flex: 1;
		font-size: 0.9rem;
		padding: 0.75rem 1.25rem;
	}

	.validation-error-box {
		background: rgba(255, 75, 75, 0.15);
		border: 2px solid #ff4b4b;
		color: #ff4b4b;
		padding: 0.75rem 1rem;
		font-size: 0.85rem;
		font-weight: 800;
		border-radius: 12px;
	}
</style>
