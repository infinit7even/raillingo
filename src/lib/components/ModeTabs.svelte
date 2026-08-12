<script lang="ts">
	export interface TabItem<T extends string = string> {
		id: T;
		label: string;
		emoji?: string;
	}

	let { tabs, activeTab, onSelect } = $props<{
		tabs: TabItem[];
		activeTab: string;
		onSelect: (id: any) => void;
	}>();
</script>

<div class="duo-tab-bar" role="tablist">
	{#each tabs as tab}
		{@const isActive = activeTab === tab.id}
		<button
			type="button"
			class="duo-tab-btn"
			class:active={isActive}
			onclick={() => onSelect(tab.id)}
			role="tab"
			aria-selected={isActive}
		>
			{#if tab.emoji}
				<img src={tab.emoji} alt="" aria-hidden="true" class="tab-emoji" />
			{/if}
			<span>{tab.label}</span>
		</button>
	{/each}
</div>

<style>
	.duo-tab-bar {
		display: flex;
		gap: 0.35rem;
		background: var(--card-bg-subtle);
		padding: 0.4rem;
		border-radius: 18px;
		border: 2px solid var(--border-color);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
		width: 100%;
		box-sizing: border-box;
	}

	.duo-tab-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		padding: 0.7rem 0.5rem;
		min-height: 44px;
		border-radius: 14px;
		border: 2px solid transparent;
		background: none;
		color: var(--text-muted);
		font-family: 'Outfit', sans-serif;
		font-weight: 800;
		font-size: 0.75rem;
		letter-spacing: 0.03em;
		cursor: pointer;
		user-select: none;
		transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.duo-tab-btn:hover:not(.active) {
		color: var(--text-color);
		background: rgba(255, 255, 255, 0.04);
	}

	.duo-tab-btn:active {
		transform: scale(0.97);
	}

	.duo-tab-btn.active {
		background: var(--card-bg);
		color: var(--accent-color);
		border-color: var(--accent-color);
		border-bottom-width: 3px;
		box-shadow: 0 4px 14px var(--shadow-color);
	}

	.tab-emoji {
		width: 20px;
		height: 20px;
		object-fit: contain;
		flex-shrink: 0;
	}

	@media (max-width: 480px) {
		.duo-tab-btn {
			padding: 0.55rem 0.3rem;
			font-size: 0.7rem;
			gap: 0.3rem;
		}

		.tab-emoji {
			width: 16px;
			height: 16px;
		}
	}
</style>
