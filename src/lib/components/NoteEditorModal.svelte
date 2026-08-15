<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { parseMarkdown, getMarkdownStats } from '$lib/utils/markdown';
	import { DEFAULT_NOTE_CATEGORIES, type Note } from '$lib/types/notes';
	import { notesStore } from '$lib/stores/notesStore';

	let {
		isOpen = false,
		initialNote = null,
		onClose = () => {}
	} = $props<{
		isOpen: boolean;
		initialNote?: Note | null;
		onClose: () => void;
	}>();

	let title = $state('');
	let content = $state('');
	let category = $state<string>('Normativa RFI');
	let customCategory = $state('');
	let tagsInput = $state('');
	let isPinned = $state(false);
	let viewMode = $state<'edit' | 'preview' | 'split'>('edit');
	let isSaving = $state(false);
	let textareaEl = $state<HTMLTextAreaElement | null>(null);

	// Aggiorna i campi quando si apre il modal o cambia initialNote
	$effect(() => {
		if (isOpen) {
			if (initialNote) {
				title = initialNote.title;
				content = initialNote.content || '';
				category = initialNote.category || 'Normativa RFI';
				customCategory = '';
				tagsInput = initialNote.tags ? initialNote.tags.join(', ') : '';
				isPinned = Boolean(initialNote.isPinned);
			} else {
				title = '';
				content = '';
				category = 'Normativa RFI';
				customCategory = '';
				tagsInput = '';
				isPinned = false;
			}
			viewMode = window.innerWidth >= 1024 ? 'split' : 'edit';
		}
	});

	let stats = $derived(getMarkdownStats(content));
	let renderedMarkdown = $derived(parseMarkdown(content));

	function insertText(before: string, after = '', defaultPlaceholder = '') {
		if (!textareaEl) return;
		const start = textareaEl.selectionStart;
		const end = textareaEl.selectionEnd;
		const selected = content.substring(start, end) || defaultPlaceholder;
		const replacement = before + selected + after;

		content = content.substring(0, start) + replacement + content.substring(end);

		// Riposiziona il cursore
		setTimeout(() => {
			if (!textareaEl) return;
			textareaEl.focus();
			textareaEl.setSelectionRange(
				start + before.length,
				start + before.length + selected.length
			);
		}, 10);
	}

	function applyTemplate(type: 'concetto' | 'segnale' | 'normativa' | 'checklist') {
		if (content.trim().length > 0) {
			if (!confirm('Vuoi applicare il modello? Il contenuto attuale verrà sostituito.')) {
				return;
			}
		}

		if (type === 'concetto') {
			title = title || 'Definizione & Concetto';
			category = 'Generale & Varie';
			content = `### 📌 Definizione
Spiegazione chiara e sintetica del concetto.

### 🔍 Dettagli Tecnici
- **Ambito di applicazione**: ...
- **Funzione principale**: ...
- **Componenti chiave**: ...

> [!TIP]
> Consiglio per la memorizzazione rapida per l'esame.
`;
		} else if (type === 'segnale') {
			title = title || 'Segnale Luminoso / Tabella';
			category = 'Segnalamento';
			content = `### 🚦 Aspetto del Segnale
- **Colore / Configurazione**: ...
- **Significato**: ...

### 📍 Condizioni di Rispetto
1. Velocità massima consentita: **... km/h**
2. Azione richiesta al macchinista: **...**
3. Distanza di preavviso: **... m**

> [!WARNING]
> Attenzione a non confondere con il segnale simile!
`;
		} else if (type === 'normativa') {
			title = title || 'Prescrizione PGOS / IPCL';
			category = 'Normativa RFI';
			content = `### 📜 Riferimento Normativo
- **Articolo / Modulo**: ...
- **Oggetto**: ...

### ⚙️ Procedura Operativa
1. Prima fase di controllo...
2. Comunicazione M40 / Dispaccio fonico...
3. Verifica condizioni di sicurezza...

| Condizione | Azione Richiesta | Documento |
|---|---|---|
| Normale | Esercizio ordinario | Registro |
| Degrado | Marcia a vista | Dispaccio |
`;
		} else if (type === 'checklist') {
			title = title || 'Checklist di Studio';
			content = `### 🎯 Obiettivi di Ripasso
- [ ] Studiare definizioni e acronimi correlati
- [ ] Ripassare le condizioni di deroga
- [ ] Eseguire 5 quiz su questo argomento
- [ ] Disegnare a memoria lo schema del circuito

> [!IMPORTANT]
> Verificare prima della sessione di verifica finale.
`;
		}
	}

	async function handleSave() {
		if (!title.trim()) {
			alert('Inserisci un titolo per la nota.');
			return;
		}

		isSaving = true;
		const finalCategory = category === 'CUSTOM' ? (customCategory.trim() || 'Varie') : category;
		const tags = tagsInput
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);

		const notePayload = {
			title: title.trim(),
			content,
			category: finalCategory,
			tags,
			isPinned
		};

		if (initialNote && initialNote.id) {
			await notesStore.updateNote({
				...notePayload,
				id: initialNote.id
			});
		} else {
			await notesStore.createNote(notePayload);
		}

		isSaving = false;
		onClose();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 's') {
			e.preventDefault();
			handleSave();
		}
		if (e.key === 'Escape') {
			onClose();
		}
	}
</script>

{#if isOpen}
	<div
		class="modal-backdrop"
		transition:fade={{ duration: 180 }}
		onclick={onClose}
		onkeydown={handleKeyDown}
		role="presentation"
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="editor-card duo-card"
			transition:scale={{ start: 0.94, duration: 220 }}
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-labelledby="editor-title"
			tabindex="-1"
		>
			<!-- Header Modal -->
			<div class="editor-header">
				<div class="header-left">
					<span class="editor-badge">
						<img src="/emoji/clipboard_3d.png" alt="" class="badge-icon" />
						{initialNote ? 'MODIFICA APPUNTO' : 'NUOVO APPUNTO DI STUDIO'}
					</span>
				</div>

				<div class="header-right">
					<button
						type="button"
						class="pin-toggle-btn"
						class:pinned={isPinned}
						onclick={() => (isPinned = !isPinned)}
						title={isPinned ? 'Rimuovi dal fissato in cima' : 'Fissa in cima agli appunti'}
					>
						{isPinned ? '📌 In evidenza' : '📍 Fissa'}
					</button>

					<button type="button" class="close-btn" onclick={onClose} aria-label="Chiudi editor">
						✕
					</button>
				</div>
			</div>

			<!-- Form Inputs -->
			<div class="editor-inputs-row">
				<div class="input-group title-input-group">
					<label for="note-title-input" class="field-label">Titolo Appunto</label>
					<input
						id="note-title-input"
						type="text"
						bind:value={title}
						placeholder="Es. Segnale di Protezione, SCMT, Modulo M40..."
						class="duo-input title-input"
					/>
				</div>

				<div class="input-group category-input-group">
					<label for="note-category-select" class="field-label">Categoria</label>
					<select id="note-category-select" bind:value={category} class="duo-select">
						{#each DEFAULT_NOTE_CATEGORIES as cat}
							<option value={cat}>{cat}</option>
						{/each}
						<option value="CUSTOM">➕ Altra categoria...</option>
					</select>
				</div>
			</div>

			{#if category === 'CUSTOM'}
				<div class="custom-cat-row">
					<input
						type="text"
						bind:value={customCategory}
						placeholder="Scrivi il nome della nuova categoria..."
						class="duo-input"
					/>
				</div>
			{/if}

			<div class="tags-row">
				<label for="note-tags-input" class="field-label">Tag secondari (separati da virgola)</label>
				<input
					id="note-tags-input"
					type="text"
					bind:value={tagsInput}
					placeholder="Es. esame, segnali, velocità, deroga"
					class="duo-input tags-input"
				/>
			</div>

			<!-- Template Selector Bar -->
			<div class="templates-bar">
				<span class="templates-lbl">Modelli rapidi:</span>
				<button type="button" class="template-pill" onclick={() => applyTemplate('concetto')}>
					📌 Concetto
				</button>
				<button type="button" class="template-pill" onclick={() => applyTemplate('segnale')}>
					🚦 Segnale
				</button>
				<button type="button" class="template-pill" onclick={() => applyTemplate('normativa')}>
					📜 Normativa
				</button>
				<button type="button" class="template-pill" onclick={() => applyTemplate('checklist')}>
					✅ Checklist
				</button>
			</div>

			<!-- Markdown Toolbar -->
			<div class="markdown-toolbar">
				<div class="toolbar-tools">
					<button
						type="button"
						class="tool-btn"
						onclick={() => insertText('### ', '', 'Titolo')}
						title="Titolo H3"
					>
						<strong>H3</strong>
					</button>
					<button
						type="button"
						class="tool-btn"
						onclick={() => insertText('**', '**', 'grassetto')}
						title="Grassetto"
					>
						<strong>B</strong>
					</button>
					<button
						type="button"
						class="tool-btn"
						onclick={() => insertText('*', '*', 'corsivo')}
						title="Corsivo"
					>
						<em>I</em>
					</button>
					<button
						type="button"
						class="tool-btn"
						onclick={() => insertText('==', '==', 'evidenziato')}
						title="Evidenzia"
					>
						<mark>H</mark>
					</button>
					<span class="tool-sep"></span>
					<button
						type="button"
						class="tool-btn"
						onclick={() => insertText('- ', '', 'Elemento')}
						title="Elenco puntato"
					>
						• Lista
					</button>
					<button
						type="button"
						class="tool-btn"
						onclick={() => insertText('1. ', '', 'Passo 1')}
						title="Elenco numerato"
					>
						1. Num
					</button>
					<button
						type="button"
						class="tool-btn"
						onclick={() => insertText('- [ ] ', '', 'Attività da completare')}
						title="Checklist di studio"
					>
						☑️ Check
					</button>
					<span class="tool-sep"></span>
					<button
						type="button"
						class="tool-btn"
						onclick={() => insertText('> ', '', 'Citazione')}
						title="Citazione"
					>
						❝ Quota
					</button>
					<button
						type="button"
						class="tool-btn"
						onclick={() => insertText('> [!TIP]\n> ', '', 'Suggerimento per lo studio')}
						title="Callout Suggerimento"
					>
						💡 Tip
					</button>
					<button
						type="button"
						class="tool-btn"
						onclick={() => insertText('> [!WARNING]\n> ', '', 'Attenzione alla deroga')}
						title="Callout Avviso"
					>
						⚠️ Warning
					</button>
					<button
						type="button"
						class="tool-btn"
						onclick={() =>
							insertText(
								'| Argomento | Valore |\n|---|---|\n| ',
								' | Info |',
								'Esempio'
							)}
						title="Tabella Markdown"
					>
						📊 Tabella
					</button>
					<button
						type="button"
						class="tool-btn"
						onclick={() => insertText('\n---\n')}
						title="Separatore orizzontale"
					>
						➖ Linea
					</button>
				</div>

				<!-- View Mode Toggles -->
				<div class="view-toggles">
					<button
						type="button"
						class="mode-toggle-btn"
						class:active={viewMode === 'edit'}
						onclick={() => (viewMode = 'edit')}
					>
						✏️ Modifica
					</button>
					<button
						type="button"
						class="mode-toggle-btn"
						class:active={viewMode === 'preview'}
						onclick={() => (viewMode = 'preview')}
					>
						👁️ Anteprima
					</button>
					<button
						type="button"
						class="mode-toggle-btn desktop-only-mode"
						class:active={viewMode === 'split'}
						onclick={() => (viewMode = 'split')}
					>
						📑 Affiancato
					</button>
				</div>
			</div>

			<!-- Editor & Preview Body Area -->
			<div class="editor-workspace" class:split-layout={viewMode === 'split'}>
				<!-- Textarea Pane -->
				{#if viewMode === 'edit' || viewMode === 'split'}
					<div class="pane edit-pane">
						<textarea
							bind:this={textareaEl}
							bind:value={content}
							placeholder="Scrivi qui i tuoi appunti in Markdown...
Usa **grassetto**, elenchi puntati, - [ ] checklist di studio o tabelle."
							class="duo-textarea"
							onkeydown={handleKeyDown}
						></textarea>
					</div>
				{/if}

				<!-- Preview Pane -->
				{#if viewMode === 'preview' || viewMode === 'split'}
					<div class="pane preview-pane">
						<div class="preview-header">
							<span class="preview-badge">ANTEPRIMA STUDIO</span>
							<span class="preview-stats">{stats.wordCount} parole • ~{stats.readingTimeMinutes} min</span>
						</div>
						<div class="markdown-rendered-box">
							{#if content.trim()}
								{@html renderedMarkdown}
							{:else}
								<div class="empty-preview">
									<p>Nessun contenuto scritto finora. Inizia a digitare per vedere l'anteprima formattata!</p>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Footer Actions -->
			<div class="editor-footer">
				<div class="footer-stats">
					<span class="stat-tag">📝 {stats.wordCount} parole</span>
					<span class="stat-tag">⏱️ {stats.readingTimeMinutes} min lettura</span>
					<span class="stat-tag hint-tag">💡 Ctrl+S per salvare</span>
				</div>

				<div class="footer-btns">
					<button type="button" class="duo-btn duo-btn-gray" onclick={onClose} disabled={isSaving}>
						Annulla
					</button>
					<button
						type="button"
						class="duo-btn duo-btn-green"
						onclick={handleSave}
						disabled={isSaving || !title.trim()}
					>
						{isSaving ? 'Salvataggio...' : '💾 SALVA APPUNTO'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		z-index: 500;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem;
		box-sizing: border-box;
	}

	.editor-card {
		width: 100%;
		max-width: 1000px;
		height: 92vh;
		max-height: 92vh;
		background-color: var(--card-bg);
		border-radius: 20px;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 1.15rem 1.25rem;
		box-sizing: border-box;
		overflow: hidden;
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
	}

	.editor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.45rem;
		border-bottom: 2px solid var(--border-color);
		flex-shrink: 0;
	}

	.editor-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.82rem;
		font-weight: 900;
		color: var(--accent-color);
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.badge-icon {
		width: 22px;
		height: 22px;
		object-fit: contain;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-shrink: 0;
	}

	.pin-toggle-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 10px;
		padding: 0.35rem 0.65rem;
		font-size: 0.78rem;
		font-weight: 800;
		color: var(--text-muted);
		cursor: pointer;
		white-space: nowrap;
	}

	.pin-toggle-btn.pinned {
		background: rgba(255, 150, 0, 0.18);
		border-color: var(--orange-color);
		color: var(--orange-color);
	}

	.close-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 10px;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-color);
		font-size: 1rem;
		cursor: pointer;
		flex-shrink: 0;
	}

	.editor-inputs-row {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	@media (min-width: 640px) {
		.editor-inputs-row {
			display: grid;
			grid-template-columns: 1fr 220px;
		}
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.field-label {
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.duo-input,
	.duo-select {
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-radius: 12px;
		padding: 0.5rem 0.8rem;
		color: var(--text-color);
		font-family: inherit;
		font-size: 0.88rem;
		font-weight: 700;
		outline: none;
		transition: border-color 0.2s ease;
	}

	.duo-input:focus,
	.duo-select:focus {
		border-color: var(--accent-color);
	}

	.title-input {
		font-size: 1rem;
		font-weight: 800;
	}

	.custom-cat-row,
	.tags-row {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		flex-shrink: 0;
	}

	.templates-bar {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		overflow-x: auto;
		padding: 0.15rem 0;
		flex-shrink: 0;
		min-height: 34px;
		scrollbar-width: none;
	}

	.templates-bar::-webkit-scrollbar {
		display: none;
	}

	.templates-lbl {
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.template-pill {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 9999px;
		padding: 0.25rem 0.65rem;
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--text-color);
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s ease;
		flex-shrink: 0;
	}

	.template-pill:hover {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	/* Toolbar */
	.markdown-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 12px;
		padding: 0.4rem 0.6rem;
		overflow-x: auto;
		flex-shrink: 0;
		min-height: 42px;
		scrollbar-width: none;
	}

	.markdown-toolbar::-webkit-scrollbar {
		display: none;
	}

	.toolbar-tools {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.tool-btn {
		background: transparent;
		border: 1px solid transparent;
		border-radius: 8px;
		padding: 0.25rem 0.45rem;
		font-size: 0.76rem;
		font-weight: 800;
		color: var(--text-color);
		cursor: pointer;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.tool-btn:hover {
		background: var(--hover-bg);
		border-color: var(--border-color);
	}

	.tool-sep {
		width: 1px;
		height: 18px;
		background: var(--border-color);
		margin: 0 0.15rem;
		flex-shrink: 0;
	}

	.view-toggles {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		flex-shrink: 0;
	}

	.mode-toggle-btn {
		background: transparent;
		border: 1px solid transparent;
		border-radius: 8px;
		padding: 0.25rem 0.5rem;
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--text-muted);
		cursor: pointer;
		white-space: nowrap;
	}

	.mode-toggle-btn.active {
		background: var(--accent-color);
		color: #ffffff;
	}

	@media (max-width: 1023px) {
		.desktop-only-mode {
			display: none;
		}
	}

	/* Workspace Area */
	.editor-workspace {
		flex: 1 1 auto;
		min-height: 160px;
		display: flex;
		gap: 0.75rem;
		overflow: hidden;
	}

	.split-layout {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}

	.pane {
		height: 100%;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.duo-textarea {
		width: 100%;
		height: 100%;
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-radius: 14px;
		padding: 0.85rem;
		box-sizing: border-box;
		color: var(--text-color);
		font-family: 'Outfit', 'Plus Jakarta Sans', monospace;
		font-size: 0.92rem;
		line-height: 1.5;
		resize: none;
		outline: none;
		transition: border-color 0.2s ease;
	}

	.duo-textarea:focus {
		border-color: var(--accent-color);
	}

	.preview-pane {
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-radius: 14px;
		padding: 0.75rem 0.85rem;
		box-sizing: border-box;
		overflow-y: auto;
	}

	.preview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.4rem;
		margin-bottom: 0.6rem;
		border-bottom: 1.5px solid var(--border-color);
	}

	.preview-badge {
		font-size: 0.68rem;
		font-weight: 900;
		color: var(--accent-color);
		letter-spacing: 0.08em;
	}

	.preview-stats {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--text-muted);
	}

	.markdown-rendered-box {
		line-height: 1.6;
		color: var(--text-color);
		font-size: 0.92rem;
	}

	/* Rendered Markdown Styles */
	:global(.md-heading) {
		font-family: 'Outfit', sans-serif;
		font-weight: 800;
		margin: 0.8rem 0 0.3rem 0;
		color: var(--text-color);
	}

	:global(.md-h1) {
		font-size: 1.45rem;
		border-bottom: 2px solid var(--border-color);
		padding-bottom: 0.2rem;
	}
	:global(.md-h2) {
		font-size: 1.25rem;
		color: var(--accent-color);
	}
	:global(.md-h3) {
		font-size: 1.1rem;
	}
	:global(.md-h4) {
		font-size: 0.98rem;
	}

	:global(.md-paragraph) {
		margin: 0.4rem 0;
	}

	:global(.md-highlight) {
		background: rgba(255, 200, 0, 0.35);
		color: inherit;
		padding: 0.1rem 0.3rem;
		border-radius: 4px;
	}

	:global(.md-inline-code) {
		background: var(--badge-bg);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		padding: 0.1rem 0.35rem;
		font-family: monospace;
		font-size: 0.85em;
		color: var(--accent-color);
	}

	:global(.md-code-box) {
		background: #0f1418;
		border: 1.5px solid var(--border-color);
		border-radius: 12px;
		margin: 0.6rem 0;
		overflow: hidden;
	}

	:global(.md-code-header) {
		background: rgba(255, 255, 255, 0.05);
		padding: 0.25rem 0.6rem;
		border-bottom: 1px solid var(--border-color);
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	:global(.md-code-box pre) {
		padding: 0.75rem;
		margin: 0;
		overflow-x: auto;
		font-family: monospace;
		font-size: 0.85rem;
		color: #38bdf8;
	}

	:global(.md-list, .md-ordered-list, .md-checklist) {
		padding-left: 1.4rem;
		margin: 0.4rem 0;
	}

	:global(.md-checklist) {
		list-style: none;
		padding-left: 0.2rem;
	}

	:global(.md-check-item) {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0.25rem 0;
	}

	:global(.md-check-item.completed .md-check-label) {
		text-decoration: line-through;
		opacity: 0.6;
	}

	:global(.md-check-box) {
		width: 16px;
		height: 16px;
		accent-color: var(--green-color);
	}

	:global(.md-callout) {
		border-radius: 12px;
		padding: 0.65rem 0.85rem;
		margin: 0.6rem 0;
		border-left: 4px solid;
	}

	:global(.md-callout-note) {
		background: rgba(28, 176, 246, 0.12);
		border-left-color: var(--accent-color);
	}

	:global(.md-callout-tip) {
		background: rgba(88, 204, 2, 0.12);
		border-left-color: var(--green-color);
	}

	:global(.md-callout-warning) {
		background: rgba(255, 150, 0, 0.14);
		border-left-color: var(--orange-color);
	}

	:global(.md-callout-important, .md-callout-caution) {
		background: rgba(255, 75, 75, 0.14);
		border-left-color: #ff5e5b;
	}

	:global(.md-callout-title) {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.78rem;
		font-weight: 900;
		text-transform: uppercase;
		margin-bottom: 0.2rem;
	}

	:global(.md-callout-body) {
		font-size: 0.88rem;
	}

	:global(.md-blockquote) {
		border-left: 4px solid var(--text-muted);
		padding-left: 0.75rem;
		margin: 0.5rem 0;
		color: var(--text-muted);
		font-style: italic;
	}

	:global(.md-table-wrapper) {
		overflow-x: auto;
		margin: 0.6rem 0;
	}

	:global(.md-table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}

	:global(.md-table th, .md-table td) {
		border: 1.5px solid var(--border-color);
		padding: 0.4rem 0.65rem;
		text-align: left;
	}

	:global(.md-table th) {
		background: var(--card-bg);
		font-weight: 800;
		color: var(--accent-color);
	}

	:global(.md-hr) {
		border: none;
		border-top: 2px dashed var(--border-color);
		margin: 0.8rem 0;
	}

	:global(.md-link) {
		color: var(--accent-color);
		text-decoration: underline;
		font-weight: 700;
	}

	.empty-preview {
		padding: 2rem 1rem;
		text-align: center;
		color: var(--text-muted);
		font-size: 0.88rem;
	}

	/* Footer */
	.editor-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.85rem;
		padding-top: 0.45rem;
		border-top: 2px solid var(--border-color);
		flex-wrap: wrap;
		flex-shrink: 0;
	}

	.footer-stats {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-muted);
	}

	@media (max-width: 640px) {
		.hint-tag {
			display: none;
		}
	}

	.footer-btns {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>
