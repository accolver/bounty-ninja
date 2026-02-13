<script lang="ts">
	const {
		message,
		action
	}: {
		message: string;
		action?: { label: string; href: string };
	} = $props();
</script>

<div class="flex flex-col items-center justify-center gap-3 py-12 text-center">
	<p class="text-sm text-muted-foreground">{message}</p>
	{#if action}
		<a
			href={action.href}
			class="text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
		>
			{action.label}
		</a>
	{/if}
</div>
