<script lang="ts">
	import { themeStore, THEME_OPTIONS, type ThemePreset, type ThemeOption } from '$lib/stores/themeStore';

	let { isOpen, onClose } = $props<{
		isOpen: boolean;
		onClose: () => void;
	}>();

	let currentTheme = $state<ThemePreset>('dark');

	$effect(() => {
		const unsubscribe = themeStore.subscribe((t) => (currentTheme = t));
		return unsubscribe;
	});

	function selectTheme(opt: ThemeOption) {
		themeStore.setTheme(opt.id);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && isOpen) {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<div
		class="modal-backdrop"
		onclick={onClose}
		onkeydown={(e) => (e.key === 'Enter' || e.key === 'Escape') && onClose()}
		role="button"
		tabindex="0"
	>
		<div
			class="modal-card"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<!-- Modal Header -->
			<div class="modal-header">
				<div>
					<span class="badge">Personalizzazione Visuale</span>
					<h2 class="modal-title">🎨 Seleziona Tema del Sito</h2>
				</div>
				<button class="close-btn" onclick={onClose} aria-label="Chiudi modal">✕</button>
			</div>

			<!-- Theme Preview Cards Grid -->
			<div class="themes-grid">
				{#each THEME_OPTIONS as opt}
					{@const isSelected = currentTheme === opt.id}

					<button
						class="theme-card-option"
						class:selected={isSelected}
						onclick={() => selectTheme(opt)}
					>
						<!-- Mini Preview Box -->
						<div
							class="preview-box"
							style="background: {opt.bg}; border-color: {opt.color}"
						>
							<div class="mini-header" style="border-color: rgba(255,255,255,0.1)">
								<span class="mini-logo" style="background: {opt.color}"></span>
								<span class="mini-line" style="background: {opt.color}"></span>
							</div>
							<div class="mini-card" style="background: {opt.cardBg}">
								<span class="mini-title" style="color: {opt.color}">RF</span>
								<span class="mini-text" style="background: rgba(255,255,255,0.2)"></span>
							</div>
						</div>

						<!-- Details -->
						<div class="theme-info">
							<div class="theme-name-row">
								<span class="theme-name">{opt.name}</span>
								{#if isSelected}
									<span class="active-badge" style="background: {opt.color}">Attivo ✓</span>
								{/if}
							</div>
							<p class="theme-desc">{opt.desc}</p>
						</div>
					</button>
				{/each}
			</div>

			<!-- Footer -->
			<div class="modal-footer">
				<button class="confirm-btn" onclick={onClose}>
					Conferma & Applica
				</button>
			</div>
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
		z-index: 200;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		animation: fadeIn 0.2s ease;
	}

	.modal-card {
		width: 100%;
		max-width: 620px;
		max-height: 85vh;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 28px;
		padding: 1.75rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		box-shadow: 0 20px 50px var(--shadow-color);
		overflow-y: auto;
		animation: scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.badge {
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		color: var(--accent-color);
		background: var(--accent-light-bg);
		padding: 0.25rem 0.65rem;
		border-radius: 8px;
	}

	.modal-title {
		font-size: 1.6rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0.35rem 0 0 0;
	}

	.close-btn {
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		color: var(--text-muted);
		width: 36px;
		height: 36px;
		border-radius: 50%;
		font-size: 1.1rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.close-btn:hover {
		color: var(--text-color);
		border-color: var(--accent-color);
	}

	.themes-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1rem;
	}

	.theme-card-option {
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-radius: 20px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		cursor: pointer;
		text-align: left;
		transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.theme-card-option:hover {
		border-color: var(--accent-color);
		transform: translateY(-2px);
	}

	.theme-card-option.selected {
		border-color: var(--accent-color);
		box-shadow: 0 0 0 3px var(--accent-light-bg);
		background: var(--card-bg);
	}

	.preview-box {
		width: 100%;
		height: 80px;
		border-radius: 14px;
		border: 1px solid;
		padding: 0.6rem;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		box-sizing: border-box;
	}

	.mini-header {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding-bottom: 0.35rem;
		border-bottom: 1px solid;
	}

	.mini-logo {
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}

	.mini-line {
		width: 40px;
		height: 4px;
		border-radius: 2px;
	}

	.mini-card {
		padding: 0.4rem;
		border-radius: 8px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.mini-title {
		font-size: 0.75rem;
		font-weight: 900;
	}

	.mini-text {
		width: 30px;
		height: 4px;
		border-radius: 2px;
	}

	.theme-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.theme-name-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.theme-name {
		font-weight: 800;
		font-size: 1rem;
		color: var(--text-color);
	}

	.active-badge {
		font-size: 0.65rem;
		font-weight: 800;
		color: white;
		padding: 0.15rem 0.45rem;
		border-radius: 6px;
	}

	.theme-desc {
		font-size: 0.75rem;
		color: var(--text-muted);
		line-height: 1.4;
		margin: 0;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
	}

	.confirm-btn {
		width: 100%;
		padding: 0.9rem;
		border-radius: 16px;
		background: linear-gradient(135deg, var(--accent-color), #0284c7);
		color: white;
		border: none;
		font-weight: 800;
		font-size: 1rem;
		cursor: pointer;
		box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes scaleUp {
		from { opacity: 0; transform: scale(0.95); }
		to { opacity: 1; transform: scale(1); }
	}
</style>
