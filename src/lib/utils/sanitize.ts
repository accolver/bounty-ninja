import DOMPurify, { type Config } from 'dompurify';

/**
 * DOMPurify configuration for sanitizing user-generated HTML content.
 * Allows safe Markdown-rendered elements while blocking all script execution vectors.
 */
const SANITIZE_CONFIG: Config = {
	ALLOWED_TAGS: [
		'p',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'a',
		'img',
		'ul',
		'ol',
		'li',
		'code',
		'pre',
		'blockquote',
		'table',
		'thead',
		'tbody',
		'tr',
		'th',
		'td',
		'em',
		'strong',
		'del',
		'br',
		'hr',
		'details',
		'summary'
	],
	ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel'],
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
 * Sanitize HTML content using DOMPurify.
 * Strips dangerous elements and attributes to prevent XSS attacks.
 *
 * @param html - Raw HTML string to sanitize
 * @returns Sanitized HTML string safe for rendering via {@html}
 */
export function sanitizeHtml(html: string): string {
	return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}
