<script lang="ts">
	const { amount }: { amount: number } = $props();

	const formatted = $derived(new Intl.NumberFormat().format(amount));
</script>

<span class="inline-flex items-center gap-1 font-medium text-accent" aria-label="{formatted} sats">
	<span>{formatted}</span>
	<span class="text-xs font-normal">sats</span>
</span>
