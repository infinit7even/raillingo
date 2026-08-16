<script lang="ts">
	import { onMount } from 'svelte';
	import { scale, fade } from 'svelte/transition';
	import { confirmModalStore, type ConfirmModalState } from '$lib/stores/confirmModalStore';

	let modalState = $state<ConfirmModalState>({
		isOpen: false,
		title: 'Conferma',
		message: '',
		confirmText: 'Elimina',
		cancelText: 'Annulla',
		confirmVariant: 'danger',
		icon: '🗑️',
		onConfirm: () => {}
	});

	let isProcessing = $state(false);

	onMount(() => {
		const unsub = confirmModalStore.subscribe((val) => {
			modalState = val;
			isProcessing = false;
		});

		function handleKeyDown(e: KeyboardEvent) {
			if (!modalState.isOpen) return;
			if (e.key === 'Escape') {
				handleCancel();
			} else if (e.key === 'Enter' && !isProcessing) {
				handleConfirm();
			}
		}

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			unsub();
			window.removeEventListener('keydown', handleKeyDown);
		};
	});

	function handleCancel() {
		if (isProcessing) return;
		if (modalState.onCancel) {
			modalState.onCancel();
		}
		confirmModalStore.close();
	}

	async function handleConfirm() {
		if (isProcessing) return;
		try {
			isProcessing = true;
			await modalState.onConfirm();
		} finally {
			isProcessing = false;
			confirmModalStore.close();
		}
	}
</script>

{#if modalState.isOpen}
	<div
		class="confirm-backdrop"
		transition:fade={{ duration: 150 }}
		onclick={handleCancel}
		role="presentation"
	></div>

	<div
		class="confirm-modal-wrapper"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-title"
	>
		<div class="confirm-modal duo-card" transition:scale={{ start: 0.92, duration: 160 }}>
			<!-- Icon Header -->
			<div class="confirm-icon-box" class:danger={modalState.confirmVariant === 'danger'}>
				<span class="confirm-icon">{modalState.icon || '🗑️'}</span>
			</div>

			<!-- Texts -->
			<div class="confirm-content">
				<h3 id="confirm-title" class="confirm-title">{modalState.title}</h3>
				<p class="confirm-message">{modalState.message}</p>
			</div>

			<!-- Actions -->
			<div class="confirm-actions">
				<button
					type="button"
					class="duo-btn duo-btn-gray cancel-btn"
					onclick={handleCancel}
					disabled={isProcessing}
				>
					{modalState.cancelText || 'Annulla'}
				</button>

				<button
					type="button"
					class="duo-btn confirm-btn"
					class:duo-btn-red={modalState.confirmVariant === 'danger'}
					class:duo-btn-blue={modalState.confirmVariant === 'primary'}
					onclick={handleConfirm}
					disabled={isProcessing}
				>
					{#if isProcessing}
						<span class="loading-spin">⏳</span> Elaborazione...
					{:else}
						{modalState.confirmText || 'Conferma'}
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.confirm-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(5px);
		-webkit-backdrop-filter: blur(5px);
		z-index: 999998;
	}

	.confirm-modal-wrapper {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 999999;
		padding: 1.2rem;
		box-sizing: border-box;
		pointer-events: none;
	}

	.confirm-modal {
		pointer-events: auto;
		width: 100%;
		max-width: 400px;
		background: var(--card-bg);
		border-radius: 24px;
		border: 2px solid var(--border-color);
		border-bottom: 6px solid var(--border-depth-color);
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
		padding: 1.5rem 1.4rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 1.1rem;
		box-sizing: border-box;
	}

	.confirm-icon-box {
		width: 64px;
		height: 64px;
		border-radius: 20px;
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
	}

	.confirm-icon-box.danger {
		background: rgba(255, 75, 75, 0.14);
		border-color: rgba(255, 75, 75, 0.35);
	}

	.confirm-content {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.confirm-title {
		font-family: 'Outfit', sans-serif;
		font-size: 1.22rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.confirm-message {
		font-size: 0.88rem;
		font-weight: 600;
		color: var(--text-muted);
		line-height: 1.45;
		margin: 0;
	}

	.confirm-actions {
		display: flex;
		gap: 0.65rem;
		width: 100%;
		margin-top: 0.2rem;
	}

	.cancel-btn {
		flex: 1;
		padding: 0.7rem 0.5rem;
		font-size: 0.86rem;
		font-weight: 800;
		border-radius: 12px;
	}

	.confirm-btn {
		flex: 1.3;
		padding: 0.7rem 0.5rem;
		font-size: 0.86rem;
		font-weight: 900;
		border-radius: 12px;
	}

	.loading-spin {
		display: inline-block;
		animation: spin 1s infinite linear;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
</style>
