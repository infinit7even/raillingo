<script lang="ts">
	import { onMount } from 'svelte';
	import { pwaStore } from '$lib/stores/pwaStore';

	let { isOpen, onClose } = $props<{
		isOpen: boolean;
		onClose: () => void;
	}>();

	let canInstall = $state(false);
	let isStandalone = $state(false);
	let isIOS = $state(false);
	let isAndroid = $state(false);
	let activeTab = $state<'ios' | 'android' | 'desktop'>('android');

	onMount(() => {
		const ua = navigator.userAgent.toLowerCase();
		isIOS = /iphone|ipad|ipod/.test(ua);
		isAndroid = /android/.test(ua);

		if (isIOS) {
			activeTab = 'ios';
		} else if (isAndroid) {
			activeTab = 'android';
		} else {
			activeTab = 'desktop';
		}

		const unsubscribe = pwaStore.subscribe(() => {
			canInstall = pwaStore.canInstall;
			isStandalone = pwaStore.isStandalone;
		});

		return unsubscribe;
	});

	async function handleInstallPrompt() {
		const success = await pwaStore.promptInstall();
		if (success) {
			onClose();
		}
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="modal-backdrop"
		onclick={onClose}
		role="presentation"
	>
		<div
			class="modal-card duo-card"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-labelledby="install-modal-title"
			tabindex="-1"
		>
			<!-- Header Modal -->
			<div class="modal-header">
				<div class="header-title-group">
					<span class="header-icon">📲</span>
					<div>
						<h2 id="install-modal-title" class="modal-title">Scarica l'App Raillingo</h2>
						<p class="modal-subtitle">Installa l'app sul tuo smartphone per un'esperienza completa e offline!</p>
					</div>
				</div>
				<button class="close-btn" onclick={onClose} aria-label="Chiudi modal">✕</button>
			</div>

			<!-- Direct Install Button if PWA prompt is ready -->
			{#if canInstall}
				<div class="direct-install-box">
					<div class="direct-info">
						<span class="sparkle-icon">⚡</span>
						<span>Installazione rapida in 1 tap supportata dal tuo browser!</span>
					</div>
					<button class="duo-btn duo-btn-green direct-btn" onclick={handleInstallPrompt}>
						📲 INSTALLA ORA L'APP
					</button>
				</div>
			{:else if isStandalone}
				<div class="standalone-already-box">
					<span class="check-icon">✅</span>
					<p>L'app è già installata e in uso in modalità Standalone!</p>
				</div>
			{/if}

			<!-- Device Switcher Tabs -->
			<div class="device-tabs">
				<button
					class="tab-btn"
					class:active={activeTab === 'ios'}
					onclick={() => (activeTab = 'ios')}
				>
					 iOS / iPhone
				</button>
				<button
					class="tab-btn"
					class:active={activeTab === 'android'}
					onclick={() => (activeTab = 'android')}
				>
					🤖 Android
				</button>
				<button
					class="tab-btn"
					class:active={activeTab === 'desktop'}
					onclick={() => (activeTab = 'desktop')}
				>
					💻 PC / Mac
				</button>
			</div>

			<!-- Instructions Content -->
			<div class="instructions-body">
				{#if activeTab === 'ios'}
					<ol class="steps-list">
						<li>
							<span class="step-num">1</span>
							<div class="step-text">
								Apri questo sito con il browser <strong>Safari</strong> sul tuo iPhone o iPad.
							</div>
						</li>
						<li>
							<span class="step-num">2</span>
							<div class="step-text">
								Tocca il pulsante <strong>Condividi</strong>
								<span class="inline-icon">⎕↑</span>
								nella barra in basso.
							</div>
						</li>
						<li>
							<span class="step-num">3</span>
							<div class="step-text">
								Scorri e seleziona <strong>"Aggiungi alla schermata Home"</strong>
								<span class="inline-icon">➕</span>.
							</div>
						</li>
						<li>
							<span class="step-num">4</span>
							<div class="step-text">
								Conferma toccando <strong>"Aggiungi"</strong> in alto a destra. L'icona apparirà tra le tue app!
							</div>
						</li>
					</ol>
				{:else if activeTab === 'android'}
					<ol class="steps-list">
						<li>
							<span class="step-num">1</span>
							<div class="step-text">
								Apri il sito con <strong>Google Chrome</strong> o <strong>Edge</strong> sul tuo dispositivo Android.
							</div>
						</li>
						<li>
							<span class="step-num">2</span>
							<div class="step-text">
								Tocca il pulsante <strong>"Installa"</strong> sopra (se visibile) o i <strong>tre pallini</strong>
								<span class="inline-icon">⋮</span> in alto a destra.
							</div>
						</li>
						<li>
							<span class="step-num">3</span>
							<div class="step-text">
								Seleziona <strong>"Installa applicazione"</strong> o <strong>"Aggiungi a schermata Home"</strong>.
							</div>
						</li>
						<li>
							<span class="step-num">4</span>
							<div class="step-text">
								Conferma l'installazione: avrai l'app a schermo intero senza barra di navigazione!
							</div>
						</li>
					</ol>
				{:else}
					<ol class="steps-list">
						<li>
							<span class="step-num">1</span>
							<div class="step-text">
								Usa <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong> o <strong>Brave</strong> su desktop.
							</div>
						</li>
						<li>
							<span class="step-num">2</span>
							<div class="step-text">
								Fai clic sull'icona <strong>Installa App</strong> <span class="inline-icon">💻</span> nella barra degli indirizzi in alto a destra.
							</div>
						</li>
						<li>
							<span class="step-num">3</span>
							<div class="step-text">
								Fai clic su <strong>"Installa"</strong> nel popup del browser.
							</div>
						</li>
					</ol>
				{/if}
			</div>

			<!-- Modal Footer -->
			<div class="modal-footer">
				<button class="duo-btn duo-btn-gray close-footer-btn" onclick={onClose}>
					HO CAPITO
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 999;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		animation: fadeIn 0.2s ease;
	}

	.modal-card {
		width: 100%;
		max-width: 500px;
		background: var(--card-bg);
		border-radius: 24px;
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
		max-height: 90vh;
		overflow-y: auto;
		animation: slideUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.modal-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		border-bottom: 2px solid var(--border-color);
		padding-bottom: 0.85rem;
	}

	.header-title-group {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.header-icon {
		font-size: 2.2rem;
		line-height: 1;
	}

	.modal-title {
		font-size: 1.25rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.modal-subtitle {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-top: 0.2rem;
		line-height: 1.35;
	}

	.close-btn {
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		color: var(--text-muted);
		width: 34px;
		height: 34px;
		border-radius: 50%;
		font-size: 1.1rem;
		font-weight: 800;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: all 0.15s ease;
	}

	.close-btn:hover {
		color: var(--text-color);
		border-color: var(--accent-color);
	}

	.direct-install-box {
		background: rgba(88, 204, 2, 0.12);
		border: 2px solid var(--green-color);
		border-radius: 16px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		text-align: center;
	}

	.direct-info {
		font-size: 0.85rem;
		font-weight: 800;
		color: var(--green-color);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
	}

	.direct-btn {
		width: 100%;
		font-size: 0.95rem;
		padding: 0.85rem;
	}

	.standalone-already-box {
		background: var(--accent-light-bg);
		border: 2px solid var(--accent-color);
		border-radius: 16px;
		padding: 0.85rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--accent-color);
		font-weight: 800;
		font-size: 0.85rem;
	}

	.device-tabs {
		display: flex;
		gap: 0.4rem;
		background: var(--card-bg-subtle);
		padding: 0.35rem;
		border-radius: 16px;
		border: 1.5px solid var(--border-color);
	}

	.tab-btn {
		flex: 1;
		padding: 0.5rem 0.4rem;
		border: none;
		background: transparent;
		color: var(--text-muted);
		font-family: 'Outfit', sans-serif;
		font-size: 0.78rem;
		font-weight: 800;
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: center;
	}

	.tab-btn.active {
		background: var(--card-bg);
		color: var(--accent-color);
		box-shadow: 0 2px 8px var(--shadow-color);
	}

	.instructions-body {
		background: var(--card-bg-subtle);
		border-radius: 16px;
		border: 1.5px solid var(--border-color);
		padding: 1rem;
	}

	.steps-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 0;
		margin: 0;
	}

	.steps-list li {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.step-num {
		background: var(--accent-color);
		color: #ffffff;
		font-weight: 900;
		font-size: 0.8rem;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		margin-top: 0.1rem;
	}

	.step-text {
		font-size: 0.88rem;
		color: var(--text-color);
		line-height: 1.45;
	}

	.inline-icon {
		display: inline-block;
		background: var(--card-bg);
		padding: 0.1rem 0.4rem;
		border-radius: 6px;
		border: 1px solid var(--border-color);
		font-weight: 900;
		font-size: 0.85rem;
		color: var(--accent-color);
		margin: 0 0.15rem;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		padding-top: 0.5rem;
	}

	.close-footer-btn {
		width: 100%;
		font-size: 0.9rem;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
