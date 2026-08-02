<script lang="ts">
	import { PRIVACY_POLICY, SITE_NAME } from '$lib/constants';
</script>

<div class="privacy-container duo-card">
	<div class="privacy-header">
		<span class="duo-badge">Informazioni Legali</span>
		<h1 class="privacy-title">{PRIVACY_POLICY.title}</h1>
		<p class="privacy-date">Ultimo aggiornamento: {PRIVACY_POLICY.lastUpdated}</p>
	</div>

	<p class="privacy-intro">{PRIVACY_POLICY.intro}</p>

	<div class="privacy-sections">
		{#each PRIVACY_POLICY.sections as section}
			<div class="privacy-section-box">
				<h2 class="section-title">{section.title}</h2>
				<p class="section-content">{section.content}</p>
			</div>
		{/each}
	</div>

	<div class="privacy-footer">
		<a href="/" class="duo-btn duo-btn-green">Torna alla Home {SITE_NAME}</a>
	</div>
</div>

<style>
	.privacy-container {
		max-width: 720px;
		margin: 2rem auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.privacy-header {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		border-bottom: 2px solid var(--border-color);
		padding-bottom: 1rem;
	}

	.privacy-title {
		font-size: 2rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.privacy-date {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0;
	}

	.privacy-intro {
		font-size: 1rem;
		line-height: 1.6;
		color: var(--text-color);
	}

	.privacy-sections {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.privacy-section-box {
		background: var(--card-bg-subtle);
		padding: 1.25rem;
		border-radius: 16px;
		border: 1.5px solid var(--border-color);
	}

	.section-title {
		font-size: 1.15rem;
		font-weight: 900;
		color: var(--accent-color);
		margin: 0 0 0.5rem 0;
	}

	.section-content {
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--text-color);
		margin: 0;
	}

	.privacy-footer {
		display: flex;
		justify-content: center;
		padding-top: 1rem;
	}
</style>
