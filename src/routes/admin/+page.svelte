<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { cardsStore } from '$lib/stores/cardsStore';
	import type { Card } from '$lib/types/cards';

	import CardForm from '$lib/components/CardForm.svelte';
	import { loginWithDiscord } from '$lib/auth-client';
	import { toastStore } from '$lib/stores/toastStore';
	import { matchesCategory } from '$lib/stores/globalCategoryStore';

	interface AdminUser {
		id: string;
		name: string;
		email: string;
		image?: string | null;
		role: 'admin' | 'user';
		isHardcodedAdmin: boolean;
		discordId?: string | null;
		notesCount: number;
		stats?: Record<string, any>;
		createdAt: string;
		updatedAt: string;
	}

	interface AdminLogItem {
		id: string;
		userId: string;
		userName: string;
		userAvatar?: string | null;
		action: string;
		targetType: string;
		targetId?: string | null;
		targetTitle?: string | null;
		details?: Record<string, any>;
		createdAt: string;
	}

	let { data } = $props();

	// Local state
	let cards = $state<Card[]>([]);
	let trashCards = $state<Card[]>([]);
	let activeTab = $state<'active' | 'users' | 'logs' | 'trash'>('active');

	let user = $derived(data.user);
	let error = $derived(data.error);
	let isAdmin = $derived(
		Boolean(
			user &&
			(user.isAdmin === true ||
			 user.role === 'admin' ||
			 user.id === '691289686093725736')
		)
	);

	// Users state
	let users = $state<AdminUser[]>([]);
	let usersLoading = $state(false);
	let usersSearchQuery = $state('');

	// Logs state
	let logs = $state<AdminLogItem[]>([]);
	let logsLoading = $state(false);
	let logsActionFilter = $state('ALL');
	let logsSearchQuery = $state('');

	// Form state for editing card inline
	let editingCard = $state<Card | null>(null);
	let searchQuery = $state('');
	let selectedCategoryFilter = $state('ALL');

	// Category batch edit state
	let isCategoryAccordionOpen = $state(false);
	let categoryToRename = $state<string | null>(null);
	let newCategoryName = $state('');
	let renamingInProgress = $state(false);
	let categorySearchQuery = $state('');

	// Import Modal state
	let isImportModalOpen = $state(false);
	let importedCardsData = $state<Card[] | null>(null);
	let importFileName = $state('');
	let isImporting = $state(false);
	let fileInputRef = $state<HTMLInputElement | null>(null);

	// Derived category stats map
	let categoryStats = $derived.by<{ category: string; count: number }[]>(() => {
		const map = new Map<string, number>();
		for (const c of cards) {
			const cat = c.category && c.category.trim() ? c.category.trim() : 'Senza Categoria';
			map.set(cat, (map.get(cat) || 0) + 1);
		}
		return Array.from(map.entries())
			.map(([category, count]) => ({ category, count }))
			.sort((a, b) => b.count - a.count);
	});

	let filteredCategoryStats = $derived.by(() => {
		const q = categorySearchQuery.toLowerCase().trim();
		if (!q) return categoryStats;
		return categoryStats.filter((s) => s.category.toLowerCase().includes(q));
	});

	async function loadTrash() {
		trashCards = await cardsStore.fetchTrash();
	}

	async function loadUsers() {
		usersLoading = true;
		try {
			const res = await fetch('/api/admin/users');
			if (res.ok) {
				users = await res.json();
			}
		} catch (err) {
			console.error('Errore caricamento utenti:', err);
		} finally {
			usersLoading = false;
		}
	}

	async function toggleUserRole(targetUser: AdminUser) {
		const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
		const actionText = newRole === 'admin' ? 'promuovere ad AMMINISTRATORE' : 'revocare i permessi di amministratore a';

		if (!confirm(`Sei sicuro di voler ${actionText} "${targetUser.name}" (${targetUser.email})?`)) {
			return;
		}

		try {
			const res = await fetch('/api/admin/users', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: targetUser.id, role: newRole })
			});

			if (!res.ok) {
				const errData = await res.json();
				throw new Error(errData.error || 'Errore modifica ruolo');
			}

			toastStore.show({ message: `👑 Ruolo di ${targetUser.name} aggiornato a: ${newRole}` });
			await loadUsers();
			await loadLogs();
		} catch (err: any) {
			console.error('Errore toggle ruolo:', err);
			toastStore.show({ message: `❌ ${err.message || 'Errore modifica ruolo'}` });
		}
	}

	async function loadLogs() {
		logsLoading = true;
		try {
			const res = await fetch('/api/admin/logs');
			if (res.ok) {
				logs = await res.json();
			}
		} catch (err) {
			console.error('Errore caricamento log admin:', err);
		} finally {
			logsLoading = false;
		}
	}

	async function clearAllLogs() {
		if (!confirm('Vuoi eliminare TUTTI i log delle azioni degli admin? Questa azione non può essere annullata.')) {
			return;
		}

		try {
			const res = await fetch('/api/admin/logs', { method: 'DELETE' });
			if (res.ok) {
				logs = [];
				toastStore.show({ message: '🧹 Registro log svuotato con successo!' });
			}
		} catch (err) {
			console.error('Errore svuotamento log:', err);
		}
	}

	function getActionBadge(action: string) {
		switch (action) {
			case 'create_card':
				return { label: 'Creazione Scheda', icon: '✨', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)' };
			case 'update_card':
				return { label: 'Modifica Scheda', icon: '✏️', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' };
			case 'trash_card':
				return { label: 'Spostata nel Cestino', icon: '🗑️', color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)' };
			case 'restore_card':
				return { label: 'Ripristino Scheda', icon: '♻️', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' };
			case 'permanent_delete_card':
				return { label: 'Eliminazione Definitiva', icon: '✕', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.14)' };
			case 'set_role_admin':
				return { label: 'Promozione Admin', icon: '👑', color: '#eab308', bg: 'rgba(234, 179, 8, 0.16)' };
			case 'remove_role_admin':
				return { label: 'Revoca Admin', icon: '👤', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.14)' };
			case 'rename_category':
				return { label: 'Rinomina Categoria', icon: '🏷️', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)' };
			case 'import_cards':
				return { label: 'Importazione Backup', icon: '📥', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.14)' };
			case 'clean_media':
				return { label: 'Pulizia Media', icon: '🧹', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)' };
			default:
				return { label: action, icon: '⚡', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' };
		}
	}

	onMount(() => {
		const unsubscribe = cardsStore.subscribe((c) => {
			cards = c;
		});
		loadTrash();
		loadUsers();
		loadLogs();
		return unsubscribe;
	});

	function resetForm() {
		editingCard = null;
	}

	function startEdit(card: Card) {
		if (editingCard?.id === card.id) {
			editingCard = null;
			return;
		}
		editingCard = card;
	}

	async function handleSaveCard(cardData: { id?: string } & Omit<Card, 'createdAt' | 'updatedAt'>) {
		try {
			const targetId = cardData.id || editingCard?.id;
			if (targetId) {
				const savedId = targetId;
				await cardsStore.updateCard({
					...(editingCard || {}),
					...cardData,
					id: targetId
				} as Card);
				editingCard = null;
				toastStore.show({ message: '💾 Scheda aggiornata con successo!' });
				setTimeout(() => {
					const el = document.getElementById(`admin-card-${savedId}`);
					if (el) {
						el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
					}
				}, 60);
			} else {
				await cardsStore.addCard(cardData as any);
				resetForm();
				toastStore.show({ message: '✨ Nuova scheda creata con successo!' });
			}
		} catch (err: any) {
			console.error('Errore durante il salvataggio della scheda:', err);
			toastStore.show({ message: `⚠️ ${err.message || 'Errore salvataggio scheda'}` });
			throw err;
		}
	}

	async function handleDeleteCard(id: string) {
		try {
			await cardsStore.deleteCard(id);
			if (editingCard?.id === id) {
				resetForm();
			}
			await loadTrash();
			toastStore.show({ message: '🗑️ Scheda spostata nel cestino!' });
		} catch (err: any) {
			console.error('Errore durante l\'eliminazione della scheda:', err);
			toastStore.show({ message: `⚠️ ${err.message || 'Errore eliminazione scheda'}` });
		}
	}

	async function handleRestoreCard(id: string) {
		try {
			await cardsStore.restoreCard(id);
			await loadTrash();
			toastStore.show({ message: '♻️ Scheda ripristinata con successo!' });
		} catch (err: any) {
			console.error('Errore ripristino scheda:', err);
			toastStore.show({ message: `⚠️ ${err.message || 'Errore ripristino scheda'}` });
		}
	}

	async function handlePermanentDeleteCard(id: string) {
		if (confirm('Sei sicuro di voler eliminare DEFINITIVAMENTE questa scheda e le sue immagini? Questa azione è irreversibile.')) {
			try {
				await cardsStore.permanentDeleteCard(id);
				trashCards = trashCards.filter((c) => c.id !== id);
				toastStore.show({ message: '✕ Scheda eliminata definitivamente' });
			} catch (err: any) {
				console.error('Errore eliminazione definitiva:', err);
				toastStore.show({ message: `⚠️ ${err.message || 'Errore eliminazione definitiva'}` });
			}
		}
	}

	function filterCardsByCategory(catName: string) {
		selectedCategoryFilter = catName;
		const listSection = document.querySelector('.list-section');
		if (listSection) {
			listSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	async function handleBatchRenameCategory(oldCat: string) {
		const trimmedNew = newCategoryName.trim();
		if (!trimmedNew) return;
		if (trimmedNew === oldCat) {
			categoryToRename = null;
			newCategoryName = '';
			return;
		}

		const destinationExists = categoryStats.some(
			(s) => s.category.toLowerCase() === trimmedNew.toLowerCase() && s.category !== oldCat
		);

		if (destinationExists) {
			if (
				!confirm(
					`La categoria "${trimmedNew}" esiste già.\n\nVuoi unire le schede di "${oldCat}" nella categoria "${trimmedNew}"?`
				)
			) {
				return;
			}
		}

		renamingInProgress = true;
		try {
			const count = await cardsStore.updateCategoryBatch(oldCat, trimmedNew);
			toastStore.show({
				message: `🏷️ Aggiornate ${count} schede con la nuova categoria "${trimmedNew}"`
			});
			categoryToRename = null;
			newCategoryName = '';
		} catch (err: any) {
			console.error('Errore durante la modifica della categoria:', err);
			toastStore.show({ message: `⚠️ ${err.message || 'Errore modifica categoria'}` });
		} finally {
			renamingInProgress = false;
		}
	}

	// Media cleanup state
	let mediaLoading = $state(false);
	let mediaInfo = $state<{
		totalFiles: number;
		totalBytes: number;
		referencedFiles: number;
		orphanedCount: number;
		orphanedBytes: number;
	} | null>(null);

	async function scanMedia() {
		mediaLoading = true;
		try {
			const res = await fetch('/api/admin/clean-uploads');
			if (res.ok) {
				mediaInfo = await res.json();
			} else {
				alert('Impossibile scansionare i file multimediali.');
			}
		} catch (err) {
			console.error('Errore durante scansione media:', err);
		} finally {
			mediaLoading = false;
		}
	}

	async function cleanOrphanedMedia() {
		if (!mediaInfo || mediaInfo.orphanedCount === 0) return;
		if (
			!confirm(
				`Vuoi eliminare definitivamente i ${mediaInfo.orphanedCount} file orfani non collegati ad alcuna scheda o appunto?`
			)
		) {
			return;
		}

		mediaLoading = true;
		try {
			const res = await fetch('/api/admin/clean-uploads', { method: 'POST' });
			if (res.ok) {
				const result = await res.json();
				alert(`Pulizia completata! Eliminati ${result.deletedCount} file (${result.freedFormatted} liberati).`);
				await scanMedia();
			} else {
				alert('Errore durante l\'eliminazione dei file orfani.');
			}
		} catch (err) {
			console.error('Errore durante pulizia media:', err);
		} finally {
			mediaLoading = false;
		}
	}

	function exportJSON() {
		const dataStr =
			'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(cards, null, 2));
		const downloadAnchor = document.createElement('a');
		downloadAnchor.setAttribute('href', dataStr);
		downloadAnchor.setAttribute(
			'download',
			`rail_focus_cards_backup_${new Date().toISOString().split('T')[0]}.json`
		);
		document.body.appendChild(downloadAnchor);
		downloadAnchor.click();
		downloadAnchor.remove();
		toastStore.show({ message: '📥 Backup JSON scaricato con successo!' });
	}

	function handleImportFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) return;

		const file = target.files[0];
		importFileName = file.name;

		const reader = new FileReader();
		reader.onload = (ev) => {
			try {
				const content = ev.target?.result as string;
				const parsed = JSON.parse(content);
				if (!Array.isArray(parsed)) {
					alert('Il file JSON selezionato non contiene una lista valida di schede.');
					return;
				}
				importedCardsData = parsed;
				isImportModalOpen = true;
			} catch (err) {
				alert('Errore nella lettura del file JSON.');
			} finally {
				target.value = '';
			}
		};
		reader.readAsText(file);
	}

	async function executeImport(mode: 'merge' | 'replace') {
		if (!importedCardsData) return;

		if (
			mode === 'replace' &&
			!confirm('⚠️ ATTENZIONE: Questa opzione cancellerà TUTTE le schede attuali nel database e le sostituirà con quelle del file. Continuare?')
		) {
			return;
		}

		isImporting = true;
		try {
			const res = await fetch('/api/admin/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode, cards: importedCardsData })
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Errore importazione');
			}

			const result = await res.json();
			toastStore.show({
				message: `✨ Importazione completata! ${result.insertedCount} inserite, ${result.updatedCount} aggiornate.`
			});
			isImportModalOpen = false;
			importedCardsData = null;
			await cardsStore.loadFromStorageOrApi();
		} catch (err: any) {
			console.error('Errore importazione backup:', err);
			toastStore.show({ message: `❌ ${err.message || 'Errore importazione'}` });
		} finally {
			isImporting = false;
		}
	}

	let filteredCards = $derived(
		cards.filter((c) => {
			const matchesCat =
				selectedCategoryFilter === 'Senza Categoria'
					? !c.category || !c.category.trim()
					: matchesCategory(c.category, selectedCategoryFilter);

			const q = searchQuery.toLowerCase().trim();
			const matchesQuery =
				!q ||
				c.title.toLowerCase().includes(q) ||
				(c.fullName && c.fullName.toLowerCase().includes(q)) ||
				(c.acronym && c.acronym.toLowerCase().includes(q)) ||
				c.description.toLowerCase().includes(q) ||
				(c.category && c.category.toLowerCase().includes(q));

			return matchesCat && matchesQuery;
		})
	);

	let filteredTrashCards = $derived(
		trashCards.filter((c) => {
			const q = searchQuery.toLowerCase().trim();
			return (
				!q ||
				c.title.toLowerCase().includes(q) ||
				(c.fullName && c.fullName.toLowerCase().includes(q)) ||
				(c.acronym && c.acronym.toLowerCase().includes(q)) ||
				c.description.toLowerCase().includes(q) ||
				(c.category && c.category.toLowerCase().includes(q))
			);
		})
	);

	let filteredUsers = $derived(
		users.filter((u) => {
			const q = usersSearchQuery.toLowerCase().trim();
			if (!q) return true;
			return (
				u.name.toLowerCase().includes(q) ||
				u.email.toLowerCase().includes(q) ||
				(u.discordId && u.discordId.includes(q)) ||
				u.id.toLowerCase().includes(q)
			);
		})
	);

	let filteredLogs = $derived(
		logs.filter((l) => {
			const matchesAction = logsActionFilter === 'ALL' || l.action === logsActionFilter;
			const q = logsSearchQuery.toLowerCase().trim();
			const matchesQuery =
				!q ||
				l.userName.toLowerCase().includes(q) ||
				(l.targetTitle && l.targetTitle.toLowerCase().includes(q)) ||
				l.action.toLowerCase().includes(q);
			return matchesAction && matchesQuery;
		})
	);
</script>

<div class="admin-container">
	{#if !user || !isAdmin}
		<!-- Login / Unauthorized View -->
		<div class="login-card duo-card" in:fade={{ duration: 200 }}>
			<div class="login-badge">Area Riservata</div>
			<h1 class="login-title">Pannello Amministratore</h1>
			<p class="login-desc">
				L'accesso al pannello di gestione è riservato esclusivamente all'amministratore autorizzato
				<strong>(Discord ID: 691289686093725736)</strong>.
			</p>

			{#if user && !isAdmin}
				<div class="error-banner">
					⚠️ Non disponi dei permessi di amministratore per questo account (ID utente: {user.userId || user.id}).
				</div>
			{:else if error}
				<div class="error-banner">
					⚠️ Errore di autenticazione: {error === 'unauthorized'
						? 'Utente Discord non autorizzato!'
						: error}
				</div>
			{/if}

			<button type="button" class="duo-btn discord-login-btn flex-btn" onclick={() => loginWithDiscord('/admin')}>
				<svg class="discord-icon-mini" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
					<path
						d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
					/>
				</svg>
				Accedi con Discord
			</button>
		</div>
	{:else}
		<!-- Admin Panel Dashboard -->
		<div class="admin-panel" in:fade={{ duration: 180 }}>
			<!-- Compact Collapsible Sezione Gestione Categorie -->
			<div class="categories-accordion-card duo-card">
				<button
					type="button"
					class="accordion-toggle-btn"
					onclick={() => (isCategoryAccordionOpen = !isCategoryAccordionOpen)}
				>
					<div class="accordion-title-group">
						<span class="accordion-icon">🏷️</span>
						<span class="accordion-title">Gestione Categorie ({categoryStats.length})</span>
					</div>
					<span class="accordion-arrow">{isCategoryAccordionOpen ? '▲ Riduci' : '▼ Espandi'}</span>
				</button>

				{#if isCategoryAccordionOpen}
					<div class="accordion-content" transition:slide={{ duration: 180 }}>
						<div class="category-search-box">
							<input
								type="text"
								bind:value={categorySearchQuery}
								placeholder="Cerca tra le categorie..."
								class="duo-input cat-search-input"
							/>
						</div>

						<div class="category-chips-scroll">
							{#each filteredCategoryStats as stat}
								<div
									class="category-stat-item duo-card"
									class:is-renaming-active={categoryToRename === stat.category}
								>
									<div class="stat-main">
										<span class="category-name">{stat.category}</span>
										<span class="category-count-badge">{stat.count} card</span>
									</div>

									{#if categoryToRename === stat.category}
										<div class="rename-inline-box">
											<div class="rename-fields-wrapper">
												<input
													type="text"
													bind:value={newCategoryName}
													placeholder="Nuovo nome categoria..."
													class="duo-input rename-input"
													onkeydown={(e) => {
														if (e.key === 'Enter') {
															e.preventDefault();
															handleBatchRenameCategory(stat.category);
														} else if (e.key === 'Escape') {
															categoryToRename = null;
															newCategoryName = '';
														}
													}}
												/>

												<select
													bind:value={newCategoryName}
													class="duo-input quick-merge-select"
													title="Unisci in un'altra categoria esistente"
												>
													<option value={newCategoryName} disabled>-- Unisci a esistente --</option>
													{#each categoryStats.filter((s) => s.category !== stat.category) as targetStat}
														<option value={targetStat.category}>
															Unisci in "{targetStat.category}" ({targetStat.count} card)
														</option>
													{/each}
												</select>
											</div>

											<div class="rename-actions-row">
												<button
													class="duo-btn duo-btn-green save-cat-btn"
													disabled={renamingInProgress || !newCategoryName.trim()}
													onclick={() => handleBatchRenameCategory(stat.category)}
												>
													{renamingInProgress ? '⏳...' : '💾 Salva'}
												</button>
												<button
													class="duo-btn duo-btn-gray cancel-cat-btn"
													onclick={() => {
														categoryToRename = null;
														newCategoryName = '';
													}}
												>
													✕
												</button>
											</div>
										</div>
									{:else}
										<div class="category-card-actions">
											<button
												class="cat-action-btn filter"
												onclick={() => filterCardsByCategory(stat.category)}
												title="Filtra schede"
											>
												🔍 Filtra
											</button>
											<button
												class="cat-action-btn rename"
												onclick={() => {
													categoryToRename = stat.category;
													newCategoryName = stat.category;
												}}
												title="Rinomina categoria"
											>
												✏️ Rinomina
											</button>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Media Cleaner Panel -->
			<div class="media-cleaner-card duo-card">
				<div class="cleaner-header">
					<div>
						<h2 class="section-title">🧹 Pulizia File & Immagini Non Utilizzate</h2>
						<p class="section-subtitle">
							Scansiona la cartella degli upload per eliminare i file non collegati alle schede.
						</p>
					</div>
					<button class="duo-btn duo-btn-blue scan-btn" disabled={mediaLoading} onclick={scanMedia}>
						{mediaLoading ? '⏳ Scansione...' : '🔍 Scansiona'}
					</button>
				</div>

				{#if mediaInfo}
					<div class="media-stats-grid" transition:slide={{ duration: 160 }}>
						<div class="media-stat-box">
							<span class="m-val">{mediaInfo.totalFiles}</span>
							<span class="m-lbl">File Totali ({((mediaInfo.totalBytes || 0) / 1024 / 1024).toFixed(2)} MB)</span>
						</div>
						<div class="media-stat-box success">
							<span class="m-val">{mediaInfo.referencedFiles}</span>
							<span class="m-lbl">In Uso</span>
						</div>
						<div class="media-stat-box warning">
							<span class="m-val">{mediaInfo.orphanedCount}</span>
							<span class="m-lbl">Orfani ({((mediaInfo.orphanedBytes || 0) / 1024 / 1024).toFixed(2)} MB)</span>
						</div>
					</div>

					{#if mediaInfo.orphanedCount > 0}
						<div class="clean-action-box" transition:slide={{ duration: 160 }}>
							<button
								class="duo-btn duo-btn-red clean-btn"
								disabled={mediaLoading}
								onclick={cleanOrphanedMedia}
							>
								{mediaLoading
									? '⏳ Eliminazione...'
									: `🗑️ Elimina Definitivamente ${mediaInfo.orphanedCount} File Orfani`}
							</button>
						</div>
					{:else}
						<p class="all-clean-text">✨ Tutti i file multimediali sono collegati e in uso!</p>
					{/if}
				{/if}
			</div>

			<!-- Navigazione Tab Admin -->
			<div class="admin-tabs-row">
				<button
					class="admin-tab-btn"
					class:active={activeTab === 'active'}
					onclick={() => (activeTab = 'active')}
				>
					📋 Schede ({cards.length})
				</button>
				<button
					class="admin-tab-btn users-tab"
					class:active={activeTab === 'users'}
					onclick={() => {
						activeTab = 'users';
						loadUsers();
					}}
				>
					👥 Utenti ({users.length})
				</button>
				<button
					class="admin-tab-btn logs-tab"
					class:active={activeTab === 'logs'}
					onclick={() => {
						activeTab = 'logs';
						loadLogs();
					}}
				>
					📜 Log Azioni ({logs.length})
				</button>
				<button
					class="admin-tab-btn trash-tab"
					class:active={activeTab === 'trash'}
					onclick={() => {
						activeTab = 'trash';
						loadTrash();
					}}
				>
					🗑️ Cestino ({trashCards.length})
				</button>
			</div>

			{#if activeTab === 'active'}
				<!-- List Sezione Schede Attive -->
				<div class="list-section" in:fade={{ duration: 150 }}>
					<div class="list-header">
						<div class="list-filters">
							<select bind:value={selectedCategoryFilter} class="duo-input category-select-filter">
								<option value="ALL">Tutte le Categorie ({categoryStats.length})</option>
								{#each categoryStats as stat}
									<option value={stat.category}>{stat.category} ({stat.count})</option>
								{/each}
							</select>

							<input
								type="text"
								bind:value={searchQuery}
								placeholder="Cerca schede..."
								class="search-input duo-input"
							/>
						</div>
					</div>

					<div class="cards-list">
						{#if filteredCards.length === 0}
							<div class="empty-list-box duo-card">
								Nessuna scheda trovata con i filtri correnti.
							</div>
						{:else}
							{#each filteredCards as card (card.id)}
								<div
									id={`admin-card-${card.id}`}
									class="admin-card-item duo-card animated-card"
									class:is-editing-this={editingCard?.id === card.id}
								>
									{#if editingCard?.id === card.id}
										<div class="inline-edit-wrapper" transition:slide={{ duration: 200 }}>
											<div class="inline-edit-header">
												<div class="inline-edit-title">
													<span>✏️ Modifica Scheda: <strong>"{card.title}"</strong></span>
												</div>
												<button type="button" class="close-inline-btn" onclick={resetForm}>
													✕ Chiudi
												</button>
											</div>

											<CardForm
												initialCard={editingCard}
												onSave={handleSaveCard}
												onCancel={resetForm}
												submitLabel="💾 Salva Modifiche"
											/>
										</div>
									{:else}
										<div class="card-row-wrapper">
											<div class="card-main-info">
												<div class="item-title-row">
													<h3 class="card-item-title">{card.title}</h3>
													{#if card.acronym}
														<span class="acronym-badge">[{card.acronym}]</span>
													{/if}
													{#if card.category}
														<span class="category-pill">{card.category}</span>
													{/if}
													{#if !card.showInWiki}
														<span class="hidden-wiki-badge">Nascosta in Wiki</span>
													{/if}
												</div>
												{#if card.fullName}
													<div class="full-name-preview">{card.fullName}</div>
												{/if}
												<p class="card-item-desc">{card.description}</p>
											</div>

											<div class="item-actions">
												<button
													class="duo-btn duo-btn-blue edit-btn"
													onclick={() => startEdit(card)}
													title="Modifica scheda"
												>
													✏️ Modifica
												</button>
												<button
													class="duo-btn duo-btn-red delete-btn"
													onclick={() => handleDeleteCard(card.id)}
													title="Sposta scheda nel cestino"
												>
													🗑️ Cestina
												</button>
											</div>
										</div>
									{/if}
								</div>
							{/each}
						{/if}
					</div>
				</div>
			{:else if activeTab === 'users'}
				<!-- Sezione Gestione Utenti -->
				<div class="users-section" in:fade={{ duration: 150 }}>
					<!-- Quick Stats Grid -->
					<div class="users-summary-grid">
						<div class="user-summary-card duo-card">
							<span class="us-val">{users.length}</span>
							<span class="us-lbl">👥 Utenti Registrati</span>
						</div>
						<div class="user-summary-card duo-card gold">
							<span class="us-val">{users.filter((u) => u.role === 'admin').length}</span>
							<span class="us-lbl">👑 Amministratori</span>
						</div>
						<div class="user-summary-card duo-card blue">
							<span class="us-val">{users.reduce((acc, u) => acc + (u.notesCount || 0), 0)}</span>
							<span class="us-lbl">📝 Note Salvate</span>
						</div>
					</div>

					<!-- Search & Refresh Toolbar -->
					<div class="users-toolbar">
						<div class="search-wrap">
							<span class="search-ico">🔍</span>
							<input
								type="text"
								bind:value={usersSearchQuery}
								placeholder="Cerca utente per nome, email o Discord ID..."
								class="duo-input user-search-input"
							/>
							{#if usersSearchQuery}
								<button type="button" class="clear-search-btn" onclick={() => (usersSearchQuery = '')}>✕</button>
							{/if}
						</div>
						<button type="button" class="duo-btn duo-btn-subtle refresh-btn" onclick={loadUsers} disabled={usersLoading}>
							{usersLoading ? '⏳' : '🔄'} Aggiorna
						</button>
					</div>

					<!-- Users List -->
					{#if usersLoading && users.length === 0}
						<div class="empty-list-box duo-card">
							⏳ Caricamento elenco utenti in corso...
						</div>
					{:else if filteredUsers.length === 0}
						<div class="empty-list-box duo-card">
							Nessun utente trovato con i filtri correnti.
						</div>
					{:else}
						<div class="users-list-grid">
							{#each filteredUsers as u (u.id)}
								<div class="user-card-item duo-card animated-card" class:is-admin={u.role === 'admin'}>
									<div class="user-card-header">
										<div class="user-avatar-wrap">
											{#if u.image}
												<img src={u.image} alt={u.name} class="user-avatar-img" />
											{:else}
												<div class="user-avatar-fallback">
													{u.name ? u.name.charAt(0).toUpperCase() : '👤'}
												</div>
											{/if}
											{#if u.role === 'admin'}
												<span class="admin-crown-badge" title="Amministratore">👑</span>
											{/if}
										</div>

										<div class="user-meta-info">
											<div class="user-name-row">
												<strong class="user-display-name">{u.name || 'Utente Senza Nome'}</strong>
												{#if u.role === 'admin'}
													<span class="role-chip admin">👑 Admin</span>
												{:else}
													<span class="role-chip user">👤 Utente</span>
												{/if}
											</div>
											<span class="user-email-text">{u.email}</span>
											{#if u.discordId}
												<span class="user-discord-tag">Discord ID: <code>{u.discordId}</code></span>
											{/if}
										</div>
									</div>

									<div class="user-card-stats-row">
										<span class="user-stat-chip">
											📝 {u.notesCount} {u.notesCount === 1 ? 'appunto' : 'appunti'}
										</span>
										{#if u.stats?.cardsStudied}
											<span class="user-stat-chip">
												🃏 {u.stats.cardsStudied} studiate
											</span>
										{/if}
										<span class="user-date-chip">
											Registrato: {new Date(u.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
										</span>
									</div>

									<div class="user-card-actions">
										{#if u.isHardcodedAdmin}
											<span class="protected-admin-pill" title="Definito in DISCORD_ADMIN_IDS">
												🛡️ Admin Principale (Protetto)
											</span>
										{:else if u.role === 'admin'}
											<button
												type="button"
												class="duo-btn duo-btn-red toggle-role-btn"
												onclick={() => toggleUserRole(u)}
											>
												👤 Revoca Permessi Admin
											</button>
										{:else}
											<button
												type="button"
												class="duo-btn duo-btn-theme toggle-role-btn"
												onclick={() => toggleUserRole(u)}
											>
												👑 Assegna Ruolo Admin
											</button>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else if activeTab === 'logs'}
				<!-- Sezione Log Azioni Amministratori -->
				<div class="logs-section" in:fade={{ duration: 150 }}>
					<!-- Toolbar Filtri & Azioni Log -->
					<div class="logs-toolbar duo-card">
						<div class="logs-filters-row">
							<select bind:value={logsActionFilter} class="duo-input log-action-select">
								<option value="ALL">Tutte le Azioni ({logs.length})</option>
								<option value="create_card">✨ Creazione Scheda</option>
								<option value="update_card">✏️ Modifica Scheda</option>
								<option value="trash_card">🗑️ Cestinamento Scheda</option>
								<option value="restore_card">♻️ Ripristino Scheda</option>
								<option value="permanent_delete_card">✕ Eliminazione Definitiva</option>
								<option value="set_role_admin">👑 Promozione Admin</option>
								<option value="remove_role_admin">👤 Revoca Admin</option>
								<option value="rename_category">🏷️ Rinomina Categoria</option>
								<option value="import_cards">📥 Importazione Backup</option>
								<option value="clean_media">🧹 Pulizia Media</option>
							</select>

							<div class="search-wrap log-search-wrap">
								<span class="search-ico">🔍</span>
								<input
									type="text"
									bind:value={logsSearchQuery}
									placeholder="Cerca nei log..."
									class="duo-input log-search-input"
								/>
								{#if logsSearchQuery}
									<button type="button" class="clear-search-btn" onclick={() => (logsSearchQuery = '')}>✕</button>
								{/if}
							</div>
						</div>

						<div class="logs-buttons-row">
							<button type="button" class="duo-btn duo-btn-subtle refresh-btn" onclick={loadLogs} disabled={logsLoading}>
								{logsLoading ? '⏳' : '🔄'} Aggiorna
							</button>
							{#if logs.length > 0}
								<button type="button" class="duo-btn duo-btn-red clear-logs-btn" onclick={clearAllLogs}>
									🧹 Svuota Registro
								</button>
							{/if}
						</div>
					</div>

					<!-- Logs Timeline List -->
					{#if logsLoading && logs.length === 0}
						<div class="empty-list-box duo-card">
							⏳ Caricamento registro log in corso...
						</div>
					{:else if filteredLogs.length === 0}
						<div class="empty-list-box duo-card">
							Nessuna azione registrata con i filtri correnti.
						</div>
					{:else}
						<div class="logs-timeline-list">
							{#each filteredLogs as log (log.id)}
								{@const badge = getActionBadge(log.action)}
								<div class="log-item-card duo-card animated-card">
									<div class="log-item-header">
										<div class="log-admin-user">
											{#if log.userAvatar}
												<img src={log.userAvatar} alt={log.userName} class="log-admin-avatar" />
											{:else}
												<div class="log-admin-avatar fallback">
													{log.userName ? log.userName.charAt(0).toUpperCase() : 'A'}
												</div>
											{/if}
											<div class="log-admin-meta">
												<strong class="log-admin-name">{log.userName}</strong>
												<span class="log-timestamp">
													{new Date(log.createdAt).toLocaleString('it-IT', {
														day: '2-digit',
														month: 'short',
														year: 'numeric',
														hour: '2-digit',
														minute: '2-digit',
														second: '2-digit'
													})}
												</span>
											</div>
										</div>

										<div
											class="log-action-badge"
											style="color: {badge.color}; background: {badge.bg}; border-color: {badge.color}40;"
										>
											<span>{badge.icon}</span>
											<span>{badge.label}</span>
										</div>
									</div>

									{#if log.targetTitle}
										<div class="log-target-row">
											<span class="target-prefix">Target:</span>
											<strong class="target-title">"{log.targetTitle}"</strong>
											{#if log.targetType}
												<span class="target-type-pill">({log.targetType})</span>
											{/if}
										</div>
									{/if}

									{#if log.details && Object.keys(log.details).length > 0}
										<div class="log-details-accordion">
											<div class="log-details-pills">
												{#each Object.entries(log.details) as [key, val]}
													{#if val !== undefined && val !== null && typeof val !== 'object'}
														<span class="detail-pill">
															<strong>{key}:</strong> {val}
														</span>
													{/if}
												{/each}
											</div>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else if activeTab === 'trash'}
				<!-- List Sezione Cestino -->
				<div class="list-section" in:fade={{ duration: 150 }}>
					<div class="trash-banner">
						⚠️ Le schede nel cestino non sono visibili nell'apprendimento. Puoi ripristinarle o eliminarle per sempre.
					</div>

					<div class="list-header">
						<input
							type="text"
							bind:value={searchQuery}
							placeholder="Cerca nel cestino..."
							class="search-input duo-input full-width"
						/>
					</div>

					<div class="cards-list">
						{#if filteredTrashCards.length === 0}
							<div class="empty-list-box duo-card">
								✨ Il cestino è vuoto.
							</div>
						{:else}
							{#each filteredTrashCards as card (card.id)}
								<div class="admin-card-item duo-card in-trash animated-card">
									<div class="card-row-wrapper">
										<div class="card-main-info">
											<div class="item-title-row">
												<h3 class="card-item-title">{card.title}</h3>
												{#if card.acronym}
													<span class="acronym-badge">[{card.acronym}]</span>
												{/if}
												{#if card.category}
													<span class="category-pill">{card.category}</span>
												{/if}
												<span class="trash-date-pill">Eliminata</span>
											</div>
											<p class="card-item-desc">{card.description}</p>
										</div>

										<div class="item-actions">
											<button
												class="duo-btn duo-btn-green restore-btn"
												onclick={() => handleRestoreCard(card.id)}
												title="Ripristina la scheda nelle schede attive"
											>
												♻️ Ripristina
											</button>
											<button
												class="duo-btn duo-btn-red perm-delete-btn"
												onclick={() => handlePermanentDeleteCard(card.id)}
												title="Elimina definitivamente la scheda e le sue immagini"
											>
												✕ Elimina Definitivamente
											</button>
										</div>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			{/if}

			<!-- Sezione Backup & Ripristino Schede (In fondo) -->
			<div class="backup-section-card duo-card">
				<div class="backup-header">
					<div>
						<h2 class="section-title">💾 Backup & Ripristino Database</h2>
						<p class="section-subtitle">Esporta o ripristina l'intero database delle schede informative in formato JSON.</p>
					</div>

					<div class="backup-buttons-row">
						<button type="button" class="duo-btn duo-btn-blue backup-action-btn" onclick={exportJSON}>
							📥 Esporta Backup JSON
						</button>

						<label class="duo-btn duo-btn-purple backup-action-btn import-label-btn">
							<span>📤 Importa Backup JSON</span>
							<input
								type="file"
								accept=".json,application/json"
								bind:this={fileInputRef}
								onchange={handleImportFileSelect}
								class="hidden-file-input"
							/>
						</label>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Modal di Scelta Modalità Importazione -->
{#if isImportModalOpen && importedCardsData}
	<div class="import-modal-backdrop" transition:fade={{ duration: 150 }}>
		<div class="import-modal-content duo-card" transition:slide={{ duration: 200 }}>
			<div class="modal-header">
				<h3>📤 Importazione Backup Database</h3>
				<button type="button" class="close-modal-x" onclick={() => (isImportModalOpen = false)}>✕</button>
			</div>

			<div class="modal-body">
				<p>
					Stai per importare il file <strong>{importFileName}</strong> contenente <strong>{importedCardsData.length} schede</strong>.
				</p>
				<p class="modal-hint">Scegli come desideri procedere con l'importazione dei dati:</p>

				<div class="import-options-grid">
					<button
						type="button"
						class="import-option-card duo-card"
						disabled={isImporting}
						onclick={() => executeImport('merge')}
					>
						<div class="opt-icon">🔄</div>
						<div class="opt-content">
							<strong>Unisci & Aggiorna</strong>
							<span>Aggiorna le schede esistenti e aggiunge le nuove senza cancellare le altre.</span>
						</div>
					</button>

					<button
						type="button"
						class="import-option-card danger-opt duo-card"
						disabled={isImporting}
						onclick={() => executeImport('replace')}
					>
						<div class="opt-icon">⚠️</div>
						<div class="opt-content">
							<strong>Sostituisci Tutto</strong>
							<span>Cancella tutte le schede attuali e le rimpiazza completamente con il backup.</span>
						</div>
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.admin-container {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		max-width: 800px;
		margin: 0 auto;
		width: 100%;
		box-sizing: border-box;
		padding-bottom: 2.5rem;
	}

	.admin-panel {
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
	}

	/* Accordion Categorie */
	.categories-accordion-card {
		padding: 0.75rem 1rem;
		background: var(--card-bg);
		border-radius: 16px;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.accordion-toggle-btn {
		background: none;
		border: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		cursor: pointer;
		padding: 0.25rem 0;
	}

	.accordion-title-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.accordion-icon {
		font-size: 1.1rem;
	}

	.accordion-title {
		font-size: 0.92rem;
		font-weight: 900;
		color: var(--text-color);
	}

	.accordion-arrow {
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--accent-color);
	}

	.accordion-content {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		border-top: 1px solid var(--border-color);
		padding-top: 0.75rem;
	}

	.category-chips-scroll {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.6rem;
		max-height: 260px;
		overflow-y: auto;
		padding-right: 0.25rem;
	}

	.category-stat-item {
		padding: 0.65rem 0.85rem;
		background: var(--card-bg-subtle);
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.category-stat-item:hover {
		transform: translateY(-2px);
	}

	.stat-main {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.category-name {
		font-size: 0.82rem;
		font-weight: 800;
		color: var(--text-color);
	}

	.category-count-badge {
		font-size: 0.68rem;
		font-weight: 900;
		background: var(--accent-light-bg);
		color: var(--accent-color);
		padding: 0.15rem 0.45rem;
		border-radius: 6px;
	}

	.category-card-actions {
		display: flex;
		gap: 0.4rem;
	}

	.cat-action-btn {
		font-size: 0.72rem;
		font-weight: 800;
		padding: 0.25rem 0.5rem;
		border-radius: 8px;
		border: 1px solid var(--border-color);
		background: var(--card-bg);
		color: var(--text-color);
		cursor: pointer;
	}

	.cat-action-btn.filter:hover {
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.cat-action-btn.rename:hover {
		border-color: var(--yellow-color);
		color: var(--yellow-color);
	}

	.rename-inline-box {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.rename-fields-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.rename-input,
	.quick-merge-select {
		font-size: 0.78rem;
		padding: 0.35rem 0.6rem;
	}

	.rename-actions-row {
		display: flex;
		gap: 0.35rem;
	}

	.save-cat-btn,
	.cancel-cat-btn {
		font-size: 0.72rem;
		padding: 0.3rem 0.6rem;
	}

	/* Media Cleaner */
	.media-cleaner-card {
		padding: 0.85rem 1.15rem;
		background: var(--card-bg);
		border-radius: 16px;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.cleaner-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.section-title {
		font-size: 0.92rem;
		font-weight: 900;
		margin: 0;
		color: var(--text-color);
	}

	.section-subtitle {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin: 0.15rem 0 0 0;
	}

	.scan-btn {
		font-size: 0.78rem;
		padding: 0.45rem 0.85rem;
	}

	.media-stats-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.6rem;
	}

	.media-stat-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.5rem;
		background: var(--card-bg-subtle);
		border-radius: 10px;
		border: 1px solid var(--border-color);
	}

	.m-val {
		font-size: 1.1rem;
		font-weight: 900;
		color: var(--text-color);
	}

	.m-lbl {
		font-size: 0.68rem;
		font-weight: 700;
		color: var(--text-muted);
		text-align: center;
	}

	.media-stat-box.success .m-val {
		color: #22c55e;
	}

	.media-stat-box.warning .m-val {
		color: #f59e0b;
	}

	.clean-btn {
		width: 100%;
		font-size: 0.85rem;
		padding: 0.65rem 1rem;
	}

	.all-clean-text {
		font-size: 0.8rem;
		font-weight: 800;
		color: #22c55e;
		margin: 0;
	}

	/* Tabs */
	.admin-tabs-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.admin-tabs-row::-webkit-scrollbar {
		display: none;
	}

	.admin-tab-btn {
		padding: 0.7rem 0.6rem;
		font-size: 0.82rem;
		font-weight: 900;
		border-radius: 14px;
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
		text-align: center;
	}

	.admin-tab-btn:hover {
		border-color: var(--text-muted);
		color: var(--text-color);
	}

	.admin-tab-btn.active {
		border-color: var(--accent-color);
		background: var(--accent-light-bg);
		color: var(--accent-color);
	}

	.admin-tab-btn.users-tab.active {
		border-color: #06b6d4;
		background: rgba(6, 182, 212, 0.12);
		color: #06b6d4;
	}

	.admin-tab-btn.logs-tab.active {
		border-color: #8b5cf6;
		background: rgba(139, 92, 246, 0.12);
		color: #8b5cf6;
	}

	.admin-tab-btn.trash-tab.active {
		border-color: #ef4444;
		background: rgba(239, 68, 68, 0.12);
		color: #ef4444;
	}

	/* 👥 Users Section Styles */
	.users-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.users-summary-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}

	.user-summary-card {
		padding: 0.85rem 1rem;
		border-radius: 14px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.25rem;
		background: var(--card-bg-subtle);
	}

	.user-summary-card.gold .us-val {
		color: #eab308;
	}

	.user-summary-card.blue .us-val {
		color: #3b82f6;
	}

	.us-val {
		font-size: 1.4rem;
		font-weight: 900;
		color: var(--text-color);
	}

	.us-lbl {
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-muted);
	}

	.users-toolbar {
		display: flex;
		gap: 0.65rem;
		align-items: center;
	}

	.search-wrap {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		border-radius: 12px;
		padding: 0.4rem 0.75rem;
		position: relative;
	}

	.search-wrap .search-ico {
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.user-search-input,
	.log-search-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-color);
		font-size: 0.85rem;
		font-weight: 700;
		padding: 0;
	}

	.clear-search-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 0.8rem;
		cursor: pointer;
		padding: 0 0.2rem;
	}

	.refresh-btn {
		font-size: 0.8rem;
		padding: 0.55rem 0.85rem;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.users-list-grid {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.user-card-item {
		padding: 1rem;
		border-radius: 16px;
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		transition: all 0.15s ease;
	}

	.user-card-item:hover {
		border-color: var(--accent-color);
		transform: translateY(-1px);
	}

	.user-card-item.is-admin {
		border-color: rgba(234, 179, 8, 0.4);
		background: linear-gradient(to right, rgba(234, 179, 8, 0.04), var(--card-bg));
	}

	.user-card-header {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.user-avatar-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.user-avatar-img,
	.user-avatar-fallback {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		object-fit: cover;
		border: 1.5px solid var(--border-color);
	}

	.user-avatar-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--accent-light-bg);
		color: var(--accent-color);
		font-weight: 900;
		font-size: 1.2rem;
	}

	.admin-crown-badge {
		position: absolute;
		bottom: -4px;
		right: -4px;
		font-size: 0.85rem;
		background: var(--card-bg);
		border-radius: 50%;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
	}

	.user-meta-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		flex: 1;
		min-width: 0;
	}

	.user-name-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.user-display-name {
		font-size: 0.95rem;
		font-weight: 900;
		color: var(--text-color);
	}

	.role-chip {
		font-size: 0.68rem;
		font-weight: 900;
		padding: 0.15rem 0.45rem;
		border-radius: 6px;
	}

	.role-chip.admin {
		background: rgba(234, 179, 8, 0.16);
		color: #eab308;
		border: 1px solid rgba(234, 179, 8, 0.35);
	}

	.role-chip.user {
		background: var(--card-bg-subtle);
		color: var(--text-muted);
		border: 1px solid var(--border-color);
	}

	.user-email-text {
		font-size: 0.78rem;
		color: var(--text-muted);
		word-break: break-all;
	}

	.user-discord-tag {
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.user-discord-tag code {
		background: var(--card-bg-subtle);
		padding: 0.1rem 0.3rem;
		border-radius: 4px;
		font-size: 0.68rem;
	}

	.user-card-stats-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
	}

	.user-stat-chip,
	.user-date-chip {
		font-size: 0.72rem;
		font-weight: 750;
		color: var(--text-muted);
		background: var(--card-bg-subtle);
		padding: 0.2rem 0.5rem;
		border-radius: 8px;
		border: 1px solid var(--border-color);
	}

	.user-card-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding-top: 0.35rem;
		border-top: 1px solid var(--border-color);
	}

	.protected-admin-pill {
		font-size: 0.75rem;
		font-weight: 800;
		color: #eab308;
		background: rgba(234, 179, 8, 0.12);
		border: 1px solid rgba(234, 179, 8, 0.3);
		padding: 0.4rem 0.8rem;
		border-radius: 10px;
	}

	.toggle-role-btn {
		font-size: 0.78rem;
		padding: 0.45rem 0.9rem;
	}

	/* 📜 Logs Section Styles */
	.logs-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.logs-toolbar {
		padding: 0.85rem 1rem;
		border-radius: 16px;
		background: var(--card-bg);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.logs-filters-row {
		display: flex;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.log-action-select {
		flex: 1;
		min-width: 180px;
		font-size: 0.82rem;
		padding: 0.45rem 0.75rem;
	}

	.log-search-wrap {
		flex: 1.5;
		min-width: 200px;
	}

	.logs-buttons-row {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.clear-logs-btn {
		font-size: 0.78rem;
		padding: 0.5rem 0.85rem;
	}

	.logs-timeline-list {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.log-item-card {
		padding: 0.85rem 1rem;
		border-radius: 14px;
		background: var(--card-bg);
		border: 1.5px solid var(--border-color);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		transition: transform 0.12s ease;
	}

	.log-item-card:hover {
		transform: translateY(-1px);
		border-color: var(--accent-color);
	}

	.log-item-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.log-admin-user {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	.log-admin-avatar {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		object-fit: cover;
	}

	.log-admin-avatar.fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--accent-light-bg);
		color: var(--accent-color);
		font-size: 0.75rem;
		font-weight: 900;
	}

	.log-admin-meta {
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
	}

	.log-admin-name {
		font-size: 0.82rem;
		font-weight: 850;
		color: var(--text-color);
	}

	.log-timestamp {
		font-size: 0.68rem;
		color: var(--text-muted);
		font-weight: 600;
	}

	.log-action-badge {
		font-size: 0.72rem;
		font-weight: 900;
		padding: 0.2rem 0.55rem;
		border-radius: 8px;
		border: 1px solid transparent;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		white-space: nowrap;
	}

	.log-target-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8rem;
		color: var(--text-color);
		background: var(--card-bg-subtle);
		padding: 0.3rem 0.6rem;
		border-radius: 8px;
		flex-wrap: wrap;
	}

	.target-prefix {
		color: var(--text-muted);
		font-weight: 700;
		font-size: 0.72rem;
	}

	.target-title {
		color: var(--text-color);
	}

	.target-type-pill {
		font-size: 0.68rem;
		color: var(--text-muted);
		font-weight: 700;
	}

	.log-details-pills {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.detail-pill {
		font-size: 0.68rem;
		background: var(--card-bg-subtle);
		border: 1px solid var(--border-color);
		padding: 0.15rem 0.4rem;
		border-radius: 6px;
		color: var(--text-muted);
	}

	.detail-pill strong {
		color: var(--text-color);
	}

	/* Responsive Mobile Queries */
	@media (max-width: 640px) {
		.admin-tabs-row {
			grid-template-columns: repeat(2, 1fr);
		}

		.users-summary-grid {
			grid-template-columns: 1fr;
		}

		.user-card-actions {
			justify-content: stretch;
		}

		.user-card-actions button {
			width: 100%;
		}

		.logs-filters-row {
			flex-direction: column;
		}
	}

	/* List Section */
	.list-section {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.trash-banner {
		padding: 0.75rem 1rem;
		background: rgba(239, 68, 68, 0.08);
		border: 1.5px solid #ef4444;
		border-radius: 12px;
		font-size: 0.82rem;
		color: var(--text-color);
		font-weight: 700;
	}

	.list-header {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.list-filters {
		display: flex;
		gap: 0.5rem;
	}

	.category-select-filter {
		max-width: 240px;
		font-size: 0.82rem;
	}

	.search-input {
		flex: 1;
		font-size: 0.82rem;
	}

	.search-input.full-width {
		width: 100%;
	}

	.cards-list {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.admin-card-item {
		padding: 0.85rem 1.15rem;
		background: var(--card-bg);
		border-radius: 16px;
		transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
	}

	.animated-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
	}

	.card-row-wrapper {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.85rem;
	}

	@media (max-width: 650px) {
		.card-row-wrapper {
			flex-direction: column;
		}

		.item-actions {
			width: 100%;
			justify-content: flex-end;
		}
	}

	.card-main-info {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		flex: 1;
		min-width: 0;
	}

	.item-title-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
	}

	.card-item-title {
		font-size: 1.05rem;
		font-weight: 900;
		color: var(--text-color);
		margin: 0;
	}

	.acronym-badge {
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--accent-color);
	}

	.full-name-preview {
		font-size: 0.78rem;
		color: var(--text-muted);
		font-weight: 700;
	}

	.category-pill,
	.hidden-wiki-badge,
	.trash-date-pill {
		font-size: 0.7rem;
		font-weight: 800;
		padding: 0.15rem 0.45rem;
		border-radius: 6px;
		background: var(--card-bg-subtle);
		color: var(--text-muted);
		border: 1px solid var(--border-color);
	}

	.hidden-wiki-badge {
		color: #ef4444;
		border-color: rgba(239, 68, 68, 0.4);
		background: rgba(239, 68, 68, 0.08);
	}

	.trash-date-pill {
		color: #f59e0b;
	}

	.card-item-desc {
		font-size: 0.85rem;
		color: var(--text-muted);
		line-height: 1.45;
		margin: 0;
		word-break: break-word;
	}

	.item-actions {
		display: flex;
		gap: 0.4rem;
		flex-shrink: 0;
		align-items: center;
	}

	/* Theme Dynamic Edit Button */
	.duo-btn-theme {
		background: var(--brand-color);
		border-color: var(--brand-depth);
		border-bottom-width: 4px;
		color: var(--brand-text, #ffffff);
	}

	.duo-btn-theme:hover {
		background: var(--brand-hover);
		filter: brightness(1.05);
	}

	.edit-btn,
	.delete-btn,
	.restore-btn,
	.perm-delete-btn {
		font-size: 0.78rem;
		padding: 0.4rem 0.75rem;
		white-space: nowrap;
	}

	.inline-edit-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		width: 100%;
	}

	.inline-edit-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 0.5rem;
		border-bottom: 1.5px solid var(--border-color);
	}

	.inline-edit-title {
		font-size: 0.95rem;
		font-weight: 900;
		color: var(--brand-color);
	}

	.close-inline-btn {
		background: none;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 800;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
	}

	.close-inline-btn:hover {
		color: var(--text-color);
		border-color: var(--text-color);
	}

	.empty-list-box {
		padding: 2rem;
		text-align: center;
		color: var(--text-muted);
		font-size: 0.88rem;
		font-weight: 700;
		background: var(--card-bg);
		border-radius: 16px;
	}

	/* Backup Section */
	.backup-section-card {
		padding: 1rem 1.15rem;
		background: var(--card-bg);
		border-radius: 16px;
	}

	.backup-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.85rem;
	}

	.backup-buttons-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.backup-action-btn {
		font-size: 0.8rem;
		padding: 0.5rem 0.9rem;
		cursor: pointer;
	}

	.import-label-btn {
		position: relative;
		overflow: hidden;
		display: inline-flex;
		align-items: center;
	}

	.hidden-file-input {
		display: none;
	}

	/* Import Modal */
	.import-modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.import-modal-content {
		max-width: 500px;
		width: 100%;
		background: var(--card-bg);
		border-radius: 20px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		border: 2px solid var(--border-color);
		box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-header h3 {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 900;
		color: var(--text-color);
	}

	.close-modal-x {
		background: none;
		border: none;
		font-size: 1.1rem;
		color: var(--text-muted);
		cursor: pointer;
		font-weight: 900;
	}

	.modal-body {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.modal-body p {
		margin: 0;
		font-size: 0.88rem;
		color: var(--text-color);
		line-height: 1.45;
	}

	.modal-hint {
		font-weight: 700;
		color: var(--text-muted) !important;
	}

	.import-options-grid {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.import-option-card {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.85rem 1rem;
		background: var(--card-bg-subtle);
		border: 2px solid var(--border-color);
		border-radius: 14px;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s ease;
	}

	.import-option-card:hover {
		border-color: var(--accent-color);
		background: var(--accent-light-bg);
		transform: translateY(-2px);
	}

	.import-option-card.danger-opt:hover {
		border-color: #ef4444;
		background: rgba(239, 68, 68, 0.1);
	}

	.opt-icon {
		font-size: 1.4rem;
	}

	.opt-content {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.opt-content strong {
		font-size: 0.92rem;
		color: var(--text-color);
	}

	.opt-content span {
		font-size: 0.76rem;
		color: var(--text-muted);
		line-height: 1.35;
	}

	.login-card {
		padding: 2rem;
		background: var(--card-bg);
		border-radius: 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 1rem;
	}

	.login-badge {
		font-size: 0.75rem;
		font-weight: 900;
		color: var(--accent-color);
		background: var(--accent-light-bg);
		padding: 0.25rem 0.65rem;
		border-radius: 999px;
	}

	.login-title {
		font-size: 1.4rem;
		font-weight: 900;
		margin: 0;
	}

	.login-desc {
		font-size: 0.88rem;
		color: var(--text-muted);
		max-width: 480px;
		line-height: 1.5;
		margin: 0;
	}

	.error-banner {
		padding: 0.75rem 1rem;
		background: rgba(239, 68, 68, 0.15);
		border: 1.5px solid #ef4444;
		border-radius: 12px;
		color: #ef4444;
		font-size: 0.82rem;
		font-weight: 800;
	}

	.discord-login-btn {
		background-color: #5865f2;
		color: #ffffff;
		border: 2px solid #4752c4;
		border-bottom: 4px solid #4752c4;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 900;
		padding: 0.75rem 1.5rem;
		border-radius: 14px;
		cursor: pointer;
	}
</style>
