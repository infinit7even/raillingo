<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		subtitle = '',
		badge = '',
		icon = '',
		variant = 'green',
		children
	} = $props<{
		title: string;
		subtitle?: string;
		badge?: string;
		icon?: string;
		variant?: 'green' | 'blue' | 'purple' | 'orange';
		children?: Snippet;
	}>();
</script>

<div class="page-header-banner duo-banner-{variant}">
	<div class="header-content-group">
		{#if icon}
			<img src={icon} alt="" class="header-icon-img" />
		{/if}

		<div class="header-text-box">
			{#if badge}
				<span class="header-badge-tag">{badge}</span>
			{/if}
			<h1 class="header-title-heading">{title}</h1>
			{#if subtitle}
				<p class="header-subtitle-text">{subtitle}</p>
			{/if}
		</div>
	</div>

	{#if children}
		<div class="header-actions-slot">
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.page-header-banner {
		border-radius: 22px;
		padding: 1.35rem 1.6rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1.2rem;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
		transition: transform 0.2s ease;
		box-sizing: border-box;
		width: 100%;
		margin-bottom: 1rem;
	}

	.duo-banner-green {
		background-color: var(--green-color);
		border: 2px solid var(--green-depth);
		border-bottom: 5px solid var(--green-depth);
		color: #ffffff;
	}

	.duo-banner-blue {
		background-color: var(--accent-color);
		border: 2px solid var(--accent-depth);
		border-bottom: 5px solid var(--accent-depth);
		color: #ffffff;
	}

	.duo-banner-purple {
		background-color: var(--purple-color);
		border: 2px solid var(--purple-depth);
		border-bottom: 5px solid var(--purple-depth);
		color: #ffffff;
	}

	.duo-banner-orange {
		background-color: var(--orange-color);
		border: 2px solid var(--orange-depth);
		border-bottom: 5px solid var(--orange-depth);
		color: #ffffff;
	}

	.header-content-group {
		display: flex;
		align-items: center;
		gap: 1.1rem;
	}

	.header-icon-img {
		width: 52px;
		height: 52px;
		object-fit: contain;
		flex-shrink: 0;
	}

	.header-text-box {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.header-badge-tag {
		font-size: 0.75rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.95;
	}

	.header-title-heading {
		font-size: 1.65rem;
		font-weight: 900;
		color: inherit;
		margin: 0;
		line-height: 1.15;
	}

	.header-subtitle-text {
		font-size: 0.88rem;
		font-weight: 600;
		opacity: 0.92;
		margin: 0;
		line-height: 1.35;
	}

	.header-actions-slot {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-shrink: 0;
	}

	@media (max-width: 640px) {
		.page-header-banner {
			padding: 1rem 1.15rem;
			border-radius: 18px;
			flex-direction: column;
			align-items: flex-start;
		}

		.header-icon-img {
			width: 42px;
			height: 42px;
		}

		.header-title-heading {
			font-size: 1.35rem;
		}

		.header-actions-slot {
			width: 100%;
			justify-content: flex-end;
		}
	}
</style>
