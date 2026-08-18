<script lang="ts">
	import { fly, fade } from "svelte/transition";
	import { toastStore } from "$lib/stores/toastStore";

	function getToastIcon(type?: string, customIcon?: string): string {
		if (customIcon) return customIcon;
		switch (type) {
			case "warning":
				return "⚠️";
			case "error":
				return "❌";
			case "success":
				return "✅";
			default:
				return "🎨";
		}
	}
</script>

{#if $toastStore}
	<div
		class="duo-toast-container"
		in:fly={{ y: 20, duration: 220 }}
		out:fade={{ duration: 150 }}
	>
		<div
			class="duo-toast duo-card"
			class:is-warning={$toastStore.type === "warning"}
			class:is-error={$toastStore.type === "error"}
			class:is-success={$toastStore.type === "success"}
			class:is-info={$toastStore.type === "info" || !$toastStore.type}
			role="alert"
			aria-live="polite"
		>
			<div class="toast-left-group">
				<span class="toast-icon">{getToastIcon($toastStore.type, $toastStore.icon)}</span>
				<span class="toast-message">{$toastStore.message}</span>
			</div>

			<div class="toast-right-group">
				<button
					type="button"
					class="toast-close-btn"
					onclick={() => toastStore.dismiss()}
					aria-label="Chiudi notifica"
					title="Chiudi"
				>
					✕
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.duo-toast-container {
		position: fixed;
		bottom: calc(1.25rem + var(--safe-area-bottom, 0px));
		left: 50%;
		transform: translateX(-50%);
		z-index: 9999;
		width: calc(100% - 2rem);
		max-width: 400px;
		pointer-events: none;
	}

	.duo-toast {
		pointer-events: auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.85rem;
		padding: 0.75rem 1rem;
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		border-bottom: 4px solid var(--border-depth-color);
		border-radius: 18px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
		transition: all 0.2s ease;
	}

	.toast-left-group {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex: 1;
		min-width: 0;
	}

	.toast-icon {
		font-size: 1.15rem;
		line-height: 1;
		flex-shrink: 0;
	}

	.toast-message {
		font-family: "Outfit", sans-serif;
		font-size: 0.88rem;
		font-weight: 800;
		color: var(--text-color);
		line-height: 1.25;
		word-break: break-word;
	}

	.toast-right-group {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-shrink: 0;
	}

	.toast-close-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		font-size: 0.9rem;
		font-weight: 800;
		padding: 0.25rem 0.4rem;
		border-radius: 8px;
		cursor: pointer;
		line-height: 1;
		transition: all 0.15s ease;
	}

	.toast-close-btn:hover {
		color: var(--text-color);
		background: var(--hover-bg);
	}
</style>
