<script lang="ts">
	import { safeEventUrl } from '$lib/utils/safe-event-url';

	const { url }: { url: string } = $props();
	const safeUrl = $derived(safeEventUrl(url, 'external-link'));
</script>

<div class="text-sm">
	<span class="text-muted-foreground">Deliverable: </span>
	{#if safeUrl}
		<a
			href={safeUrl}
			target="_blank"
			rel="noopener noreferrer"
			class="rounded-sm font-medium text-foreground underline underline-offset-2 transition-colors hover:text-primary hover:cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
			aria-label="Deliverable link (opens in new tab)"
		>
			{url}
		</a>
	{:else}
		<span class="break-all text-muted-foreground" aria-label="Invalid deliverable URL">{url}</span>
	{/if}
</div>
