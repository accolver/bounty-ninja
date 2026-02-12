import DOMPurify, { type Config } from 'dompurify';

/**
 * DOMPurify configuration for sanitizing user-generated HTML content.
 * Allows safe Markdown-rendered elements while blocking all script execution vectors.
 */
const SANITIZE_CONFIG: Config = {
	ALLOWED_TAGS: [
		'p',
		'br',
		'strong',
		'em',
		'b',
		'i',
		'u',
		's',
		'del',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'ul',
		'ol',
		'li',
		'blockquote',
		'pre',
		'code',
		'a',
		'img',
		'table',
		'thead',
		'tbody',
		'tr',
		'th',
		'td',
		'hr',
		'span',
		'div',
		'sup',
		'sub',
		'details',
		'summary'
	],
	ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel', 'width', 'height'],
	ALLOW_DATA_ATTR: false,
	FORBID_TAGS: [
		'script',
		'iframe',
		'object',
		'embed',
		'form',
		'style',
		'input',
		'textarea',
		'select',
		'button'
	],
	FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur']
};

/**
 * Tracks whether the DOMPurify hook for safe link attributes has been registered.
 * Uses lazy initialization to avoid module-level side effects on import.
 */
let hooksRegistered = false;

/**
 * Register DOMPurify hook to enforce safe link attributes (once).
 * All anchor tags get target="_blank" and rel="noopener noreferrer"
 * to prevent reverse tabnabbing on user-generated links.
 */
function ensureHooksRegistered(): void {
	if (hooksRegistered) return;
	hooksRegistered = true;

	if (typeof window !== 'undefined') {
		DOMPurify.addHook('afterSanitizeAttributes', (node) => {
			if (node.tagName === 'A') {
				node.setAttribute('target', '_blank');
				node.setAttribute('rel', 'noopener noreferrer');
			}
		});
	}
}

/**
 * Sanitize HTML content using DOMPurify.
 * Strips dangerous elements and attributes to prevent XSS attacks.
 * All links are automatically given target="_blank" rel="noopener noreferrer".
 *
 * @param html - Raw HTML string to sanitize
 * @returns Sanitized HTML string safe for rendering via {@html}
 */
export function sanitizeHtml(html: string): string {
	ensureHooksRegistered();
	return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}
