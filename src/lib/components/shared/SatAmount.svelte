<script lang="ts">
	import { btcPrice } from '$lib/services/btc-price.svelte';
	import { currencyStore } from '$lib/stores/currency.svelte';
	import { onMount } from 'svelte';

	const { amount }: { amount: number } = $props();

	const formattedSats = $derived(new Intl.NumberFormat().format(amount));

	const usdValue = $derived(btcPrice.formatSatsAsUsd(amount));

	// Show USD if preference is USD AND we have a price
	const showUsd = $derived(currencyStore.isUsd && usdValue !== null);

	const displayText = $derived(showUsd ? usdValue! : formattedSats);
	const unitLabel = $derived(showUsd ? '' : 'sats');
	const ariaLabel = $derived(
		showUsd ? `${usdValue} (${formattedSats} sats)` : `${formattedSats} sats`
	);

	// Ensure price is fetched when component mounts in USD mode
	onMount(() => {
		if (currencyStore.isUsd) {
			btcPrice.fetch();
		}
	});
</script>

<button
	type="button"
	onclick={() => currencyStore.toggle()}
	class="inline-flex cursor-pointer items-center gap-1 font-medium text-accent transition-colors hover:text-accent/80"
	aria-label={ariaLabel}
	title="Click to toggle between USD and sats"
>
	<span>{displayText}</span>
	{#if unitLabel}
		<span class="text-xs font-normal">{unitLabel}</span>
	{/if}
</button>
