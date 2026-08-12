<script lang="ts">
	import { cardsStore } from '$lib/stores/cardsStore';
	import CardForm from '$lib/components/CardForm.svelte';
	import type { Card } from '$lib/types/cards';

	let { isOpen, onClose } = $props<{
		isOpen: boolean;
		onClose: () => void;
		cards?: Card[];
	}>();

	async function handleSaveCard(data: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>) {
		await cardsStore.addCard(data);
		onClose();
	}
</script>

{#if isOpen}
	<div class="modal-backdrop" onclick={onClose} role="presentation">
		<div class="modal-card duo-card" onclick={(e) => e.stopPropagation()} role="presentation">
			<!-- Header -->
			<div class="modal-header">
				<div class="modal-title-group">
					<span class="modal-icon">⚡</span>
					<h2>Aggiunta Scheda</h2>
				</div>
				<button class="close-btn" onclick={onClose} aria-label="Chiudi modal">✕</button>
			</div>

			<!-- Universal Form Component -->
			<div class="modal-body">
				<CardForm onSave={handleSaveCard} onCancel={onClose} submitLabel="⚡ AGGIUNGI ORA SCHEDA" />
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 999;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		box-sizing: border-box;
	}

	.modal-card {
		width: 100%;
		max-width: 650px;
		max-height: 90vh;
		overflow-y: auto;
		background: var(--card-bg);
		border-radius: 24px;
		border: 2px solid var(--border-color);
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
		padding: 1.5rem;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.75rem;
		border-bottom: 2px solid var(--border-color);
	}

	.modal-title-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.modal-icon {
		font-size: 1.4rem;
	}

	.modal-header h2 {
		font-size: 1.25rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.close-btn {
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		color: var(--text-muted);
		width: 32px;
		height: 32px;
		border-radius: 50%;
		cursor: pointer;
		font-size: 1rem;
		font-weight: 900;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}

	.close-btn:hover {
		color: var(--text-color);
		border-color: var(--accent-color);
	}

	.modal-body {
		flex: 1;
	}
</style>
