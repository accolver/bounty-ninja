<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Crepe, CrepeFeature } from '@milkdown/crepe';
	import '@milkdown/crepe/theme/common/style.css';
	import '@milkdown/crepe/theme/frame-dark.css';

	const { content = '' }: { content: string } = $props();

	let viewerRoot: HTMLDivElement | undefined = $state();
	let crepe: Crepe | undefined;
	let currentContent: string | undefined;

	const CREPE_FEATURES = {
		[CrepeFeature.ImageBlock]: false,
		[CrepeFeature.Latex]: false,
		[CrepeFeature.BlockEdit]: false,
		[CrepeFeature.Toolbar]: false,
		[CrepeFeature.Placeholder]: false,
		[CrepeFeature.Cursor]: false
	} as const;

	// Single effect handles both initial mount and content changes
	$effect(() => {
		if (!viewerRoot || !content) return;

		// Skip if content hasn't changed
		if (content === currentContent && crepe) return;
		currentContent = content;

		// Destroy previous instance if it exists
		if (crepe) {
			crepe.destroy();
			crepe = undefined;
		}

		const instance = new Crepe({
			root: viewerRoot,
			defaultValue: content,
			features: CREPE_FEATURES
		});

		instance.create().then(() => {
			instance.setReadonly(true);
			crepe = instance;
		});
	});

	onDestroy(() => {
		crepe?.destroy();
	});
</script>

<div class="milkdown-viewer-wrapper" aria-label="Markdown content">
	<div bind:this={viewerRoot} class="milkdown-viewer-root"></div>
</div>

<style>
	/* Override Milkdown's theme to match the app's design system */
	.milkdown-viewer-wrapper :global(.milkdown) {
		--crepe-color-background: transparent;
		--crepe-color-on-background: var(--color-foreground);
		--crepe-color-surface: transparent;
		--crepe-color-surface-low: var(--color-card);
		--crepe-color-on-surface: var(--color-foreground);
		--crepe-color-on-surface-variant: var(--color-muted-foreground);
		--crepe-color-outline: var(--color-muted-foreground);
		--crepe-color-primary: var(--color-primary);
		--crepe-color-secondary: var(--color-muted);
		--crepe-color-on-secondary: var(--color-foreground);
		--crepe-color-inverse: var(--color-foreground);
		--crepe-color-on-inverse: var(--color-background);
		--crepe-color-inline-code: var(--color-accent);
		--crepe-color-error: var(--color-destructive);
		--crepe-color-hover: var(--color-muted);
		--crepe-color-selected: color-mix(in srgb, var(--color-primary), transparent 60%);
		--crepe-color-inline-area: var(--color-muted);

		--crepe-font-default: inherit;
		--crepe-font-title: inherit;
		--crepe-font-code:
			ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
	}

	/* Remove editor-like padding, make it feel like a rendered document */
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror) {
		padding: 0;
		min-height: 0;
		outline: none;
		cursor: default;
	}

	/* Headings — system font with proper weight */
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror h1),
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror h2),
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror h3),
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror h4),
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror h5),
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror h6) {
		font-weight: 600;
		color: var(--color-foreground);
	}

	/* Heading margin — slightly tighter for card contexts */
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror h1) {
		margin-top: 0.75rem;
	}
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror h2) {
		margin-top: 0.625rem;
	}
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror h3) {
		margin-top: 0.5rem;
	}
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror h4),
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror h5),
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror h6) {
		margin-top: 0.375rem;
	}
	/* First child heading should have no top margin */
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror > h1:first-child),
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror > h2:first-child),
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror > h3:first-child),
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror > h4:first-child),
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror > h5:first-child),
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror > h6:first-child) {
		margin-top: 0;
	}

	/* Blockquote bar — visible accent */
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror blockquote::before) {
		background: var(--color-primary);
		opacity: 0.7;
	}

	/* Horizontal rule */
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror hr) {
		background-color: var(--color-muted-foreground);
		background-clip: content-box;
	}

	/* Links should be clickable in read-only mode */
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror a) {
		color: var(--color-primary);
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
		transition: color 0.15s;
	}
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror a:hover) {
		color: color-mix(in srgb, var(--color-primary), transparent 20%);
	}

	/* Subtle text selection in read-only mode */
	.milkdown-viewer-wrapper :global(.milkdown .ProseMirror *::selection) {
		background: color-mix(in srgb, var(--color-primary), transparent 70%);
	}
</style>
