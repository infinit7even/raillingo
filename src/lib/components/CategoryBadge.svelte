<script lang="ts">
	let {
		category,
		variant = 'default',
		size = 'md'
	} = $props<{
		category: string;
		variant?: 'default' | 'accent' | 'green' | 'purple' | 'orange';
		size?: 'sm' | 'md' | 'lg';
	}>();
</script>

<span
	class="duo-badge duo-badge-{variant} size-{size}"
>
	{category}
</span>

<style>
	.size-sm {
		font-size: 0.68rem;
		padding: 0.2rem 0.55rem;
		border-radius: 8px;
	}

	.size-md {
		font-size: 0.75rem;
		padding: 0.35rem 0.8rem;
	}

	.size-lg {
		font-size: 0.85rem;
		padding: 0.45rem 0.95rem;
	}
</style>
