/**
 * Parser Markdown leggero, sicuro (anti-XSS) e veloce per gli appunti di studio.
 * Supporta formattazione avanzata GFM: titoli, enfasi, liste, checklist, tabelle,
 * blocchi di codice, alert callout e citazioni.
 */

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function sanitizeUrl(url: string): string {
	const trimmed = url.trim();
	if (
		trimmed.startsWith('https://') ||
		trimmed.startsWith('http://') ||
		trimmed.startsWith('mailto:') ||
		trimmed.startsWith('/') ||
		trimmed.startsWith('#')
	) {
		return escapeHtml(trimmed);
	}
	return '#';
}

function parseInline(text: string): string {
	let out = text;

	// Inline code: `code`
	out = out.replace(/`([^`]+)`/g, (_match, code) => {
		return `<code class="md-inline-code">${escapeHtml(code)}</code>`;
	});

	// Bold: **text** or __text__
	out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');

	// Strikethrough: ~~text~~
	out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');

	// Italic: *text* or _text_
	out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
	out = out.replace(/_([^_]+)_/g, '<em>$1</em>');

	// Highlight: ==text==
	out = out.replace(/==([^=]+)==/g, '<mark class="md-highlight">$1</mark>');

	// Links: [label](url)
	out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
		const safeUrl = sanitizeUrl(url);
		return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="md-link">${label}</a>`;
	});

	return out;
}

export function parseMarkdown(src: string): string {
	if (!src || typeof src !== 'string') return '';

	const rawLines = src.replace(/\r\n/g, '\n').split('\n');
	const output: string[] = [];

	let inCodeBlock = false;
	let codeBlockLang = '';
	let codeBlockLines: string[] = [];

	let inList: 'ul' | 'ol' | null = null;
	let inTable = false;
	let tableHeaderDone = false;

	function closeList() {
		if (inList) {
			output.push(`</${inList}>`);
			inList = null;
		}
	}

	function closeTable() {
		if (inTable) {
			output.push('</tbody></table></div>');
			inTable = false;
			tableHeaderDone = false;
		}
	}

	for (let i = 0; i < rawLines.length; i++) {
		const rawLine = rawLines[i];

		// 1. Code Block Fence ```
		const codeFenceMatch = rawLine.match(/^```(\w*)/);
		if (codeFenceMatch) {
			if (!inCodeBlock) {
				closeList();
				closeTable();
				inCodeBlock = true;
				codeBlockLang = codeFenceMatch[1] || 'text';
				codeBlockLines = [];
			} else {
				// Fine blocco codice
				inCodeBlock = false;
				const escapedCode = escapeHtml(codeBlockLines.join('\n'));
				output.push(
					`<div class="md-code-box"><div class="md-code-header"><span class="md-code-lang">${escapeHtml(
						codeBlockLang
					)}</span></div><pre><code class="language-${escapeHtml(codeBlockLang)}">${escapedCode}</code></pre></div>`
				);
				codeBlockLines = [];
			}
			continue;
		}

		if (inCodeBlock) {
			codeBlockLines.push(rawLine);
			continue;
		}

		const trimmed = rawLine.trim();

		// 2. Linea vuota
		if (!trimmed) {
			closeList();
			closeTable();
			continue;
		}

		// 3. Linea orizzontale --- o ***
		if (/^(\-{3,}|\*{3,}|\_{3,})$/.test(trimmed)) {
			closeList();
			closeTable();
			output.push('<hr class="md-hr" />');
			continue;
		}

		// 4. Intestazioni # ... ######
		const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
		if (headingMatch) {
			closeList();
			closeTable();
			const level = headingMatch[1].length;
			const headingText = parseInline(escapeHtml(headingMatch[2]));
			output.push(`<h${level} class="md-heading md-h${level}">${headingText}</h${level}>`);
			continue;
		}

		// 5. Callout Alert GitHub style: > [!NOTE], > [!TIP], > [!WARNING], > [!IMPORTANT], > [!CAUTION]
		const alertMatch = trimmed.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i);
		if (alertMatch) {
			closeList();
			closeTable();
			const type = alertMatch[1].toUpperCase();
			const firstLineText = alertMatch[2] ? parseInline(escapeHtml(alertMatch[2])) : '';

			// Raccogli linee successive col prefisso `>`
			const calloutLines: string[] = [];
			if (firstLineText) calloutLines.push(firstLineText);

			while (i + 1 < rawLines.length && rawLines[i + 1].trim().startsWith('>')) {
				i++;
				const nextL = rawLines[i].trim().replace(/^>\s*/, '');
				calloutLines.push(parseInline(escapeHtml(nextL)));
			}

			const alertIcon =
				type === 'TIP'
					? '💡'
					: type === 'WARNING'
						? '⚠️'
						: type === 'IMPORTANT'
							? '📌'
							: type === 'CAUTION'
								? '🚨'
								: 'ℹ️';

			output.push(
				`<div class="md-callout md-callout-${type.toLowerCase()}">
					<div class="md-callout-title"><span>${alertIcon}</span><strong>${type}</strong></div>
					<div class="md-callout-body">${calloutLines.join('<br />')}</div>
				</div>`
			);
			continue;
		}

		// 6. Citazioni standard >
		if (trimmed.startsWith('>')) {
			closeList();
			closeTable();
			const quoteLines: string[] = [parseInline(escapeHtml(trimmed.replace(/^>\s*/, '')))];

			while (i + 1 < rawLines.length && rawLines[i + 1].trim().startsWith('>')) {
				i++;
				quoteLines.push(parseInline(escapeHtml(rawLines[i].trim().replace(/^>\s*/, ''))));
			}

			output.push(`<blockquote class="md-blockquote">${quoteLines.join('<br />')}</blockquote>`);
			continue;
		}

		// 7. Tabelle Markdown: | col 1 | col 2 |
		if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
			closeList();
			const cells = trimmed
				.slice(1, -1)
				.split('|')
				.map((c) => c.trim());

			// Se è la linea di separazione |---|---|
			if (cells.every((c) => /^:?-+:?$/.test(c))) {
				tableHeaderDone = true;
				continue;
			}

			if (!inTable) {
				inTable = true;
				output.push('<div class="md-table-wrapper"><table class="md-table">');
				output.push('<thead><tr>');
				for (const cell of cells) {
					output.push(`<th>${parseInline(escapeHtml(cell))}</th>`);
				}
				output.push('</tr></thead><tbody>');
			} else {
				output.push('<tr>');
				for (const cell of cells) {
					output.push(`<td>${parseInline(escapeHtml(cell))}</td>`);
				}
				output.push('</tr>');
			}
			continue;
		} else {
			closeTable();
		}

		// 8. Checklist / Task Lists: - [ ] o - [x]
		const taskMatch = trimmed.match(/^[\*\-]\s+\[([ xX])\]\s+(.+)$/);
		if (taskMatch) {
			if (inList !== 'ul') {
				closeList();
				inList = 'ul';
				output.push('<ul class="md-checklist">');
			}
			const isChecked = taskMatch[1].toLowerCase() === 'x';
			const itemText = parseInline(escapeHtml(taskMatch[2]));
			output.push(
				`<li class="md-check-item ${isChecked ? 'completed' : ''}">
					<input type="checkbox" ${isChecked ? 'checked' : ''} disabled class="md-check-box" />
					<span class="md-check-label">${itemText}</span>
				</li>`
			);
			continue;
		}

		// 9. Liste puntate non ordinate: - item o * item
		const bulletMatch = trimmed.match(/^[\*\-]\s+(.+)$/);
		if (bulletMatch) {
			if (inList !== 'ul') {
				closeList();
				inList = 'ul';
				output.push('<ul class="md-list">');
			}
			output.push(`<li>${parseInline(escapeHtml(bulletMatch[1]))}</li>`);
			continue;
		}

		// 10. Liste ordinate: 1. item
		const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
		if (orderedMatch) {
			if (inList !== 'ol') {
				closeList();
				inList = 'ol';
				output.push('<ol class="md-ordered-list">');
			}
			output.push(`<li>${parseInline(escapeHtml(orderedMatch[1]))}</li>`);
			continue;
		}

		// 11. Paragrafo standard
		closeList();
		closeTable();
		const inlineParsed = parseInline(escapeHtml(trimmed));
		output.push(`<p class="md-paragraph">${inlineParsed}</p>`);
	}

	// Chiudi eventuali strutture rimaste aperte
	closeList();
	closeTable();

	if (inCodeBlock && codeBlockLines.length > 0) {
		const escapedCode = escapeHtml(codeBlockLines.join('\n'));
		output.push(
			`<div class="md-code-box"><pre><code class="language-${escapeHtml(
				codeBlockLang
			)}">${escapedCode}</code></pre></div>`
		);
	}

	return output.join('\n');
}

export interface HeadingItem {
	level: number;
	text: string;
	id: string;
}

export function extractHeadings(markdown: string): HeadingItem[] {
	if (!markdown || typeof markdown !== 'string') return [];
	const lines = markdown.split('\n');
	const headings: HeadingItem[] = [];
	for (const line of lines) {
		const match = line.trim().match(/^(#{1,4})\s+(.+)$/);
		if (match) {
			const level = match[1].length;
			const text = match[2].replace(/[#*`_~>[\]()|\\-]/g, '').trim();
			const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
			headings.push({ level, text, id });
		}
	}
	return headings;
}

/** Calcola statistiche rapide: conteggio parole e tempo stimato di lettura */
export function getMarkdownStats(text: string) {
	if (!text || typeof text !== 'string') {
		return { wordCount: 0, charCount: 0, readingTimeMinutes: 1 };
	}
	const plain = text.replace(/[#*`_~>[\]()|\\-]/g, ' ').trim();
	const words = plain ? plain.split(/\s+/).filter(Boolean) : [];
	const wordCount = words.length;
	const charCount = text.length;
	const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 180));
	return { wordCount, charCount, readingTimeMinutes };
}
