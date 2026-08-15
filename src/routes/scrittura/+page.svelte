<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/flashcard?writing=true', { replaceState: true });
	});
</script>

<div class="redirect-box duo-card">
	<p>Reindirizzamento alle Flashcard (Modalità Scrittura)...</p>
</div>

<style>
	.redirect-box {
		text-align: center;
		padding: 2.5rem;
		margin: 2rem auto;
		max-width: 500px;
		color: var(--text-muted);
	}
</style>
