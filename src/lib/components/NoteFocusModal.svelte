<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { parseMarkdown, getMarkdownStats } from '$lib/utils/markdown';
	import type { Note } from '$lib/types/notes';
	import { toastStore } from '$lib/stores/toastStore';

	let {
		isOpen = false,
		note = null,
		onClose = () => {},
		onEdit = () => {}
	} = $props<{
		isOpen: boolean;
		note?: Note | null;
		onClose: () => void;
		onEdit: (note: Note) => void;
	}>();

	let rendered = $derived(note ? parseMarkdown(note.content) : '');
	let stats = $derived(note ? getMarkdownStats(note.content) : { wordCount: 0, readingTimeMinutes: 1 });

	async function copyMarkdownText() {
		if (!note) return;
		try {
			await navigator.clipboard.writeText(`# ${note.title}\n\n${note.content}`);
			toastStore.show({ message: '📋 Testo Markdown copiato negli appunti!' });
		} catch {
			toastStore.show({ message: '⚠️ Impossibile copiare negli appunti' });
		}
	}

	function downloadMarkdownFile() {
		if (!note) return;
		const filename = `${note.title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() || 'appunto'}.md`;
		const fullText = `# ${note.title}\n\n**Categoria**: ${note.category}\n${note.tags?.length ? `**Tag**: ${note.tags.join(', ')}\n` : ''}\n---\n\n${note.content}`;
		const blob = new Blob([fullText], { type: 'text/markdown;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
		toastStore.show({ message: `📥 File "${filename}" scaricato!` });
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}
</script>

{#if isOpen && note}
	<div
		class="focus-backdrop"
		transition:fade={{ duration: 180 }}
		onclick={onClose}
		onkeydown={handleKeyDown}
		role="presentation"
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="focus-container duo-card"
			transition:scale={{ start: 0.95, duration: 200 }}
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<!-- Top Focus Navigation Bar -->
			<div class="focus-header">
				<div class="header-left">
					<span class="focus-mode-badge">
						<img src="/emoji/open_book_3d.png" alt="" class="mode-icon" />
						MODALITÀ STUDIO & LETTURA
					</span>
					<div class="meta-row">
						<span class="category-pill">{note.category}</span>
						<span class="stats-pill">⏱️ {stats.readingTimeMinutes} min di lettura</span>
						<span class="stats-pill">📝 {stats.wordCount} parole</span>
					</div>
				</div>

				<div class="header-actions">
					<button
						type="button"
						class="focus-action-btn"
						onclick={copyMarkdownText}
						title="Copia Markdown"
					>
						📋 Copia
					</button>

					<button
						type="button"
						class="focus-action-btn"
						onclick={downloadMarkdownFile}
						title="Scarica file .md"
					>
						📥 Esporta .md
					</button>

					<button
						type="button"
						class="focus-action-btn edit-btn"
						onclick={() => {
							onClose();
							if (note) onEdit(note);
						}}
						title="Modifica questo appunto"
					>
						✏️ Modifica
					</button>

					<button type="button" class="close-focus-btn" onclick={onClose} aria-label="Chiudi lettura">
						✕
					</button>
				</div>
			</div>

			<!-- Main Article Reading Space -->
			<div class="focus-body">
				<header class="note-title-header">
					<h1 class="main-note-title">{note.title}</h1>

					{#if note.tags && note.tags.length > 0}
						<div class="tags-container">
							{#each note.tags as tag}
								<span class="note-tag">#{tag}</span>
							{/each}
						</div>
					{/if}
				</header>

				<article class="focus-rendered-content markdown-rendered-box">
					{@html rendered}
				</article>

				<footer class="focus-footer-info">
					<span>Creato il {new Date(note.createdAt).toLocaleDateString('it-IT')}</span>
					{#if note.updatedAt}
						<span>• Ultima modifica: {new Date(note.updatedAt).toLocaleDateString('it-IT')}</span>
					{/if}
				</footer>
			</div>
		</div>
	</div>
{/if}

<style>
	.focus-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		z-index: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem;
		box-sizing: border-box;
	}

	.focus-container {
		width: 100%;
		max-width: 820px;
		max-height: 92vh;
		background-color: var(--card-bg);
		border-radius: 24px;
		display: flex;
		flex-direction: column;
		padding: 1.25rem 1.5rem;
		box-sizing: border-box;
		overflow: hidden;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
	}

	.focus-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.85rem;
		border-bottom: 2px solid var(--border-color);
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.header-left {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.focus-mode-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.75rem;
		font-weight: 900;
		color: var(--orange-color);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.mode-icon {
		width: 20px;
		height: 20px;
		object-fit: contain;
	}

	.meta-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.category-pill {
		background: var(--accent-light-bg);
		border: 1.5px solid var(--accent-color);
		color: var(--accent-color);
		border-radius: 9999px;
		padding: 0.15rem 0.55rem;
		font-size: 0.72rem;
		font-weight: 800;
	}

	.stats-pill {
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--text-muted);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.focus-action-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 10px;
		padding: 0.35rem 0.65rem;
		font-size: 0.76rem;
		font-weight: 800;
		color: var(--text-color);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.focus-action-btn:hover {
		background: var(--hover-bg);
	}

	.edit-btn {
		background: var(--accent-light-bg);
		border-color: var(--accent-color);
		color: var(--accent-color);
	}

	.close-focus-btn {
		background: var(--card-bg-subtle);
		border: 1.5px solid var(--border-color);
		border-radius: 10px;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-color);
		font-size: 1rem;
		cursor: pointer;
	}

	.focus-body {
		flex: 1;
		overflow-y: auto;
		padding: 1.25rem 0.5rem 1rem 0.25rem;
	}

	.note-title-header {
		margin-bottom: 1.25rem;
		padding-bottom: 0.75rem;
		border-bottom: 2px solid var(--border-color);
	}

	.main-note-title {
		font-family: 'Outfit', sans-serif;
		font-size: 1.85rem;
		font-weight: 900;
		color: var(--text-color);
		line-height: 1.2;
		margin-bottom: 0.4rem;
	}

	.tags-container {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.note-tag {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-muted);
		background: var(--card-bg-subtle);
		border-radius: 6px;
		padding: 0.15rem 0.45rem;
	}

	.focus-rendered-content {
		font-size: 1.05rem;
		line-height: 1.7;
		color: var(--text-color);
	}

	.focus-footer-info {
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1.5px dashed var(--border-color);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: var(--text-muted);
		flex-wrap: wrap;
	}
</style>
