<script lang="ts">
	const {
		value = '',
		placeholder = 'Start typing...',
		onchange,
		maxlength,
		id,
		ariaInvalid = false,
		ariaDescribedby
	}: {
		value?: string;
		placeholder?: string;
		onchange?: (markdown: string) => void;
		maxlength?: number;
		id?: string;
		ariaInvalid?: boolean;
		ariaDescribedby?: string;
	} = $props();

	let markdown = $state('');
	let charCount = $derived(markdown.length);

	$effect.pre(() => {
		markdown = value;
	});

	function handleInput(event: Event) {
		markdown = (event.currentTarget as HTMLTextAreaElement).value;
		onchange?.(markdown);
	}
</script>

<textarea
	{id}
	value={markdown}
	{placeholder}
	{maxlength}
	oninput={handleInput}
	aria-label="Markdown editor"
	aria-invalid={ariaInvalid}
	aria-describedby={ariaDescribedby}
	class="min-h-80 w-full resize-y rounded-md border border-border bg-input px-3 py-2 font-mono text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background dark:bg-input/30"
></textarea>

{#if maxlength}
	<div class="flex items-center justify-end">
		<p class="text-xs text-muted-foreground" aria-live="polite">
			{charCount.toLocaleString()}/{maxlength.toLocaleString()}
		</p>
	</div>
{/if}
