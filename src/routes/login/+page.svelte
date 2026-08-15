<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';

	let { data } = $props<{
		data: {
			returnUrl: string;
			error: string | null;
		};
	}>();

	let returnUrl = $derived(data.returnUrl || '/notes');
	let error = $derived(data.error);

	let loginApiUrl = $derived(
		`/api/auth/login?returnUrl=${encodeURIComponent(returnUrl)}`
	);
</script>

<div class="login-page-container">
	<PageHeader
		title="Accedi a Rail Focus"
		subtitle="Autenticazione richiesta per accedere a questa sezione e sincronizzare i tuoi dati."
		icon="/emoji/locked_3d.png"
		variant="blue"
	/>

	{#if error === 'admin_required'}
		<div class="login-error-alert duo-card">
			<span class="error-icon">⚠️</span>
			<div class="error-text-col">
				<strong>Accesso Riservato agli Amministratori</strong>
				<p>Per accedere a questa sezione è necessario effettuare il login con un account Discord autorizzato.</p>
			</div>
		</div>
	{:else if error}
		<div class="login-error-alert duo-card">
			<span class="error-icon">⚠️</span>
			<div class="error-text-col">
				<strong>Errore di Autenticazione</strong>
				<p>Si è verificato un problema durante la procedura di login. Riprova.</p>
			</div>
		</div>
	{/if}

	<div class="login-card duo-card">
		<div class="login-card-header">
			<img src="/emoji/triangular_flag_3d.png" alt="Rail Focus" class="login-brand-img" />
			<div class="login-title-group">
				<h2 class="login-card-title">Benvenuto su Rail Focus</h2>
				<p class="login-card-subtitle">
					Accedi con il tuo account Discord per sbloccare tutte le funzionalità avanzate della piattaforma.
				</p>
			</div>
		</div>

		<div class="login-features-list">
			<div class="feature-item">
				<span class="feature-ico">📓</span>
				<div class="feature-info">
					<strong>Vault Appunti Personali</strong>
					<p>Prendi appunti testuali formattati in Markdown visuale con immagini integrate e sincronizzazione cloud.</p>
				</div>
			</div>

			<div class="feature-item">
				<span class="feature-ico">⚡</span>
				<div class="feature-info">
					<strong>Sincronizzazione Progressi & Statistiche</strong>
					<p>Mantieni attiva la tua serie di studio (streak) e conserva le risposte ai quiz su qualsiasi dispositivo.</p>
				</div>
			</div>

			<div class="feature-item">
				<span class="feature-ico">🏆</span>
				<div class="feature-info">
					<strong>Missioni & Ricompense</strong>
					<p>Sblocca sfide quotidiane, accumula XP e riscatta le tue gemme di studio.</p>
				</div>
			</div>
		</div>

		<div class="login-actions-box">
			<a href={loginApiUrl} class="duo-btn duo-btn-green discord-login-btn">
				<svg
					class="discord-svg"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 127.14 96.36"
					fill="currentColor"
				>
					<path
						d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.92,53.87,53,48.8,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.92,96.1,53,91,65.69,84.69,65.69Z"
					/>
				</svg>
				<span>ACCEDI CON DISCORD</span>
			</a>

			<a href={returnUrl} class="duo-btn duo-btn-gray back-btn">
				TORNA INDIETRO
			</a>
		</div>
	</div>
</div>

<style>
	.login-page-container {
		max-width: 580px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 0 0.5rem;
		box-sizing: border-box;
	}

	.login-error-alert {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 1rem 1.25rem;
		background: rgba(255, 94, 91, 0.12);
		border: 2px solid #ff5e5b;
		border-radius: 16px;
		color: var(--text-color);
	}

	.error-icon {
		font-size: 1.5rem;
	}

	.error-text-col {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.85rem;
	}

	.error-text-col p {
		margin: 0;
		color: var(--text-muted);
	}

	.login-card {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1.5rem;
		background: var(--card-bg);
		border-radius: 24px;
		border: 2px solid var(--border-color);
		border-bottom: 5px solid var(--border-depth-color);
	}

	.login-card-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid var(--border-color);
	}

	.login-brand-img {
		width: 48px;
		height: 48px;
		object-fit: contain;
	}

	.login-title-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.login-card-title {
		font-family: 'Outfit', sans-serif;
		font-size: 1.35rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.login-card-subtitle {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.4;
	}

	.login-features-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.feature-item {
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 14px;
		padding: 0.85rem 1rem;
	}

	.feature-ico {
		font-size: 1.4rem;
		flex-shrink: 0;
		margin-top: 0.1rem;
	}

	.feature-info {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.feature-info strong {
		font-size: 0.92rem;
		font-weight: 800;
		color: var(--text-color);
	}

	.feature-info p {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.35;
	}

	.login-actions-box {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding-top: 0.5rem;
	}

	.discord-login-btn {
		width: 100%;
		background-color: #5865f2;
		color: #ffffff;
		border-bottom: 4px solid #4752c4;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.65rem;
		font-size: 0.95rem;
		font-weight: 900;
		padding: 0.85rem 1rem;
		border-radius: 16px;
		text-decoration: none;
		box-sizing: border-box;
		transition: filter 0.15s ease, transform 0.1s ease;
	}

	.discord-login-btn:hover {
		filter: brightness(1.08);
	}

	.discord-login-btn:active {
		transform: translateY(2px);
		border-bottom-width: 2px;
	}

	.discord-svg {
		width: 22px;
		height: 22px;
		flex-shrink: 0;
	}

	.back-btn {
		width: 100%;
		text-align: center;
		justify-content: center;
		font-size: 0.85rem;
		padding: 0.7rem 1rem;
		text-decoration: none;
		box-sizing: border-box;
	}
</style>
