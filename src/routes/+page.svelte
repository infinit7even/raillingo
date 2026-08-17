<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsStore } from '$lib/stores/cardsStore';
	import QuickAddCardModal from '$lib/components/QuickAddCardModal.svelte';
	import type { Card } from '$lib/types/cards';
	import { pwaStore } from '$lib/stores/pwaStore';
	import { authClient, loginWithDiscord } from '$lib/auth-client';

	let { data } = $props();

	function isEligibleWikiCard(c: Card): boolean {
		if (!c.title || !c.title.trim()) return false;
		return c.showInWiki !== false;
	}

	function isAcronymCard(c: Card): boolean {
		if (!isEligibleWikiCard(c)) return false;
		if (c.hasAcronym && c.acronym) return true;
		const title = c.title.trim();
		const fullName = c.fullName?.trim() || '';

		if (fullName && fullName.toLowerCase() !== title.toLowerCase()) {
			return true;
		}

		if (title.length > 12) return false;
		const lower = title.toLowerCase();
		if (
			lower.includes('fisso') ||
			lower.includes('lampeggiante') ||
			lower.includes('alternat') ||
			lower.includes('spenta') ||
			lower.includes('temporanea') ||
			lower.includes('permanente')
		) {
			return false;
		}

		return true;
	}

	// Seed iniziale letto dai dati del server
	const seed = (() => {
		const list: Card[] = data.initialCards ?? [];
		const wikiCards = list.filter(isEligibleWikiCard);
		const acronyms = wikiCards.filter(isAcronymCard);
		const pool = acronyms.length > 0 ? acronyms : wikiCards;
		const word = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
		return { list, word };
	})();

	let cards = $state<Card[]>(seed.list);
	let wordOfTheDay = $state<Card | null>(seed.word);
	let isQuickAddOpen = $state(false);
	let canInstall = $state(false);
	let isSpinning = $state(false);
	let isChangingWord = $state(false);
	let user = $derived(data.user);

	let wikiCards = $derived(cards.filter(isEligibleWikiCard));
	let acronymCards = $derived(wikiCards.filter(isAcronymCard));

	function pickRandomWord(cardList: Card[]) {
		const wCards = cardList.filter(isEligibleWikiCard);
		const pool = wCards.filter(isAcronymCard);
		const targetList = pool.length > 0 ? pool : wCards;
		if (targetList.length === 0) return;
		const randomIndex = Math.floor(Math.random() * targetList.length);
		wordOfTheDay = targetList[randomIndex];
	}

	function handleNextWord() {
		const pool = acronymCards.length > 0 ? acronymCards : wikiCards;
		if (pool.length === 0 || isSpinning) return;
		isSpinning = true;
		isChangingWord = true;

		setTimeout(() => {
			pickRandomWord(cards);
			isChangingWord = false;
		}, 150);

		setTimeout(() => {
			isSpinning = false;
		}, 450);
	}

	onMount(() => {
		const uncards = cardsStore.subscribe((c) => {
			if (c.length > 0) {
				cards = c;
				if (!wordOfTheDay) {
					pickRandomWord(c);
				}
			}
		});
		const unpwa = pwaStore.subscribe(() => {
			canInstall = pwaStore.canInstall;
		});

		return () => {
			uncards();
			unpwa();
		};
	});

	async function handleInstallApp() {
		await pwaStore.promptInstall();
	}

	async function handleLogout() {
		try {
			await authClient.signOut();
		} catch {
			await fetch('/api/auth/logout', { method: 'POST' });
		}
		window.location.href = '/';
	}

	const lessonNodes = [
		{
			id: 1,
			title: 'FLASHCARD',
			href: '/flashcard',
			icon: '/emoji/open_book_3d.png',
			state: 'active',
			offset: 0
		},
		{
			id: 2,
			title: 'QUIZ',
			href: '/quiz',
			icon: '/emoji/star_3d.png',
			state: 'unlocked',
			offset: -40
		},
		{
			id: 3,
			title: 'REELS',
			href: '/reels',
			icon: '/emoji/camera_3d.png',
			state: 'unlocked',
			offset: 35
		},
		{
			id: 4,
			title: 'WIKI',
			href: '/wiki',
			icon: '/emoji/books_3d.png',
			state: 'unlocked',
			offset: -35
		},
		{
			id: 5,
			title: 'APPUNTI',
			href: '/notes',
			icon: '/emoji/clipboard_3d.png',
			state: 'unlocked',
			offset: 0
		}
	];
</script>

<div class="home-centered-container">
	<!-- 💡 Parola del Giorno (Solo cose visibili nella Wiki) -->
	{#if wordOfTheDay}
		<section class="word-of-day-section">
			<div class="duo-card word-of-day-card">
				<div class="wod-header">
					<div class="wod-badge">
						<span class="wod-icon">💡</span>
						<span class="wod-badge-text">PAROLA DEL GIORNO</span>
					</div>
					<div class="wod-header-actions">
						<button
							class="wod-action-btn"
							class:is-spinning={isSpinning}
							onclick={handleNextWord}
							disabled={isSpinning}
							title="Scopri un'altra parola della wiki"
						>
							<span class="dice-icon" class:spin={isSpinning}>🎲</span> Random
						</button>
					</div>
				</div>

				<div class="wod-content" class:wod-pop={isChangingWord}>
					<div class="wod-title-row">
						<h2 class="wod-title">{wordOfTheDay.title}</h2>
						{#if wordOfTheDay.acronym}
							<span class="wod-fullname">{wordOfTheDay.acronym}</span>
						{:else if wordOfTheDay.fullName && wordOfTheDay.fullName.trim().toLowerCase() !== wordOfTheDay.title.trim().toLowerCase()}
							<span class="wod-fullname">{wordOfTheDay.fullName}</span>
						{/if}
					</div>

					<p class="wod-desc">{wordOfTheDay.description}</p>
				</div>
			</div>
		</section>
	{/if}

	<!-- 🛤️ Percorso 3D Minigiochi Stile Duolingo -->
	<section class="duo-path-section">
		<div class="nodes-container">
			{#each lessonNodes as node, i}
				<div class="node-wrapper" style="transform: translateX({node.offset}px)">
					<a href={node.href} class="path-node-btn" class:active={i === 0} title={node.title}>
						<img src={node.icon} alt={node.title} width="36" height="36" decoding="async" class="node-emoji-img" />
					</a>
					<span class="path-node-label">{node.title}</span>
				</div>
			{/each}

			<!-- 🦉 Mascotte Ferroviaria sul Percorso -->
			<div class="duo-mascot-box">
				<img src="/emoji/owl_3d.png" alt="Mascotte Gufo" width="80" height="80" decoding="async" class="mascot-img" />
			</div>
		</div>
	</section>

	<!-- 🔗 Risorse e Account Widget -->
	<section class="home-resources-section">
		<div class="duo-widget duo-card home-resources-card">
			<h3 class="widget-title">Risorse e Account</h3>
			<div class="profile-actions">
				{#if canInstall}
					<button
						type="button"
						class="duo-btn duo-btn-red flex-btn install-app-btn"
						onclick={handleInstallApp}
					>
						📲 INSTALLA L'APP
					</button>
				{/if}

				{#if user}
					<button type="button" class="duo-btn duo-btn-red flex-btn home-logout-btn" onclick={handleLogout}>
						🚪 LOGOUT ({user.name || user.username || user.email || 'Utente'})
					</button>
				{:else}
					<button type="button" class="duo-btn sync-btn discord-sync-btn flex-btn" onclick={() => loginWithDiscord('/')}>
						<svg
							class="discord-icon-mini"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 127.14 96.36"
							width="20"
							height="20"
							fill="currentColor"
						>
							<path
								d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.92,53.87,53,48.8,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.92,96.1,53,91,65.69,84.69,65.69Z"
							/>
						</svg>
						<span>ACCEDI CON DISCORD</span>
					</button>
				{/if}
			</div>
		</div>

		<!-- Footer Link to Privacy Policy & Account Details -->
		<div class="sidebar-privacy-footer">
			<a href="/privacy" class="privacy-link">Informativa sulla Privacy</a>

			{#if user}
				<div class="footer-account-details">
					<span class="account-details-name">👤 Connesso come <strong>{user.name || user.username || user.email || 'Utente'}</strong></span>
					{#if user.userId || user.id}
						<span class="account-details-id">ID: {user.userId || user.id}</span>
					{/if}
					<button type="button" class="footer-logout-link" onclick={handleLogout}>
						Esci dall'account
					</button>
				</div>
			{/if}
		</div>
	</section>
</div>

<!-- Quick 1-Click Add Card Modal for Admin -->
<QuickAddCardModal isOpen={isQuickAddOpen} {cards} onClose={() => (isQuickAddOpen = false)} />

<style>
	.home-centered-container {
		width: 100%;
		max-width: 600px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		box-sizing: border-box;
	}

	/* 📍 Serpeggiante Node Path */
	.duo-path-section {
		padding: 2rem 0 2.5rem 0;
		display: flex;
		justify-content: center;
	}

	.nodes-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2.2rem;
		position: relative;
		width: 100%;
		max-width: 380px;
	}

	.node-wrapper {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		transition: transform 0.3s ease;
		gap: 0.35rem;
	}

	.path-node-label {
		font-family: 'Outfit', sans-serif;
		font-weight: 800;
		font-size: 0.75rem;
		color: var(--text-color);
		background: var(--card-bg-subtle);
		padding: 0.2rem 0.55rem;
		border-radius: 8px;
		border: 1px solid var(--border-color);
		white-space: nowrap;
	}

	.path-node-btn {
		width: 68px;
		height: 68px;
		border-radius: 50%;
		background-color: var(--brand-color, var(--green-color));
		border: 2px solid var(--brand-depth, var(--green-depth));
		border-bottom: 6px solid var(--brand-depth, var(--green-depth));
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
		transition:
			transform 0.1s ease,
			border-width 0.1s ease;
		user-select: none;
	}

	.path-node-btn.active {
		background-color: var(--brand-color, var(--green-color));
		border-color: var(--brand-depth, var(--green-depth));
		transform: scale(1.08);
	}

	.path-node-btn:active {
		transform: translateY(3px) scale(1.02);
		border-bottom-width: 2px;
	}

	.node-emoji-img {
		width: 36px;
		height: 36px;
		object-fit: contain;
	}

	.duo-mascot-box {
		position: absolute;
		right: -35px;
		top: 130px;
		animation: floatMascot 3s ease-in-out infinite;
	}

	.mascot-img {
		width: 76px;
		height: 76px;
		object-fit: contain;
	}

	/* 💡 Parola del Giorno Card (Style Duolingo 3D) */
	.word-of-day-section {
		width: 100%;
		margin-bottom: 0;
	}

	.word-of-day-card {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 0.85rem 1.15rem;
		background: var(--card-bg);
		border-radius: 18px;
	}

	.wod-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		border-bottom: 1.5px solid var(--border-color);
		padding-bottom: 0.75rem;
	}

	.wod-badge {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: var(--accent-light-bg);
		padding: 0.3rem 0.75rem;
		border-radius: 999px;
		border: 1px solid var(--accent-color);
	}

	.wod-icon {
		font-size: 1rem;
	}

	.wod-badge-text {
		font-size: 0.75rem;
		font-weight: 900;
		color: var(--accent-color);
		letter-spacing: 0.08em;
	}

	.wod-header-actions {
		display: flex;
		gap: 0.4rem;
	}

	.wod-action-btn {
		font-size: 0.78rem;
		font-weight: 800;
		padding: 0.35rem 0.7rem;
		border-radius: 12px;
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		color: var(--text-color);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.wod-action-btn:hover:not(:disabled) {
		background: var(--hover-bg);
		border-color: var(--accent-color);
		transform: translateY(-1px);
	}

	.wod-action-btn:active:not(:disabled) {
		transform: translateY(1px);
	}

	.dice-icon {
		display: inline-block;
		transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.dice-icon.spin {
		transform: rotate(360deg) scale(1.3);
	}

	.wod-content {
		transition:
			opacity 0.2s ease,
			transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.wod-content.wod-pop {
		opacity: 0.3;
		transform: scale(0.97);
	}

	.wod-title-row {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin-bottom: 0.4rem;
	}

	.wod-title {
		font-size: 1.45rem;
		font-weight: 900;
		color: var(--accent-color);
		margin: 0;
	}

	.wod-fullname {
		font-size: 0.95rem;
		font-weight: 800;
		color: var(--text-color);
	}

	.wod-desc {
		font-size: 0.95rem;
		line-height: 1.55;
		color: var(--text-color);
		opacity: 0.92;
		margin: 0;
	}

	/* 🔗 Risorse e Account Section */
	.home-resources-section {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 2rem;
	}

	.home-resources-card {
		padding: 1rem;
		background: var(--card-bg);
		border-radius: 18px;
	}

	.widget-title {
		font-size: 0.95rem;
		font-weight: 900;
		margin: 0 0 0.75rem 0;
		color: var(--text-color);
	}

	.profile-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.flex-btn {
		width: 100%;
		justify-content: center;
		text-align: center;
		padding: 0.65rem 1rem;
		font-size: 0.82rem;
		text-decoration: none;
		box-sizing: border-box;
	}

	.discord-sync-btn {
		background-color: #5865f2;
		color: #ffffff;
		border: 2px solid #4752c4;
		border-bottom: 4px solid #4752c4;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-weight: 900;
		border-radius: 14px;
		cursor: pointer;
	}

	.home-logout-btn {
		font-size: 0.8rem;
	}

	.sidebar-privacy-footer {
		text-align: center;
		padding: 0.25rem 0;
	}

	.privacy-link {
		color: var(--text-muted);
		font-size: 0.75rem;
		text-decoration: none;
		font-weight: 700;
	}

	.privacy-link:hover {
		color: var(--text-color);
		text-decoration: underline;
	}

	.footer-account-details {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		margin-top: 0.65rem;
		padding-top: 0.65rem;
		border-top: 1px dashed var(--border-color);
	}

	.account-details-name {
		font-size: 0.78rem;
		color: var(--text-color);
		font-weight: 700;
	}

	.account-details-name strong {
		color: var(--accent-color);
	}

	.account-details-id {
		font-size: 0.7rem;
		color: var(--text-muted);
		font-family: monospace;
	}

	.footer-logout-link {
		background: none;
		border: none;
		font-size: 0.72rem;
		color: var(--pink-color, #ef4444);
		font-weight: 800;
		cursor: pointer;
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		text-decoration: underline;
		transition: opacity 0.15s ease;
	}

	.footer-logout-link:hover {
		opacity: 0.75;
	}

	@keyframes floatMascot {
		0%, 100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-8px);
		}
	}
</style>
