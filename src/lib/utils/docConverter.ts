/**
 * Utilità bidirezionale per la conversione perfetta tra Markdown e HTML per l'editor delle note.
 * Supporta:
 * - Titoli (#, ##, ###)
 * - Liste numerate (1. , 2. ) e puntate (- , * )
 * - Paragrafi, ritorni a capo singoli (<br>) e righe vuote (<p><br></p>)
 * - Formattazione inline: Grassetto (**), Corsivo (*), Evidenziatore (==), Codice (`), Barrato (~~), Link ([text](url))
 * - Immagini inline con ridimensionamento e allineamento
 */

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export function parseInlineMd(text: string): string {
	if (!text) return '';
	let out = escapeHtml(text);

	// Bold: **text**
	out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	// Italic: *text* (evitando conflitti con bold)
	out = out.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
	// Highlight: ==text==
	out = out.replace(/==([^=]+)==/g, '<mark>$1</mark>');
	// Code: `code`
	out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
	// Strikethrough: ~~text~~
	out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
	// Link: [text](url)
	out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

	return out;
}

export function createInlineImageFigureHtml(
	url: string,
	width = '400',
	align = 'center',
	alt = 'immagine'
): string {
	const safeUrl = url.trim();
	const safeAlt = escapeHtml(alt);
	const rawW = width ? width.replace(/px/g, '').trim() : '400';
	const cssW = rawW.includes('%') ? rawW : `${rawW}px`;
	const safeAlign = ['left', 'center', 'right'].includes(align) ? align : 'center';

	return `<figure class="doc-inline-image" contenteditable="false" draggable="true" data-url="${safeUrl}" data-width="${rawW}" data-align="${safeAlign}"><div class="doc-image-wrapper align-${safeAlign}" style="max-width: ${cssW};"><img src="${safeUrl}" alt="${safeAlt}" class="doc-img-element" loading="lazy" /><div class="resize-handle handle-se" title="Trascina per ridimensionare"></div><div class="resize-handle handle-sw" title="Trascina per ridimensionare"></div><div class="doc-image-toolbar"><button type="button" class="img-btn-move" data-move="up" title="Sposta prima del paragrafo precedente">▲</button><button type="button" class="img-btn-move" data-move="down" title="Sposta dopo il paragrafo successivo">▼</button><span class="img-tool-sep"></span><button type="button" class="img-btn-align ${safeAlign === 'left' ? 'active' : ''}" data-align="left" title="Allinea a Sinistra">⬅️</button><button type="button" class="img-btn-align ${safeAlign === 'center' ? 'active' : ''}" data-align="center" title="Centra">⏺️</button><button type="button" class="img-btn-align ${safeAlign === 'right' ? 'active' : ''}" data-align="right" title="Allinea a Destra">➡️</button><span class="img-tool-sep"></span><a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="img-btn-view" title="Apri a dimensione intera">🔍</a><button type="button" class="img-btn-del" title="Rimuovi immagine">✕</button></div></div></figure>`;
}

/**
 * Converte Markdown in HTML per l'editor contenteditable, preservando spazi e formattazione
 */
export function markdownToDocHtml(md: string): string {
	if (!md || typeof md !== 'string') return '<p><br></p>';

	const normalized = md.replace(/\r\n/g, '\n');
	const lines = normalized.split('\n');
	const htmlParts: string[] = [];

	let currentListType: 'ul' | 'ol' | null = null;
	let currentListItems: string[] = [];
	let currentParagraphLines: string[] = [];

	function flushParagraph() {
		if (currentParagraphLines.length > 0) {
			const pContent = currentParagraphLines.map((l) => parseInlineMd(l)).join('<br>');
			htmlParts.push(`<p>${pContent || '<br>'}</p>`);
			currentParagraphLines = [];
		}
	}

	function flushList() {
		if (currentListType && currentListItems.length > 0) {
			const itemsHtml = currentListItems.map((li) => `<li>${parseInlineMd(li)}</li>`).join('');
			htmlParts.push(`<${currentListType}>${itemsHtml}</${currentListType}>`);
			currentListType = null;
			currentListItems = [];
		}
	}

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		// Riconoscimento Immagine Markdown: ![alt|width|align](url)
		const imgMatch = trimmed.match(/^!\[([^\]|]*)(\|([^\]|]+))?(\|([^\]]+))?\]\(([^)]+)\)$/);
		if (imgMatch) {
			flushParagraph();
			flushList();
			const alt = imgMatch[1] || 'immagine';
			const width = imgMatch[3] ? imgMatch[3].trim() : '400';
			const align = imgMatch[5] ? imgMatch[5].trim() : 'center';
			const url = imgMatch[6].trim();
			htmlParts.push(createInlineImageFigureHtml(url, width, align, alt));
			continue;
		}

		// Riconoscimento Headings (#, ##, ###)
		if (/^#{1,3}\s/.test(trimmed)) {
			flushParagraph();
			flushList();
			if (trimmed.startsWith('### ')) {
				htmlParts.push(`<h3>${parseInlineMd(trimmed.substring(4))}</h3>`);
			} else if (trimmed.startsWith('## ')) {
				htmlParts.push(`<h2>${parseInlineMd(trimmed.substring(3))}</h2>`);
			} else if (trimmed.startsWith('# ')) {
				htmlParts.push(`<h1>${parseInlineMd(trimmed.substring(2))}</h1>`);
			}
			continue;
		}

		// Riconoscimento Blockquote (> )
		if (trimmed.startsWith('> ')) {
			flushParagraph();
			flushList();
			htmlParts.push(`<blockquote>${parseInlineMd(trimmed.substring(2))}</blockquote>`);
			continue;
		}

		// Riconoscimento Lista Puntata (- o * )
		const bulletMatch = line.match(/^(\s*)([-*])\s+(.*)$/);
		if (bulletMatch) {
			flushParagraph();
			if (currentListType && currentListType !== 'ul') {
				flushList();
			}
			currentListType = 'ul';
			currentListItems.push(bulletMatch[3]);
			continue;
		}

		// Riconoscimento Lista Numerata (1. , 2. , etc.)
		const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
		if (orderedMatch) {
			flushParagraph();
			if (currentListType && currentListType !== 'ol') {
				flushList();
			}
			currentListType = 'ol';
			currentListItems.push(orderedMatch[3]);
			continue;
		}

		// Se eravamo in una lista e la riga non è un elemento di lista:
		if (currentListType) {
			flushList();
		}

		// Riga vuota
		if (trimmed === '') {
			flushParagraph();
			// Aggiungi un paragrafo vuoto per rappresentare la riga vuota
			htmlParts.push('<p><br></p>');
			continue;
		}

		// Riga di paragrafo standard
		currentParagraphLines.push(line);
	}

	flushParagraph();
	flushList();

	return htmlParts.join('\n') || '<p><br></p>';
}

/**
 * Converte l'albero DOM contenteditable in Markdown pulito, preservando spazi e numeri
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
			const t = child.textContent;
			if (t && t.trim()) {
				blocks.push(t);
			}
			continue;
		}
		if (child.nodeType !== Node.ELEMENT_NODE) continue;

		const el = child as HTMLElement;
		const tag = el.tagName.toLowerCase();

		// Immagine Inline
		if (el.classList.contains('doc-inline-image') || tag === 'figure') {
			const url = el.getAttribute('data-url') || el.querySelector('img')?.getAttribute('src') || '';
			const width = el.getAttribute('data-width') || '400';
			const align = el.getAttribute('data-align') || 'center';
			const alt = el.querySelector('img')?.getAttribute('alt') || 'immagine';
			if (url) {
				if (align && align !== 'center') {
					blocks.push(`![${alt}|${width}|${align}](${url})`);
				} else {
					blocks.push(`![${alt}|${width}](${url})`);
				}
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
				items.push(`- ${serializeInline(li)}`);
			});
			if (items.length > 0) blocks.push(items.join('\n'));
			continue;
		}

		if (tag === 'ol') {
			const items: string[] = [];
			let idx = 1;
			el.querySelectorAll(':scope > li').forEach((li) => {
				items.push(`${idx}. ${serializeInline(li)}`);
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
			// Se il paragrafo è vuoto (<br> o solo whitespace vuoto)
			if (el.innerHTML === '<br>' || el.innerHTML === '' || el.textContent === '') {
				blocks.push('');
			} else {
				const text = serializeInline(el);
				blocks.push(text);
			}
			continue;
		}

		const fallback = serializeInline(el);
		if (fallback) blocks.push(fallback);
	}

	return blocks.join('\n\n');
}
