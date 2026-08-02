<script lang="ts">
	import '../app.css';
	import Header from '$lib/components/Header.svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<title>RF - Rail Focus | Memorizzazione Acronimi Ferroviari</title>
	<meta name="description" content="Applicazione PWA per imparare e memorizzare gli acronimi e i concetti del corso ferroviario." />
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
	<meta name="theme-color" content="#0f172a" />
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="apple-touch-icon" href="/favicon.svg" />
</svelte:head>

<div class="layout-wrapper">
	<Header />
	
	<main class="main-content">
		{@render children()}
	</main>

	<Navbar />
</div>

<style>
	.layout-wrapper {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.main-content {
		flex: 1;
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		padding: 1.25rem 1rem 6rem 1rem;
	}

	@media (min-width: 768px) {
		.main-content {
			padding: 4rem 1.5rem 2rem 1.5rem;
		}
	}
</style>
