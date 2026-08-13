<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { toastStore } from '$lib/stores/toastStore';
</script>

{#if $toastStore}
	<div
		class="duo-toast-container"
		in:fly={{ y: 20, duration: 250 }}
		out:fade={{ duration: 150 }}
	>
		<div class="duo-toast duo-card">
			<span class="toast-message">{$toastStore.message}</span>
			{#if $toastStore.onAction}
				<button
					type="button"
					class="duo-btn duo-btn-purple toast-action-btn"
					onclick={() => {
						$toastStore?.onAction?.();
						toastStore.dismiss();
					}}
				>
					{$toastStore.actionLabel || 'Annulla'}
				</button>
			{/if}
		</div>
	</div>
{/if}

<style>
	.duo-toast-container {
		position: fixed;
		bottom: 1.25rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 9999;
		width: calc(100% - 2rem);
		max-width: 440px;
		pointer-events: none;
	}

	.duo-toast {
		pointer-events: auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.85rem;
		padding: 0.65rem 0.95rem;
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		border-bottom: 4px solid var(--border-depth-color);
		border-radius: 16px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
	}

	.toast-message {
		font-size: 0.88rem;
		font-weight: 800;
		color: var(--text-color);
	}

	.toast-action-btn {
		padding: 0.35rem 0.75rem;
		font-size: 0.78rem;
		font-weight: 800;
		white-space: nowrap;
	}
</style>
