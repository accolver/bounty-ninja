<script lang="ts">
	import type { Solution, Payout, VoteTally } from '$lib/bounty/types';
	import { nip19 } from 'nostr-tools';
	import { formatNpub } from '$lib/utils/format';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';

	const {
		winningSolution,
		payout,
		tally
	}: {
		winningSolution?: Solution;
		payout?: Payout;
		tally?: VoteTally;
	} = $props();

	const solverNpub = $derived(
		winningSolution ? nip19.npubEncode(winningSolution.pubkey) : null
	);
</script>

<div class="rounded-lg border border-primary/30 bg-primary/5 p-4" aria-label="Bounty results">
	{#if tally?.isTied}
		<div class="space-y-3">
			<div class="flex items-center gap-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					class="h-5 w-5 text-warning"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
						clip-rule="evenodd"
					/>
				</svg>
				<h3 class="text-sm font-semibold text-warning">Vote Tied</h3>
			</div>
			<p class="text-sm text-muted-foreground">
				Votes are evenly split. More votes are needed to reach a decision.
				A strict majority is required for approval.
			</p>
		</div>
	{:else if winningSolution && solverNpub}
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
