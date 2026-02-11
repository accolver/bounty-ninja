<script lang="ts">
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';

	const { content }: { content: string } = $props();

	/**
	 * Parse markdown then sanitize to prevent XSS.
	 * Strips <script>, event handlers, javascript: URLs, <iframe>.
	 * Adds target="_blank" rel="noopener noreferrer" to all links.
	 */
	const sanitizedContent = $derived(renderMarkdown(content));

	function renderMarkdown(text: string): string {
		if (!text) return '';

		// Parse markdown to HTML
		const rawHtml = marked.parse(text, { async: false }) as string;

		// Sanitize: strip dangerous elements and attributes
		const clean = DOMPurify.sanitize(rawHtml, {
			ALLOWED_TAGS: [
				'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'del',
				'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
				'ul', 'ol', 'li',
				'blockquote', 'pre', 'code',
				'a', 'img',
				'table', 'thead', 'tbody', 'tr', 'th', 'td',
				'hr', 'span', 'div', 'sup', 'sub'
			],
			ALLOWED_ATTR: [
				'href', 'src', 'alt', 'title', 'class',
				'target', 'rel', 'width', 'height'
			],
			FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'style'],
			FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur']
		});

		return clean;
	}

	// After sanitization, add target="_blank" to all links via DOMPurify hook
	if (typeof window !== 'undefined') {
		DOMPurify.addHook('afterSanitizeAttributes', (node) => {
			if (node.tagName === 'A') {
				node.setAttribute('target', '_blank');
				node.setAttribute('rel', 'noopener noreferrer');
			}
		});
	}
</script>

<div class="prose prose-sm max-w-none text-foreground leading-relaxed">
	{@html sanitizedContent}
</div>
