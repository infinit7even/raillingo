<script lang="ts">
	import { cardsStore } from '$lib/stores/cardsStore';
	import type { Card } from '$lib/types/cards';

	let { isOpen, onClose, cards } = $props<{
		isOpen: boolean;
		onClose: () => void;
		cards: Card[];
	}>();

	let title = $state('');
	let description = $state('');
	let categoryInput = $state('');
	let selectedCategories = $state<string[]>([]);
	let images = $state<string[]>([]);
	let newImageUrl = $state('');
	let saving = $state(false);

	let existingCategories = $derived.by<string[]>(() => {
		const set = new Set<string>();
		for (const c of cards) {
			if (c.category) set.add(c.category);
			if (c.categories) {
				for (const cat of c.categories) {
					if (cat && cat.trim()) set.add(cat.trim());
				}
			}
		}
		return Array.from(set).sort();
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

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!title.trim() || !description.trim()) return;

		// Add any remaining input text in categoryInput
		if (categoryInput.trim()) {
			addCategoryFromInput();
		}

		saving = true;
		try {
			await cardsStore.addCard({
				title: title.trim(),
				description: description.trim(),
				category: selectedCategories.length > 0 ? selectedCategories[0] : undefined,
				categories: selectedCategories.length > 0 ? selectedCategories : undefined,
				images: images.length > 0 ? images : undefined
			});

			resetForm();
			onClose();
		} catch (err) {
			console.error('Errore durante l\'aggiunta rapida della card:', err);
		} finally {
			saving = false;
		}
	}

	function resetForm() {
		title = '';
		description = '';
		categoryInput = '';
		selectedCategories = [];
		images = [];
		newImageUrl = '';
	}
</script>

{#if isOpen}
	<div class="modal-backdrop" onclick={onClose} role="presentation">
		<div class="modal-card duo-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
			<div class="modal-header">
				<h2 class="modal-title">⚡ Aggiungi Scheda Rapida</h2>
				<button class="close-btn" onclick={onClose} aria-label="Chiudi">✕</button>
			</div>

			<form onsubmit={handleSubmit} class="modal-form">
				<div class="form-group">
					<label for="quick-title">Acronimo / Titolo *</label>
					<input
						id="quick-title"
						type="text"
						bind:value={title}
						placeholder="Es: RFI, SCMT, ETCS..."
						required
						class="duo-input"
					/>
				</div>

				<!-- Multi-Category Selection -->
				<div class="form-group">
					<label for="quick-category">Categorie ({selectedCategories.length} selezionate)</label>
					<div class="category-input-row">
						<input
							id="quick-category"
							list="existing-categories-list"
							type="text"
							bind:value={categoryInput}
							placeholder="Scrivi o seleziona categoria e premi Aggiungi..."
							class="duo-input"
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									addCategoryFromInput();
								}
							}}
						/>
						<datalist id="existing-categories-list">
							{#each existingCategories as cat}
								<option value={cat}></option>
							{/each}
						</datalist>
						<button type="button" class="duo-btn duo-btn-purple add-cat-btn" onclick={addCategoryFromInput}>
							+ Categoria
						</button>
					</div>

					<!-- Selected Categories Badges -->
					{#if selectedCategories.length > 0}
						<div class="selected-tags-row">
							{#each selectedCategories as cat}
								<span class="selected-cat-badge duo-badge">
									{cat}
									<button type="button" class="remove-tag-btn" onclick={() => removeCategory(cat)}>✕</button>
								</span>
							{/each}
						</div>
					{/if}

					<!-- Existing Categories Quick Pills -->
					{#if existingCategories.length > 0}
						<div class="existing-pills-row">
							<span class="pills-label">Esistenti:</span>
							{#each existingCategories as cat}
								<button
									type="button"
									class="existing-pill-btn"
									class:active={selectedCategories.includes(cat)}
									onclick={() => toggleCategory(cat)}
								>
									{selectedCategories.includes(cat) ? '✓ ' : '+ '}{cat}
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<div class="form-group">
					<label for="quick-desc">A cosa serve / Descrizione *</label>
					<textarea
						id="quick-desc"
						bind:value={description}
						placeholder="Spiegazione o utilizzo dell'acronimo..."
						rows="3"
						required
						class="duo-input"
					></textarea>
				</div>

				<!-- Image URL Section -->
				<div class="form-group">
					<span class="label-text">Immagini ({images.length})</span>
					<div class="img-input-row">
						<input
							type="url"
							bind:value={newImageUrl}
							placeholder="URL immagine (https://...)"
							class="duo-input"
						/>
						<button type="button" class="duo-btn duo-btn-gray" onclick={addImageUrl}>
							+ Aggiungi
						</button>
					</div>
					{#if images.length > 0}
						<div class="image-preview-row">
							{#each images as img, idx}
								<div class="preview-box">
									<img src={img} alt="Anteprima {idx}" />
									<button type="button" class="del-img-btn" onclick={() => removeImage(idx)}>✕</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div class="modal-actions">
					<button type="button" class="duo-btn duo-btn-gray" onclick={onClose}>
						Annulla
					</button>
					<button type="submit" class="duo-btn duo-btn-green save-btn" disabled={saving}>
						{saving ? 'Salvataggio...' : '⚡ Aggiungi Scheda Ora'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(8px);
		z-index: 500;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.modal-card {
		width: 100%;
		max-width: 520px;
		max-height: 90vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1.5rem;
		background: var(--card-bg);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 2px solid var(--border-color);
		padding-bottom: 0.75rem;
	}

	.modal-title {
		font-size: 1.35rem;
		font-weight: 900;
		color: var(--accent-color);
		margin: 0;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.2rem;
		color: var(--text-muted);
		cursor: pointer;
	}

	.modal-form {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.form-group label, .label-text {
		font-size: 0.8rem;
		font-weight: 800;
		text-transform: uppercase;
		color: var(--text-color);
	}

	.duo-input {
		width: 100%;
		padding: 0.75rem 1rem;
		border-radius: 14px;
		border: 2px solid var(--border-color);
		background: var(--card-bg-subtle);
		color: var(--text-color);
		font-size: 0.95rem;
		font-weight: 700;
	}

	.category-input-row, .img-input-row {
		display: flex;
		gap: 0.5rem;
	}

	.add-cat-btn {
		padding: 0.5rem 0.85rem;
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.selected-tags-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.3rem;
	}

	.selected-cat-badge {
		background: var(--accent-light-bg);
		color: var(--accent-color);
		border-color: var(--accent-color);
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.remove-tag-btn {
		background: none;
		border: none;
		color: var(--accent-color);
		font-weight: 900;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.existing-pills-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		margin-top: 0.4rem;
	}

	.pills-label {
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--text-muted);
	}

	.existing-pill-btn {
		font-size: 0.72rem;
		font-weight: 800;
		padding: 0.2rem 0.5rem;
		border-radius: 8px;
		border: 1.5px solid var(--border-color);
		background: var(--card-bg-subtle);
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.existing-pill-btn.active {
		background: var(--green-color);
		color: white;
		border-color: var(--green-depth);
	}

	.image-preview-row {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		padding: 0.3rem 0;
	}

	.preview-box {
		position: relative;
		width: 70px;
		height: 70px;
		flex-shrink: 0;
	}

	.preview-box img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 10px;
		border: 1px solid var(--border-color);
	}

	.del-img-btn {
		position: absolute;
		top: -4px;
		right: -4px;
		background: var(--pink-color);
		color: white;
		border: none;
		border-radius: 50%;
		width: 20px;
		height: 20px;
		font-size: 0.7rem;
		cursor: pointer;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.65rem;
		margin-top: 0.5rem;
	}

	.save-btn {
		flex: 1;
	}
</style>
