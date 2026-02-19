<script lang="ts">
	import type { Pledge, Payout } from '$lib/bounty/types';
	import PledgeItem from './PledgeItem.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';

	const {
		pledges,
		payouts = [],
		isReleasePhase = false
	}: {
		pledges: Pledge[];
		payouts?: Payout[];
		isReleasePhase?: boolean;
	} = $props();
</script>

{#if pledges.length === 0}
	<EmptyState message="No pledges yet. Be the first to fund this bounty!" />
{:else}
	<ul class="space-y-2" aria-label="Pledge list">
		{#each pledges as pledge (pledge.id)}
			<PledgeItem {pledge} {payouts} {isReleasePhase} />
		{/each}
	</ul>
{/if}
