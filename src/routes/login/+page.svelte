<script lang="ts">
	let { data } = $props();
	let user = $state(data.user);
	let error = $state(data.error);
</script>

<div class="login-page-container">
	<div class="login-card duo-card">
		<div class="header-section">
			<span class="duo-badge">Accesso Amministrazione</span>
			<h1 class="login-title">Pannello Admin Raillingo</h1>
			<p class="login-subtitle">
				L'accesso tramite Discord è riservato esclusivamente all'amministratore per la gestione del percorso didattico e degli annunci della piattaforma.
			</p>
		</div>

		{#if error}
			<div class="error-banner duo-card">
				⚠️ {error === 'not_admin' ? 'Accesso negato: Solo l\'amministratore ha i permessi per accedere al pannello admin.' : error === 'admin_required' ? 'Accesso riservato all\'amministratore. Autenticati per continuare.' : 'Errore durante l\'autenticazione. Riprova.'}
			</div>
		{/if}

		{#if user}
			<div class="logged-in-box duo-card">
				<div class="user-row">
					{#if user.avatar}
						<img src={user.avatar} alt={user.username} class="user-avatar" />
					{:else}
						<div class="avatar-fallback">👤</div>
					{/if}
					<div class="user-meta">
						<span class="username">{user.username}</span>
						<span class="status-online">● Sessione Attiva</span>
					</div>
				</div>

				<div class="action-buttons">
					<a href="/" class="duo-btn duo-btn-green action-link">
						VAI AL PERCORSO DIDATTICO
					</a>
					<a href="/admin" class="duo-btn duo-btn-purple action-link">
						⚙️ PANNELLO GESTIONE ADMIN
					</a>
					<a href="/api/auth/logout" class="duo-btn duo-btn-gray action-link">
						DISCONNETTI
					</a>
				</div>
			</div>
		{:else}
			<div class="login-action-box">
				<a href="/api/auth/login" class="discord-login-btn">
					<svg class="discord-icon" viewBox="0 0 24 24" fill="currentColor">
						<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
					</svg>
					ACCEDI CON DISCORD
				</a>
			</div>
		{/if}
	</div>
</div>

<style>
	.login-page-container {
		max-width: 520px;
		margin: 2.5rem auto;
		display: flex;
		justify-content: center;
	}

	.login-card {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 2.25rem;
		text-align: center;
	}

	.header-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: center;
	}

	.login-title {
		font-size: 1.85rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0.25rem 0 0 0;
	}

	.login-subtitle {
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--text-muted);
		margin: 0;
	}

	.error-banner {
		background: rgba(239, 68, 68, 0.15);
		border-color: #ef4444;
		color: #f87171;
		padding: 0.85rem;
		font-size: 0.85rem;
		font-weight: 800;
	}

	.login-action-box {
		display: flex;
		justify-content: center;
		padding: 1rem 0;
	}

	.discord-login-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		width: 100%;
		padding: 1rem;
		border-radius: 16px;
		background: #5865f2;
		color: white;
		font-weight: 900;
		font-size: 1.05rem;
		text-decoration: none;
		box-shadow: 0 6px 20px rgba(88, 101, 242, 0.4);
		transition: transform 0.15s ease;
	}

	.discord-login-btn:active {
		transform: translateY(2px);
	}

	.discord-icon {
		width: 26px;
		height: 26px;
	}

	.logged-in-box {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1.25rem;
	}

	.user-row {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		text-align: left;
	}

	.user-avatar, .avatar-fallback {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		object-fit: cover;
	}

	.avatar-fallback {
		background: var(--accent-light-bg);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.4rem;
	}

	.user-meta {
		display: flex;
		flex-direction: column;
	}

	.username {
		font-size: 1.1rem;
		font-weight: 900;
		color: var(--text-color);
	}

	.status-online {
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--green-color);
	}

	.action-buttons {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.action-link {
		width: 100%;
		font-size: 0.9rem;
		text-decoration: none;
		text-align: center;
	}
</style>
