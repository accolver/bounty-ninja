<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Crepe, CrepeFeature } from '@milkdown/crepe';
	import '@milkdown/crepe/theme/common/style.css';
	import '@milkdown/crepe/theme/frame-dark.css';

	const {
		value = '',
		placeholder = 'Start typing...',
		onchange,
		maxlength,
		id
	}: {
		value?: string;
		placeholder?: string;
		onchange?: (markdown: string) => void;
		maxlength?: number;
		id?: string;
	} = $props();

	let editorRoot: HTMLDivElement | undefined = $state();
	let crepe: Crepe | undefined = $state();
	// charCount is managed by the markdownUpdated listener, not reactive to the prop
	let charCount = $state(0);

	onMount(async () => {
		if (!editorRoot) return;

		// Snapshot the initial value for the editor — only read once at mount time
		const initialMarkdown = value;
		charCount = initialMarkdown.length;

		crepe = new Crepe({
			root: editorRoot,
			defaultValue: initialMarkdown,
			features: {
				[CrepeFeature.ImageBlock]: false,
				[CrepeFeature.Latex]: false,
				[CrepeFeature.BlockEdit]: false
			},
			featureConfigs: {
				[CrepeFeature.Placeholder]: {
					text: placeholder,
					mode: 'doc'
				}
			}
		});

		crepe.on((listener) => {
			listener.markdownUpdated((_ctx, markdown) => {
				charCount = markdown.length;
				if (maxlength && markdown.length > maxlength) return;
				onchange?.(markdown);
			});
		});

		await crepe.create();
	});

	onDestroy(() => {
		crepe?.destroy();
	});
</script>

<div
	{id}
	class="milkdown-editor-wrapper rounded-md border border-border bg-input dark:bg-input/30 text-sm text-foreground focus-within:border-primary focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 focus-within:ring-offset-background"
	role="textbox"
	aria-multiline="true"
	aria-label="Markdown editor"
>
	<div bind:this={editorRoot} class="milkdown-root"></div>
</div>

{#if maxlength}
	<div class="flex items-center justify-end">
		<p
			class="text-xs {charCount > maxlength
				? 'text-destructive font-medium'
				: 'text-muted-foreground'}"
			aria-live="polite"
		>
			{charCount.toLocaleString()}/{maxlength.toLocaleString()}
		</p>
	</div>
{/if}

<style>
	/* Override Milkdown's theme to match the app's design system */
	.milkdown-editor-wrapper :global(.milkdown) {
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

	/* Headings — use system font with proper weight for readability */
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror h1),
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror h2),
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror h3),
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror h4),
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror h5),
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror h6) {
		font-weight: 600;
		color: var(--color-foreground);
	}

	.milkdown-editor-wrapper :global(.milkdown .ProseMirror) {
		padding: 0.5rem 0.75rem;
		min-height: 20rem;
		outline: none;
		caret-color: var(--color-foreground);
	}

	/* Heading margin overrides — tighter spacing for a form context */
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror h1) {
		margin-top: 0.75rem;
	}
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror h2) {
		margin-top: 0.625rem;
	}
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror h3) {
		margin-top: 0.5rem;
	}
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror h4),
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror h5),
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror h6) {
		margin-top: 0.375rem;
	}
	/* First child heading should have no top margin */
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror > h1:first-child),
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror > h2:first-child),
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror > h3:first-child),
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror > h4:first-child),
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror > h5:first-child),
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror > h6:first-child) {
		margin-top: 0;
	}

	/* Blockquote bar — more visible */
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror blockquote::before) {
		background: var(--color-primary);
		opacity: 0.7;
	}

	/* Horizontal rule — more visible */
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror hr) {
		background-color: var(--color-muted-foreground);
		background-clip: content-box;
	}

	/* Text selection highlight */
	.milkdown-editor-wrapper :global(.milkdown .ProseMirror *::selection) {
		background: color-mix(in srgb, var(--color-primary), transparent 50%);
	}

	/* Placeholder styling — lock to body text size so headings don't blow it up */
	.milkdown-editor-wrapper :global(.milkdown .crepe-placeholder::before) {
		color: var(--color-muted-foreground);
		opacity: 0.6;
		font-size: 16px !important;
		line-height: 24px !important;
		font-family: var(--crepe-font-default) !important;
		font-weight: 400 !important;
	}

	/* Toolbar styling to match app */
	.milkdown-editor-wrapper :global(.milkdown-toolbar) {
		border-bottom: 1px solid var(--color-border);
		background: var(--color-card);
		border-radius: var(--radius-md) var(--radius-md) 0 0;
	}
</style>
