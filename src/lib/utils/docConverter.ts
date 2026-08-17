/**
 * Utilità bidirezionale per la conversione perfetta tra Markdown e HTML per l'editor delle note stile Obsidian.
 * Supporta:
 * - Titoli (#, ##, ###)
 * - Liste numerate (1. , 2. ) e puntate (- , * )
 * - Paragrafi, ritorni a capo singoli e righe vuote
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

	return `<figure class="doc-inline-image" contenteditable="false" draggable="true" data-url="${safeUrl}" data-width="${rawW}" data-align="${safeAlign}"><div class="doc-image-wrapper align-${safeAlign}" style="max-width: ${cssW};"><img src="${safeUrl}" alt="${safeAlt}" class="doc-img-element" loading="lazy" /><div class="resize-handle handle-se" title="Trascina per ridimensionare"></div><div class="resize-handle handle-sw" title="Trascina per ridimensionare"></div><div class="doc-image-toolbar"><button type="button" class="img-btn-move" data-move="up" title="Sposta su">▲</button><button type="button" class="img-btn-move" data-move="down" title="Sposta giù">▼</button><span class="img-tool-sep"></span><button type="button" class="img-btn-align ${safeAlign === 'left' ? 'active' : ''}" data-align="left" title="Allinea a Sinistra">⬅️</button><button type="button" class="img-btn-align ${safeAlign === 'center' ? 'active' : ''}" data-align="center" title="Centra">⏺️</button><button type="button" class="img-btn-align ${safeAlign === 'right' ? 'active' : ''}" data-align="right" title="Allinea a Destra">➡️</button><span class="img-tool-sep"></span><a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="img-btn-view" title="Apri intera">🔍</a><button type="button" class="img-btn-del" title="Elimina">✕</button></div></div></figure>`;
}

/**
 * Converte Markdown in HTML per l'editor contenteditable, con corrispondenza 1:1 dei ritorni a capo
 */
export function markdownToDocHtml(md: string): string {
	if (!md || typeof md !== 'string') return '<p><br></p>';

	const normalized = md.replace(/\r\n/g, '\n');
	const lines = normalized.split('\n');
	const htmlParts: string[] = [];

	let inList: 'ul' | 'ol' | null = null;
	let listItems: string[] = [];

	function flushList() {
		if (inList && listItems.length > 0) {
			const itemsHtml = listItems.map((li) => `<li>${parseInlineMd(li)}</li>`).join('');
			htmlParts.push(`<${inList}>${itemsHtml}</${inList}>`);
			inList = null;
			listItems = [];
		}
	}

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		// Riconoscimento Immagine Markdown: ![alt|width|align](url)
		const imgMatch = trimmed.match(/^!\[([^\]|]*)(\|([^\]|]+))?(\|([^\]]+))?\]\(([^)]+)\)$/);
		if (imgMatch) {
			flushList();
			const alt = imgMatch[1] || 'immagine';
			const width = imgMatch[3] ? imgMatch[3].trim() : '400';
			const align = imgMatch[5] ? imgMatch[5].trim() : 'center';
			const url = imgMatch[6].trim();
			htmlParts.push(createInlineImageFigureHtml(url, width, align, alt));
			continue;
		}

		// Riconoscimento Headings (#, ##, ###)
		if (/^#{1,3}\s/.test(trimmed) || /^#{1,3}[^\s#]/.test(trimmed)) {
			flushList();
			if (trimmed.startsWith('### ') || trimmed.startsWith('###')) {
				const text = trimmed.startsWith('### ') ? trimmed.substring(4) : trimmed.substring(3);
				htmlParts.push(`<h3>${parseInlineMd(text)}</h3>`);
			} else if (trimmed.startsWith('## ') || trimmed.startsWith('##')) {
				const text = trimmed.startsWith('## ') ? trimmed.substring(3) : trimmed.substring(2);
				htmlParts.push(`<h2>${parseInlineMd(text)}</h2>`);
			} else if (trimmed.startsWith('# ') || trimmed.startsWith('#')) {
				const text = trimmed.startsWith('# ') ? trimmed.substring(2) : trimmed.substring(1);
				htmlParts.push(`<h1>${parseInlineMd(text)}</h1>`);
			}
			continue;
		}

		// Riconoscimento Blockquote (> )
		if (trimmed.startsWith('>')) {
			flushList();
			const text = trimmed.startsWith('> ') ? trimmed.substring(2) : trimmed.substring(1);
			htmlParts.push(`<blockquote>${parseInlineMd(text)}</blockquote>`);
			continue;
		}

		// Riconoscimento Lista Puntata (- o * )
		const bulletMatch = line.match(/^(\s*)([-*])\s+(.*)$/);
		if (bulletMatch) {
			if (inList && inList !== 'ul') {
				flushList();
			}
			inList = 'ul';
			listItems.push(bulletMatch[3]);
			continue;
		}

		// Riconoscimento Lista Numerata (1. , 2. , etc.)
		const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
		if (orderedMatch) {
			if (inList && inList !== 'ol') {
				flushList();
			}
			inList = 'ol';
			listItems.push(orderedMatch[3]);
			continue;
		}

		// Chiudi eventuale lista se la riga corrente non è un elemento di lista
		if (inList) {
			flushList();
		}

		// Riga vuota intenzionale
		if (trimmed === '') {
			htmlParts.push('<p><br></p>');
			continue;
		}

		// Riga standard (1 paragrafo = 1 riga esatta)
		htmlParts.push(`<p>${parseInlineMd(line)}</p>`);
	}

	flushList();

	return htmlParts.join('\n') || '<p><br></p>';
}

/**
 * Converte l'albero DOM contenteditable in Markdown pulito, preservando esattamente 1 ritorno a capo per paragrafo
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

	const lines: string[] = [];

	for (const child of Array.from(rootEl.childNodes)) {
		if (child.nodeType === Node.TEXT_NODE) {
			const t = child.textContent;
			if (t && t.trim()) {
				lines.push(t);
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
					lines.push(`![${alt}|${width}|${align}](${url})`);
				} else {
					lines.push(`![${alt}|${width}](${url})`);
				}
			}
			continue;
		}

		if (tag === 'h1') {
			lines.push(`# ${serializeInline(el).trim()}`);
			continue;
		}
		if (tag === 'h2') {
			lines.push(`## ${serializeInline(el).trim()}`);
			continue;
		}
		if (tag === 'h3') {
			lines.push(`### ${serializeInline(el).trim()}`);
			continue;
		}

		if (tag === 'ul') {
			el.querySelectorAll(':scope > li').forEach((li) => {
				lines.push(`- ${serializeInline(li)}`);
			});
			continue;
		}

		if (tag === 'ol') {
			let idx = 1;
			el.querySelectorAll(':scope > li').forEach((li) => {
				lines.push(`${idx}. ${serializeInline(li)}`);
				idx++;
			});
			continue;
		}

		if (tag === 'blockquote') {
			lines.push(`> ${serializeInline(el).trim()}`);
			continue;
		}

		if (tag === 'p' || tag === 'div') {
			if (el.innerHTML === '<br>' || el.innerHTML === '' || el.textContent === '') {
				lines.push('');
			} else {
				lines.push(serializeInline(el));
			}
			continue;
		}

		const fallback = serializeInline(el);
		if (fallback) lines.push(fallback);
	}

	return lines.join('\n');
}
