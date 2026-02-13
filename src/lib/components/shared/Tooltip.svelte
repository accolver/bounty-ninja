<script lang="ts">
	const { text, children }: { text: string; children: any } = $props();
</script>

<span class="group relative inline-flex items-center">
	{@render children()}
	<span
		class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-normal rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 w-max max-w-xs"
		role="tooltip"
	>
		{text}
	</span>
</span>
