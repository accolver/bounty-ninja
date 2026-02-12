<script lang="ts">
	import { marked } from 'marked';
	import { sanitizeHtml } from '$lib/utils/sanitize';

	const { content }: { content: string } = $props();

	/**
	 * Parse markdown then sanitize to prevent XSS.
	 * Uses the canonical sanitizer which strips <script>, event handlers,
	 * javascript: URLs, <iframe>, and adds target="_blank" rel="noopener noreferrer"
	 * to all links.
	 */
	const sanitizedContent = $derived(renderMarkdown(content));

	function renderMarkdown(text: string): string {
		if (!text) return '';

		// Parse markdown to HTML
		const rawHtml = marked.parse(text, { async: false }) as string;

		// Sanitize using canonical sanitizer from $lib/utils/sanitize
		return sanitizeHtml(rawHtml);
	}
</script>

<div class="prose prose-sm max-w-none text-foreground leading-relaxed">
	{@html sanitizedContent}
</div>
