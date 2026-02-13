<script lang="ts">
	import type { Snippet } from 'svelte';

	const {
		message,
		action,
		icon,
		hint
	}: {
		message: string;
		action?: { label: string; href: string };
		icon?: Snippet;
		hint?: string;
	} = $props();
</script>

<div class="flex flex-col items-center justify-center gap-3 py-12 text-center">
	{#if icon}
		<div class="text-muted-foreground/50">
			{@render icon()}
		</div>
	{/if}
	<p class="text-sm text-muted-foreground">{message}</p>
	{#if hint}
		<p class="max-w-md text-xs text-muted-foreground/70">{hint}</p>
	{/if}
	{#if action}
		<a
			href={action.href}
			class="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			{action.label}
		</a>
	{/if}
</div>
