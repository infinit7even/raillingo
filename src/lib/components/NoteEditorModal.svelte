<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { parseMarkdown } from '$lib/utils/markdown';
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
	let isPinned = $state(false);
	let isPreview = $state(false);
	let isSaving = $state(false);
	let textareaEl = $state<HTMLTextAreaElement | null>(null);

	$effect(() => {
		if (isOpen) {
			if (initialNote) {
				title = initialNote.title;
				content = initialNote.content || '';
				category = initialNote.category || 'Normativa RFI';
				customCategory = '';
				isPinned = Boolean(initialNote.isPinned);
			} else {
				title = '';
				content = '';
				category = 'Normativa RFI';
				customCategory = '';
				isPinned = false;
			}
			isPreview = false;
		}
	});

	let renderedMarkdown = $derived(parseMarkdown(content));

	function insertFormatting(prefix: string, suffix = '', placeholder = '') {
		if (!textareaEl) return;
		const start = textareaEl.selectionStart;
		const end = textareaEl.selectionEnd;
		const selected = content.substring(start, end) || placeholder;
		const replacement = prefix + selected + suffix;

		content = content.substring(0, start) + replacement + content.substring(end);

		setTimeout(() => {
			if (!textareaEl) return;
			textareaEl.focus();
			textareaEl.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
		}, 10);
	}

	async function handleSave() {
		if (!title.trim()) {
			alert('Inserisci un titolo per il tuo appunto.');
			return;
		}

		isSaving = true;
		const finalCategory = category === 'CUSTOM' ? customCategory.trim() || 'Varie' : category;

		const notePayload = {
			title: title.trim(),
			content,
			category: finalCategory,
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
		transition:fade={{ duration: 160 }}
		onclick={onClose}
		onkeydown={handleKeyDown}
		role="presentation"
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="simple-editor-card duo-card"
			transition:scale={{ start: 0.95, duration: 180 }}
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<!-- Top Header -->
			<div class="simple-header">
				<div class="header-title-box">
					<span class="editor-icon">📝</span>
					<span class="editor-heading">{initialNote ? 'Modifica Appunto' : 'Nuovo Appunto'}</span>
				</div>

				<div class="header-actions">
					<button
						type="button"
						class="pin-btn"
						class:active={isPinned}
						onclick={() => (isPinned = !isPinned)}
						title={isPinned ? 'Rimuovi dal fissato in alto' : 'Fissa in alto'}
					>
						📌 {isPinned ? 'Fissato' : 'Fissa'}
					</button>

					<button type="button" class="close-btn" onclick={onClose} aria-label="Chiudi">✕</button>
				</div>
			</div>

			<!-- Title & Category Row -->
			<div class="title-category-row">
				<input
					type="text"
					bind:value={title}
					placeholder="Titolo dell'appunto..."
					class="main-title-input"
				/>

				<div class="category-selector-box">
					<select bind:value={category} class="category-select">
						{#each DEFAULT_NOTE_CATEGORIES as cat}
							<option value={cat}>{cat}</option>
						{/each}
						<option value="CUSTOM">➕ Altra categoria...</option>
					</select>
				</div>
			</div>

			{#if category === 'CUSTOM'}
				<div class="custom-category-row">
					<input
						type="text"
						bind:value={customCategory}
						placeholder="Nome nuova categoria..."
						class="custom-cat-input"
					/>
				</div>
			{/if}

			<!-- Minimal Toolbar -->
			<div class="simple-toolbar">
				<div class="format-buttons">
					<button
						type="button"
						class="tool-btn"
						onclick={() => insertFormatting('**', '**', 'grassetto')}
						title="Grassetto"
					>
						<strong>B</strong>
					</button>
					<button
						type="button"
						class="tool-btn"
						onclick={() => insertFormatting('*', '*', 'corsivo')}
						title="Corsivo"
					>
						<em>I</em>
					</button>
					<button
						type="button"
						class="tool-btn"
						onclick={() => insertFormatting('### ', '', 'Intestazione')}
						title="Titolo sezione"
					>
						<strong>H</strong>
					</button>
					<button
						type="button"
						class="tool-btn"
						onclick={() => insertFormatting('- ', '', 'Punto')}
						title="Elenco puntato"
					>
						• Lista
					</button>
					<button
						type="button"
						class="tool-btn"
						onclick={() => insertFormatting('- [ ] ', '', 'Attività')}
						title="Checklist"
					>
						☑️ Check
					</button>
				</div>

				<!-- Toggle Anteprima / Scrittura -->
				<button
					type="button"
					class="preview-toggle-btn"
					class:active={isPreview}
					onclick={() => (isPreview = !isPreview)}
				>
					{isPreview ? '✏️ Torna al Testo' : '👁️ Anteprima'}
				</button>
			</div>

			<!-- Main Writing / Preview Area -->
			<div class="writing-container">
				{#if isPreview}
					<div class="preview-area markdown-rendered-box">
						{#if content.trim()}
							{@html renderedMarkdown}
						{:else}
							<p class="empty-hint">Nessun testo inserito. Torna alla scrittura per aggiungere appunti!</p>
						{/if}
					</div>
				{:else}
					<textarea
						bind:this={textareaEl}
						bind:value={content}
						placeholder="Scrivi qui i tuoi appunti...
Usa **grassetto**, elenchi puntati o checklist `- [ ]` per memorizzare i concetti."
						class="simple-textarea"
						onkeydown={handleKeyDown}
					></textarea>
				{/if}
			</div>

			<!-- Bottom Actions -->
			<div class="simple-footer">
				<button type="button" class="duo-btn duo-btn-gray cancel-btn" onclick={onClose}>
					Annulla
				</button>
				<button
					type="button"
					class="duo-btn duo-btn-green save-btn"
					onclick={handleSave}
					disabled={isSaving || !title.trim()}
				>
					{isSaving ? 'Salvataggio...' : '💾 SALVA'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(5px);
		-webkit-backdrop-filter: blur(5px);
		z-index: 500;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem;
		box-sizing: border-box;
	}

	.simple-editor-card {
		width: 100%;
		max-width: 680px;
		height: 85vh;
		max-height: 700px;
		background-color: var(--card-bg);
		border-radius: 20px;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 1.15rem;
		box-sizing: border-box;
		overflow: hidden;
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
	}

	.simple-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.4rem;
		border-bottom: 2px solid var(--border-color);
		flex-shrink: 0;
	}

	.header-title-box {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.editor-icon {
		font-size: 1.1rem;
	}

	.editor-heading {
		font-family: 'Outfit', sans-serif;
		font-size: 1rem;
		font-weight: 800;
		color: var(--text-color);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.pin-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 10px;
		padding: 0.3rem 0.6rem;
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.pin-btn.active {
		background: rgba(255, 150, 0, 0.18);
		border-color: var(--orange-color);
		color: var(--orange-color);
	}

	.close-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 10px;
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-color);
		font-size: 0.9rem;
		cursor: pointer;
	}

	/* Title & Category Row */
	.title-category-row {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	@media (min-width: 540px) {
		.title-category-row {
			display: grid;
			grid-template-columns: 1fr 180px;
		}
	}

	.main-title-input {
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-radius: 12px;
		padding: 0.6rem 0.85rem;
		color: var(--text-color);
		font-family: 'Outfit', sans-serif;
		font-size: 1.05rem;
		font-weight: 800;
		outline: none;
		transition: border-color 0.2s ease;
	}

	.main-title-input:focus {
		border-color: var(--accent-color);
	}

	.category-select {
		width: 100%;
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-radius: 12px;
		padding: 0.6rem 0.75rem;
		color: var(--text-color);
		font-family: inherit;
		font-size: 0.82rem;
		font-weight: 800;
		outline: none;
		cursor: pointer;
	}

	.category-select:focus {
		border-color: var(--accent-color);
	}

	.custom-category-row {
		flex-shrink: 0;
	}

	.custom-cat-input {
		width: 100%;
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-radius: 12px;
		padding: 0.5rem 0.8rem;
		color: var(--text-color);
		font-size: 0.85rem;
		font-weight: 700;
		outline: none;
	}

	/* Toolbar */
	.simple-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 12px;
		padding: 0.3rem 0.5rem;
		flex-shrink: 0;
	}

	.format-buttons {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.tool-btn {
		background: transparent;
		border: 1px solid transparent;
		border-radius: 8px;
		padding: 0.25rem 0.5rem;
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--text-color);
		cursor: pointer;
	}

	.tool-btn:hover {
		background: var(--hover-bg);
		border-color: var(--border-color);
	}

	.preview-toggle-btn {
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		border-radius: 8px;
		padding: 0.25rem 0.6rem;
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.preview-toggle-btn.active {
		background: var(--accent-color);
		border-color: var(--accent-depth);
		color: #ffffff;
	}

	/* Writing & Preview Area */
	.writing-container {
		flex: 1;
		min-height: 140px;
		display: flex;
		overflow: hidden;
	}

	.simple-textarea {
		width: 100%;
		height: 100%;
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-radius: 14px;
		padding: 0.85rem;
		box-sizing: border-box;
		color: var(--text-color);
		font-family: inherit;
		font-size: 0.95rem;
		line-height: 1.55;
		resize: none;
		outline: none;
		transition: border-color 0.2s ease;
	}

	.simple-textarea:focus {
		border-color: var(--accent-color);
	}

	.preview-area {
		width: 100%;
		height: 100%;
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-radius: 14px;
		padding: 0.85rem 1rem;
		box-sizing: border-box;
		overflow-y: auto;
		font-size: 0.95rem;
		line-height: 1.6;
	}

	.empty-hint {
		color: var(--text-muted);
		font-style: italic;
		text-align: center;
		padding: 2rem 0;
	}

	/* Footer */
	.simple-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
		padding-top: 0.35rem;
		border-top: 2px solid var(--border-color);
		flex-shrink: 0;
	}

	.cancel-btn {
		font-size: 0.85rem;
		padding: 0.65rem 1rem;
	}

	.save-btn {
		font-size: 0.88rem;
		padding: 0.65rem 1.3rem;
	}
</style>
