<script lang="ts">
	import { marked } from 'marked';
	import { sanitizeHtml } from '$lib/utils/sanitize';

	const { content = '' }: { content: string } = $props();

	const sanitizedHtml = $derived.by(() => {
		if (!content) return '';
		return sanitizeHtml(marked.parse(content, { async: false }));
	});
</script>

<div class="markdown-viewer" aria-label="Markdown content">{@html sanitizedHtml}</div>

<style>
	.markdown-viewer {
		color: var(--color-foreground);
		line-height: 1.65;
		overflow-wrap: anywhere;
	}

	.markdown-viewer :global(> :first-child) {
		margin-top: 0;
	}

	.markdown-viewer :global(> :last-child) {
		margin-bottom: 0;
	}

	.markdown-viewer :global(h1),
	.markdown-viewer :global(h2),
	.markdown-viewer :global(h3),
	.markdown-viewer :global(h4),
	.markdown-viewer :global(h5),
	.markdown-viewer :global(h6) {
		margin: 0.75rem 0 0.35rem;
		font-weight: 600;
		line-height: 1.3;
	}

	.markdown-viewer :global(h1) {
		font-size: 1.5rem;
	}

	.markdown-viewer :global(h2) {
		font-size: 1.25rem;
	}

	.markdown-viewer :global(h3) {
		font-size: 1.125rem;
	}

	.markdown-viewer :global(p),
	.markdown-viewer :global(ul),
	.markdown-viewer :global(ol),
	.markdown-viewer :global(blockquote),
	.markdown-viewer :global(pre),
	.markdown-viewer :global(table) {
		margin: 0.5rem 0;
	}

	.markdown-viewer :global(ul),
	.markdown-viewer :global(ol) {
		padding-left: 1.5rem;
	}

	.markdown-viewer :global(ul) {
		list-style: disc;
	}

	.markdown-viewer :global(ol) {
		list-style: decimal;
	}

	.markdown-viewer :global(blockquote) {
		border-left: 3px solid var(--color-primary);
		padding-left: 0.75rem;
		color: var(--color-muted-foreground);
	}

	.markdown-viewer :global(code) {
		border-radius: 0.25rem;
		background: var(--color-muted);
		padding: 0.1rem 0.3rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.9em;
	}

	.markdown-viewer :global(pre) {
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: 0.375rem;
		background: var(--color-muted);
		padding: 0.75rem;
	}

	.markdown-viewer :global(pre code) {
		background: transparent;
		padding: 0;
	}

	.markdown-viewer :global(a) {
		color: var(--color-primary);
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
		transition: color 0.15s;
	}

	.markdown-viewer :global(a:hover) {
		color: color-mix(in srgb, var(--color-primary), transparent 20%);
	}

	.markdown-viewer :global(table) {
		display: block;
		max-width: 100%;
		overflow-x: auto;
		border-collapse: collapse;
	}

	.markdown-viewer :global(th),
	.markdown-viewer :global(td) {
		border: 1px solid var(--color-border);
		padding: 0.35rem 0.5rem;
		text-align: left;
	}

	.markdown-viewer :global(img) {
		max-width: 100%;
		height: auto;
	}
</style>
