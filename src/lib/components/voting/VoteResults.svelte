<script lang="ts">
	import type { Solution, Payout } from '$lib/task/types';
	import { nip19 } from 'nostr-tools';
	import { formatNpub } from '$lib/utils/format';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';

	const {
		winningSolution,
		payout
	}: {
		winningSolution?: Solution;
		payout?: Payout;
	} = $props();

	const solverNpub = $derived(
		winningSolution ? nip19.npubEncode(winningSolution.pubkey) : null
	);
</script>

<div class="rounded-lg border border-primary/30 bg-primary/5 p-4" aria-label="Task results">
	{#if winningSolution && solverNpub}
		<div class="space-y-3">
			<div class="flex items-center gap-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 16 16"
					fill="currentColor"
					class="h-5 w-5 text-warning"
					aria-hidden="true"
				>
					<path
						d="M7.628 1.099a.75.75 0 0 1 .744 0l5.25 3a.75.75 0 0 1 0 1.302l-5.25 3a.75.75 0 0 1-.744 0l-5.25-3a.75.75 0 0 1 0-1.302l5.25-3ZM2.57 7.2l4.68 2.674a.75.75 0 0 0 .744 0L12.68 7.2l1.57.898a.75.75 0 0 1 0 1.302l-5.25 3a.75.75 0 0 1-.744 0l-5.25-3a.75.75 0 0 1 0-1.302L2.57 7.2Z"
					/>
				</svg>
				<h3 class="text-sm font-semibold text-foreground">Winning Solution</h3>
			</div>

			<p class="text-sm text-muted-foreground">
				Solved by
				<a
					href="/profile/{solverNpub}"
					class="font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
				>
					{formatNpub(solverNpub)}
				</a>
			</p>

			{#if payout}
				<div class="flex items-center gap-2 text-sm">
					<span class="text-muted-foreground">Payout:</span>
					<SatAmount amount={payout.amount} />
				</div>
			{/if}
		</div>
	{:else}
		<p class="text-sm text-muted-foreground">
			No winning solution determined.
		</p>
	{/if}
</div>
