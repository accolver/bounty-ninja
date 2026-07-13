<script lang="ts">
	import type { Snippet } from 'svelte';

	const { text, children }: { text: string; children: Snippet } = $props();

	let open = $state(false);
	const tooltipId = `tooltip-${crypto.randomUUID()}`;

	function toggle(e: Event) {
		e.stopPropagation();
		open = !open;
	}

	function close() {
		open = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') close();
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			open = !open;
		}
	}
</script>

<!-- Close tooltip when tapping outside -->
<svelte:document onclick={open ? close : undefined} />

<span class="group relative inline-flex items-center">
	<span
		role="button"
		tabindex="0"
		class="inline-flex cursor-pointer items-center"
		onclick={toggle}
		onkeydown={handleKeydown}
		onpointerenter={() => (open = true)}
		onpointerleave={close}
		onfocus={() => (open = true)}
		onblur={close}
		aria-describedby={open ? tooltipId : undefined}
	>
		{@render children()}
	</span>
	{#if open}
		<span
			id={tooltipId}
			class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-xs -translate-x-1/2 rounded-md border border-border bg-popover px-3 py-2 text-xs font-normal whitespace-normal text-popover-foreground shadow-md"
			role="tooltip"
		>
			{text}
		</span>
	{/if}
</span>
