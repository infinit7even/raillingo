<script lang="ts">
	let { data } = $props();
	let user = $state(data.user);
	let error = $state(data.error);
</script>

<div class="login-page-container">
	<div class="login-card duo-card">
		<!-- Header -->
		<div class="header-section">
			<span class="duo-badge">Salvataggio & Profilo Utente</span>
			<h1 class="login-title">Accedi a Raillingo</h1>
			<p class="login-subtitle">
				Sincronizza i tuoi progressi, mantieni la tua serie quotidiana 🔥 e sblocca l'accesso alle funzionalità avanzate.
			</p>
		</div>

		<!-- Error / Information Messages -->
		{#if error === 'admin_required'}
			<div class="info-banner duo-card">
				<span class="info-icon">ℹ️</span>
				<div class="info-text">
					<strong>Accesso alla Gestione Riservato</strong>
					<p>La pagina richiesta richiede i permessi di Amministratore (configurati in <code>.env</code> in <code>DISCORD_ADMIN_IDS</code>). Effettua il login con il tuo account autorizzato.</p>
				</div>
			</div>
		{:else if error}
			<div class="error-banner duo-card">
				⚠️ Errore durante l'autenticazione ({error}). Riprova o verifica la connessione.
			</div>
		{/if}

		<!-- Logged In User State -->
		{#if user}
			<div class="user-profile-box duo-card">
				<div class="user-header">
					{#if user.avatar}
						<img src={user.avatar} alt={user.username} class="user-avatar-img" />
					{:else}
						<div class="avatar-circle-fallback">👤</div>
					{/if}
					<div class="user-info">
						<h2 class="user-name">{user.username}</h2>
						<div class="role-badge" class:admin-role={user.isAdmin}>
							{user.isAdmin ? '⭐ Amministratore Autorizzato' : '👤 Utente Registrato'}
						</div>
					</div>
				</div>

				<!-- Stats Overview Box -->
				<div class="user-stats-row duo-card">
					<div class="stat-col">
						<span class="stat-num">🔥 {user.stats?.streakDays || 1}</span>
						<span class="stat-label">Serie Giorni</span>
					</div>
					<div class="stat-col">
						<span class="stat-num">💎 {user.stats?.quizCorrect ? user.stats.quizCorrect * 10 : 100}</span>
						<span class="stat-label">Gemme</span>
					</div>
					<div class="stat-col">
						<span class="stat-num">⚡ {user.stats?.cardsStudied ? user.stats.cardsStudied * 15 : 120}</span>
						<span class="stat-label">Punti XP</span>
					</div>
				</div>

				<!-- Quick Action Navigation -->
				<div class="action-buttons-list">
					<a href="/" class="duo-btn duo-btn-green action-btn">
						▶️ VAI AL PERCORSO DIDATTICO
					</a>

					{#if user.isAdmin}
						<a href="/admin" class="duo-btn duo-btn-purple action-btn">
							⚙️ PANNELLO GESTIONE ADMIN
						</a>
					{/if}

					<a href="/api/auth/logout" class="duo-btn duo-btn-gray action-btn">
						🚪 DISCONNETTI ACCOUNT
					</a>
				</div>
			</div>
		{:else}
			<!-- Logged Out Login Card -->
			<div class="login-features-list">
				<div class="feature-item">
					<span class="feature-icon">🔥</span>
					<div class="feature-desc">
						<strong>Salva la tua Serie Quotidiana</strong>
						<p>Non perdere i tuoi giorni di ripasso consecutivi.</p>
					</div>
				</div>

				<div class="feature-item">
					<span class="feature-icon">💎</span>
					<div class="feature-desc">
						<strong>Guadagna Gemme ed XP</strong>
						<p>Accumula punti completando quiz e sessioni di scrittura.</p>
					</div>
				</div>

				<div class="feature-item">
					<span class="feature-icon">⭐</span>
					<div class="feature-desc">
						<strong>Permessi Admin Integrati</strong>
						<p>Gli account inseriti in <code>DISCORD_ADMIN_IDS</code> abilitano l'inserimento card con 1 click.</p>
					</div>
				</div>
			</div>

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
		max-width: 540px;
		margin: 2rem auto;
		display: flex;
		justify-content: center;
		padding: 0 1rem;
	}

	.login-card {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 2.25rem;
		background: var(--card-bg);
		border-radius: 24px;
	}

	.header-section {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		align-items: center;
		text-align: center;
	}

	.login-title {
		font-size: 1.9rem;
		font-weight: 900;
		color: var(--accent-color);
		margin: 0.25rem 0 0 0;
	}

	.login-subtitle {
		font-size: 0.92rem;
		line-height: 1.55;
		color: var(--text-muted);
		margin: 0;
	}

	.info-banner {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		padding: 1rem;
		text-align: left;
		border-radius: 16px;
	}

	.info-icon {
		font-size: 1.3rem;
	}

	.info-text strong {
		color: var(--accent-color);
		display: block;
		font-size: 0.95rem;
		margin-bottom: 0.2rem;
	}

	.info-text p {
		margin: 0;
		font-size: 0.82rem;
		color: var(--text-color);
		line-height: 1.45;
	}

	.error-banner {
		background: rgba(239, 68, 68, 0.15);
		border-color: #ef4444;
		color: #f87171;
		padding: 0.9rem;
		font-size: 0.88rem;
		font-weight: 800;
		border-radius: 14px;
		text-align: center;
	}

	.user-profile-box {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1.25rem;
		background: var(--card-bg-subtle);
		border-radius: 20px;
	}

	.user-header {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.user-avatar-img, .avatar-circle-fallback {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid var(--accent-color);
	}

	.avatar-circle-fallback {
		background: var(--accent-light-bg);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.6rem;
	}

	.user-info {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.user-name {
		font-size: 1.25rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.role-badge {
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-muted);
	}

	.role-badge.admin-role {
		color: var(--purple-color);
	}

	.user-stats-row {
		display: flex;
		justify-content: space-around;
		padding: 0.85rem;
		background: var(--card-bg);
		border-radius: 14px;
		border: 1px solid var(--border-color);
	}

	.stat-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
	}

	.stat-num {
		font-size: 1.05rem;
		font-weight: 900;
		color: var(--text-color);
	}

	.stat-label {
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.action-buttons-list {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.action-btn {
		width: 100%;
		font-size: 0.9rem;
		text-decoration: none;
		text-align: center;
		justify-content: center;
	}

	.login-features-list {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 0.5rem 0;
	}

	.feature-item {
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
		text-align: left;
		padding: 0.75rem;
		background: var(--card-bg-subtle);
		border-radius: 14px;
		border: 1px solid var(--border-color);
	}

	.feature-icon {
		font-size: 1.4rem;
	}

	.feature-desc strong {
		display: block;
		font-size: 0.9rem;
		color: var(--text-color);
		margin-bottom: 0.15rem;
	}

	.feature-desc p {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.login-action-box {
		display: flex;
		justify-content: center;
		padding-top: 0.5rem;
	}

	.discord-login-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		width: 100%;
		padding: 1.1rem;
		border-radius: 16px;
		background: #5865f2;
		color: white;
		font-weight: 900;
		font-size: 1.05rem;
		text-decoration: none;
		box-shadow: 0 6px 20px rgba(88, 101, 242, 0.4);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.discord-login-btn:hover {
		box-shadow: 0 8px 24px rgba(88, 101, 242, 0.5);
	}

	.discord-login-btn:active {
		transform: translateY(2px);
	}

	.discord-icon {
		width: 26px;
		height: 26px;
	}
</style>
