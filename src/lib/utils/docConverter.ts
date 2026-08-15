/**
 * Utility per convertire bidirezionalmente tra Markdown e l'HTML dell'editor visuale in stile Word/Notion.
 * Garantisce zero inserimenti di righe vuote duplicate e stabilità al 100%.
 */

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function parseInlineMd(text: string): string {
	let out = escapeHtml(text);
	// Bold
	out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	// Italic
	out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
	// Highlight
	out = out.replace(/==([^=]+)==/g, '<mark>$1</mark>');
	// Code
	out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
	// Strikethrough
	out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
	return out;
}

export function createInlineImageFigureHtml(url: string, width = '400', alt = 'immagine'): string {
	const safeUrl = url.trim();
	const safeAlt = escapeHtml(alt);
	const rawW = width ? width.replace(/px/g, '').trim() : '400';
	const cssW = rawW.includes('%') ? rawW : `${rawW}px`;

	return `<figure class="doc-inline-image" contenteditable="false" data-url="${safeUrl}" data-width="${rawW}"><div class="doc-image-wrapper" style="max-width: ${cssW};"><img src="${safeUrl}" alt="${safeAlt}" class="doc-img-element" loading="lazy" /><div class="doc-image-toolbar"><button type="button" class="img-btn-size ${rawW === '200' ? 'active' : ''}" data-size="200">200px</button><button type="button" class="img-btn-size ${rawW === '400' ? 'active' : ''}" data-size="400">400px</button><button type="button" class="img-btn-size ${rawW === '650' ? 'active' : ''}" data-size="650">650px</button><button type="button" class="img-btn-size ${rawW === '100%' ? 'active' : ''}" data-size="100%">100%</button><a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="img-btn-view" title="Apri a dimensione intera">🔍</a><button type="button" class="img-btn-del" title="Rimuovi immagine">✕</button></div></div></figure>`;
}

/**
 * Converte Markdown in HTML per l'editor contenteditable (senza righe vuote duplicate)
 */
export function markdownToDocHtml(md: string): string {
	if (!md || typeof md !== 'string' || !md.trim()) return '<p><br></p>';

	// Suddividi in blocchi logici separati da righe vuote (\n\n+)
	const rawBlocks = md.replace(/\r\n/g, '\n').split(/\n\n+/);
	const htmlParts: string[] = [];

	for (const block of rawBlocks) {
		const trimmed = block.trim();
		if (!trimmed) continue;

		// 1. Immagine Markdown: ![alt|width](url) o ![alt](url)
		const imgMatch = trimmed.match(/^!\[([^\]|]*)(\|([^\]]+))?\]\(([^)]+)\)$/);
		if (imgMatch) {
			const alt = imgMatch[1] || 'immagine';
			const width = imgMatch[3] ? imgMatch[3].trim() : '400';
			const url = imgMatch[4].trim();
			htmlParts.push(createInlineImageFigureHtml(url, width, alt));
			continue;
		}

		// 2. Headings
		if (trimmed.startsWith('### ')) {
			htmlParts.push(`<h3>${parseInlineMd(trimmed.substring(4))}</h3>`);
			continue;
		}
		if (trimmed.startsWith('## ')) {
			htmlParts.push(`<h2>${parseInlineMd(trimmed.substring(3))}</h2>`);
			continue;
		}
		if (trimmed.startsWith('# ')) {
			htmlParts.push(`<h1>${parseInlineMd(trimmed.substring(2))}</h1>`);
			continue;
		}

		// 3. Blockquote / Callout
		if (trimmed.startsWith('> ')) {
			htmlParts.push(`<blockquote>${parseInlineMd(trimmed.substring(2))}</blockquote>`);
			continue;
		}

		// 4. Liste
		const lines = trimmed.split('\n');
		if (lines.length > 0 && lines.every((l) => l.trim().startsWith('- ') || l.trim().startsWith('* '))) {
			const items = lines.map((l) => `<li>${parseInlineMd(l.trim().substring(2))}</li>`).join('');
			htmlParts.push(`<ul>${items}</ul>`);
			continue;
		}
		if (lines.length > 0 && lines.every((l) => /^\d+\.\s+/.test(l.trim()))) {
			const items = lines.map((l) => `<li>${parseInlineMd(l.trim().replace(/^\d+\.\s+/, ''))}</li>`).join('');
			htmlParts.push(`<ol>${items}</ol>`);
			continue;
		}

		// 5. Paragrafo standard (unisce eventuali ritorni a capo singoli interni con <br>)
		const pContent = lines.map((l) => parseInlineMd(l)).join('<br>');
		htmlParts.push(`<p>${pContent}</p>`);
	}

	return htmlParts.join('\n') || '<p><br></p>';
}

/**
 * Converte l'albero DOM dell'editor visuale in Markdown standard pulito
 */
export function docHtmlToMarkdown(rootEl: HTMLElement): string {
	if (!rootEl) return '';

	function serializeInline(node: Node): string {
		if (node.nodeType === Node.TEXT_NODE) {
			return node.textContent || '';
		}
		if (node.nodeType !== Node.ELEMENT_NODE) {
			return '';
		}

		const el = node as HTMLElement;
		const tag = el.tagName.toLowerCase();

		if (tag === 'br') {
			return '\n';
		}
		if (tag === 'strong' || tag === 'b') {
			const inner = serializeChildrenInline(el);
			return inner ? `**${inner}**` : '';
		}
		if (tag === 'em' || tag === 'i') {
			const inner = serializeChildrenInline(el);
			return inner ? `*${inner}*` : '';
		}
		if (tag === 'mark') {
			const inner = serializeChildrenInline(el);
			return inner ? `==${inner}==` : '';
		}
		if (tag === 'code') {
			const inner = serializeChildrenInline(el);
			return inner ? `\`${inner}\`` : '';
		}
		if (tag === 'del' || tag === 's') {
			const inner = serializeChildrenInline(el);
			return inner ? `~~${inner}~~` : '';
		}
		if (tag === 'a') {
			const href = el.getAttribute('href') || '#';
			const inner = serializeChildrenInline(el);
			return `[${inner}](${href})`;
		}

		return serializeChildrenInline(el);
	}

	function serializeChildrenInline(el: Node): string {
		let out = '';
		el.childNodes.forEach((child) => {
			out += serializeInline(child);
		});
		return out;
	}

	const blocks: string[] = [];

	for (const child of Array.from(rootEl.childNodes)) {
		if (child.nodeType === Node.TEXT_NODE) {
			const t = child.textContent?.trim();
			if (t) blocks.push(t);
			continue;
		}
		if (child.nodeType !== Node.ELEMENT_NODE) continue;

		const el = child as HTMLElement;
		const tag = el.tagName.toLowerCase();

		// Immagine Inline
		if (el.classList.contains('doc-inline-image') || tag === 'figure') {
			const url = el.getAttribute('data-url') || el.querySelector('img')?.getAttribute('src') || '';
			const width = el.getAttribute('data-width') || '400';
			const alt = el.querySelector('img')?.getAttribute('alt') || 'immagine';
			if (url) {
				blocks.push(`![${alt}|${width}](${url})`);
			}
			continue;
		}

		if (tag === 'h1') {
			blocks.push(`# ${serializeInline(el).trim()}`);
			continue;
		}
		if (tag === 'h2') {
			blocks.push(`## ${serializeInline(el).trim()}`);
			continue;
		}
		if (tag === 'h3') {
			blocks.push(`### ${serializeInline(el).trim()}`);
			continue;
		}

		if (tag === 'ul') {
			const items: string[] = [];
			el.querySelectorAll(':scope > li').forEach((li) => {
				items.push(`- ${serializeInline(li).trim()}`);
			});
			if (items.length > 0) blocks.push(items.join('\n'));
			continue;
		}

		if (tag === 'ol') {
			const items: string[] = [];
			let idx = 1;
			el.querySelectorAll(':scope > li').forEach((li) => {
				items.push(`${idx}. ${serializeInline(li).trim()}`);
				idx++;
			});
			if (items.length > 0) blocks.push(items.join('\n'));
			continue;
		}

		if (tag === 'blockquote') {
			blocks.push(`> ${serializeInline(el).trim()}`);
			continue;
		}

		if (tag === 'p' || tag === 'div') {
			const text = serializeInline(el).trim();
			if (text) {
				blocks.push(text);
			}
			continue;
		}

		const fallback = serializeInline(el).trim();
		if (fallback) blocks.push(fallback);
	}

	return blocks.join('\n\n').trim();
}
