<script lang="ts">
	const { text, children }: { text: string; children: any } = $props();

	let open = $state(false);

	function toggle(e: Event) {
		e.stopPropagation();
		open = !open;
	}

	function close() {
		open = false;
	}
</script>

<!-- Close tooltip when tapping outside -->
<svelte:document onclick={open ? close : undefined} />

<span class="group relative inline-flex items-center">
	<button
		type="button"
		class="inline-flex cursor-pointer items-center"
		onclick={toggle}
		aria-describedby={open ? 'tooltip-content' : undefined}
	>
		{@render children()}
	</button>
	<span
		id="tooltip-content"
		class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-normal rounded-md border border-border bg-popover px-3 py-2 text-xs font-normal text-popover-foreground shadow-md transition-opacity w-max max-w-xs {open
			? 'opacity-100'
			: 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}"
		role="tooltip"
	>
		{text}
	</span>
</span>
