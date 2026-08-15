/**
 * Utility per convertire bidirezionalmente tra Markdown e l'HTML dell'editor visuale in stile Word/Notion.
 * Permette di visualizzare e manipolare le immagini inline direttamente nel flusso del testo.
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

	return `
<figure class="doc-inline-image" contenteditable="false" data-url="${safeUrl}" data-width="${rawW}">
	<div class="doc-image-wrapper" style="max-width: ${cssW};">
		<img src="${safeUrl}" alt="${safeAlt}" class="doc-img-element" loading="lazy" />
		<div class="doc-image-toolbar">
			<button type="button" class="img-btn-size ${rawW === '200' ? 'active' : ''}" data-size="200">200px</button>
			<button type="button" class="img-btn-size ${rawW === '400' ? 'active' : ''}" data-size="400">400px</button>
			<button type="button" class="img-btn-size ${rawW === '650' ? 'active' : ''}" data-size="650">650px</button>
			<button type="button" class="img-btn-size ${rawW === '100%' ? 'active' : ''}" data-size="100%">100%</button>
			<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="img-btn-view" title="Apri a dimensione intera">🔍</a>
			<button type="button" class="img-btn-del" title="Rimuovi immagine">✕</button>
		</div>
	</div>
</figure>`.trim();
}

/**
 * Converte Markdown in HTML per l'editor contenteditable
 */
export function markdownToDocHtml(md: string): string {
	if (!md || typeof md !== 'string') return '<p><br></p>';

	const lines = md.replace(/\r\n/g, '\n').split('\n');
	const htmlParts: string[] = [];

	let inUl = false;
	let inOl = false;

	function closeLists() {
		if (inUl) {
			htmlParts.push('</ul>');
			inUl = false;
		}
		if (inOl) {
			htmlParts.push('</ol>');
			inOl = false;
		}
	}

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		if (!trimmed) {
			closeLists();
			htmlParts.push('<p><br></p>');
			continue;
		}

		// Immagine Markdown: ![alt|width](url) o ![alt](url)
		const imgMatch = trimmed.match(/^!\[([^\]|]*)(\|([^\]]+))?\]\(([^)]+)\)$/);
		if (imgMatch) {
			closeLists();
			const alt = imgMatch[1] || 'immagine';
			const width = imgMatch[3] ? imgMatch[3].trim() : '400';
			const url = imgMatch[4].trim();
			htmlParts.push(createInlineImageFigureHtml(url, width, alt));
			continue;
		}

		// Headings
		if (trimmed.startsWith('### ')) {
			closeLists();
			htmlParts.push(`<h3>${parseInlineMd(trimmed.substring(4))}</h3>`);
			continue;
		}
		if (trimmed.startsWith('## ')) {
			closeLists();
			htmlParts.push(`<h2>${parseInlineMd(trimmed.substring(3))}</h2>`);
			continue;
		}
		if (trimmed.startsWith('# ')) {
			closeLists();
			htmlParts.push(`<h1>${parseInlineMd(trimmed.substring(2))}</h1>`);
			continue;
		}

		// Unordered List
		if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
			if (inOl) closeLists();
			if (!inUl) {
				htmlParts.push('<ul>');
				inUl = true;
			}
			htmlParts.push(`<li>${parseInlineMd(trimmed.substring(2))}</li>`);
			continue;
		}

		// Ordered List
		const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
		if (olMatch) {
			if (inUl) closeLists();
			if (!inOl) {
				htmlParts.push('<ol>');
				inOl = true;
			}
			htmlParts.push(`<li>${parseInlineMd(olMatch[2])}</li>`);
			continue;
		}

		// Blockquote / Callout
		if (trimmed.startsWith('> ')) {
			closeLists();
			htmlParts.push(`<blockquote>${parseInlineMd(trimmed.substring(2))}</blockquote>`);
			continue;
		}

		// Normale paragrafo
		closeLists();
		htmlParts.push(`<p>${parseInlineMd(line)}</p>`);
	}

	closeLists();
	return htmlParts.join('\n') || '<p><br></p>';
}

/**
 * Converte l'albero DOM dell'editor visuale in Markdown standard pulito
 */
export function docHtmlToMarkdown(rootEl: HTMLElement): string {
	if (!rootEl) return '';

	function serializeNode(node: Node): string {
		if (node.nodeType === Node.TEXT_NODE) {
			return node.textContent || '';
		}

		if (node.nodeType !== Node.ELEMENT_NODE) {
			return '';
		}

		const el = node as HTMLElement;
		const tag = el.tagName.toLowerCase();

		// Immagine Inline
		if (el.classList.contains('doc-inline-image') || tag === 'figure') {
			const url = el.getAttribute('data-url') || el.querySelector('img')?.getAttribute('src') || '';
			const width = el.getAttribute('data-width') || '400';
			const alt = el.querySelector('img')?.getAttribute('alt') || 'immagine';
			if (url) {
				return `\n![${alt}|${width}](${url})\n`;
			}
			return '';
		}

		if (tag === 'h1') {
			return `\n# ${serializeChildren(el).trim()}\n`;
		}
		if (tag === 'h2') {
			return `\n## ${serializeChildren(el).trim()}\n`;
		}
		if (tag === 'h3') {
			return `\n### ${serializeChildren(el).trim()}\n`;
		}

		if (tag === 'strong' || tag === 'b') {
			const content = serializeChildren(el);
			return content ? `**${content}**` : '';
		}
		if (tag === 'em' || tag === 'i') {
			const content = serializeChildren(el);
			return content ? `*${content}*` : '';
		}
		if (tag === 'mark') {
			const content = serializeChildren(el);
			return content ? `==${content}==` : '';
		}
		if (tag === 'code') {
			const content = serializeChildren(el);
			return content ? `\`${content}\`` : '';
		}
		if (tag === 'del' || tag === 's') {
			const content = serializeChildren(el);
			return content ? `~~${content}~~` : '';
		}

		if (tag === 'ul') {
			let res = '';
			el.querySelectorAll(':scope > li').forEach((li) => {
				res += `- ${serializeChildren(li).trim()}\n`;
			});
			return `\n${res}\n`;
		}

		if (tag === 'ol') {
			let res = '';
			let idx = 1;
			el.querySelectorAll(':scope > li').forEach((li) => {
				res += `${idx}. ${serializeChildren(li).trim()}\n`;
				idx++;
			});
			return `\n${res}\n`;
		}

		if (tag === 'blockquote') {
			return `\n> ${serializeChildren(el).trim()}\n`;
		}

		if (tag === 'p' || tag === 'div') {
			const content = serializeChildren(el).trim();
			if (!content || el.innerHTML === '<br>') {
				return '\n';
			}
			return `\n${content}\n`;
		}

		if (tag === 'br') {
			return '\n';
		}

		return serializeChildren(el);
	}

	function serializeChildren(el: Node): string {
		let out = '';
		el.childNodes.forEach((child) => {
			out += serializeNode(child);
		});
		return out;
	}

	let markdown = serializeChildren(rootEl);
	// Normalizza righe vuote multiple (max 2 consecutive)
	markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();
	return markdown;
}
