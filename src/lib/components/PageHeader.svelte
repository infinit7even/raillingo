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
		variant?: 'green' | 'blue' | 'purple' | 'orange' | 'red';
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
		border-radius: 16px;
		padding: 0.75rem 1.15rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.85rem;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
		transition: transform 0.2s ease;
		box-sizing: border-box;
		width: 100%;
		margin-top: 0;
		margin-bottom: 0.75rem;
	}

	.duo-banner-green {
		background-color: var(--green-color);
		border: 2px solid var(--green-depth);
		border-bottom: 4px solid var(--green-depth);
		color: #ffffff;
	}

	.duo-banner-blue {
		background-color: var(--accent-color);
		border: 2px solid var(--accent-depth);
		border-bottom: 4px solid var(--accent-depth);
		color: #ffffff;
	}

	.duo-banner-purple {
		background-color: var(--purple-color);
		border: 2px solid var(--purple-depth);
		border-bottom: 4px solid var(--purple-depth);
		color: #ffffff;
	}

	.duo-banner-orange {
		background-color: var(--orange-color);
		border: 2px solid var(--orange-depth);
		border-bottom: 4px solid var(--orange-depth);
		color: #ffffff;
	}

	.duo-banner-red {
		background-color: #ff5e5b;
		border: 2px solid #d9423f;
		border-bottom: 4px solid #d9423f;
		color: #ffffff;
	}

	.header-content-group {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.header-icon-img {
		width: 36px;
		height: 36px;
		object-fit: contain;
		flex-shrink: 0;
	}

	.header-text-box {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.header-badge-tag {
		font-size: 0.68rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.95;
	}

	.header-title-heading {
		font-size: 1.25rem;
		font-weight: 900;
		color: inherit;
		margin: 0;
		line-height: 1.1;
	}

	.header-subtitle-text {
		font-size: 0.8rem;
		font-weight: 600;
		opacity: 0.92;
		margin: 0;
		line-height: 1.25;
	}

	.header-actions-slot {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	@media (max-width: 640px) {
		.page-header-banner {
			padding: 0.45rem 0.75rem;
			margin-top: 0.25rem;
			margin-bottom: 0.5rem;
			border-radius: 14px;
			border-bottom-width: 3px;
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
			gap: 0.5rem;
		}

		.header-content-group {
			gap: 0.5rem;
			align-items: center;
		}

		.header-icon-img {
			width: 28px;
			height: 28px;
		}

		.header-badge-tag {
			display: none;
		}

		.header-title-heading {
			font-size: 1rem;
			line-height: 1.1;
		}

		.header-subtitle-text {
			display: none;
		}

		.header-actions-slot {
			width: auto;
		}
	}
</style>
