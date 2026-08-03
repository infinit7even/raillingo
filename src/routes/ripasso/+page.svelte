<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(() => {
		goto('/flashcard', { replaceState: true });
	});
</script>

<div class="duo-card empty-box">Reindirizzamento a /flashcard...</div>

<style>
	.empty-box {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
	}
</style>
