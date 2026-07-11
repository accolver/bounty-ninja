<script lang="ts">
	import type { Solution, Pledge, Payout } from '$lib/bounty/types';
	import { accountState } from '$lib/nostr/account.svelte';
	import PaymentUnavailable from '$lib/components/shared/PaymentUnavailable.svelte';

	let {
		winningSolution,
		pledges,
		payouts = []
	}: {
		bountyAddress: string;
		winningSolution: Solution | undefined;
		pledges: Pledge[];
		payouts: Payout[];
	} = $props();

	const myPledges = $derived.by(() => {
		if (!accountState.pubkey) return [];
		return pledges.filter((pledge) => pledge.pubkey === accountState.pubkey);
	});
	const myTotalPledged = $derived(myPledges.reduce((sum, pledge) => sum + pledge.amount, 0));
	const hasReleased = $derived(
		accountState.pubkey ? payouts.some((payout) => payout.pubkey === accountState.pubkey) : false
	);
	const uniquePledgers = $derived(new Set(pledges.map((pledge) => pledge.pubkey)).size);
	const releasedPledgers = $derived(new Set(payouts.map((payout) => payout.pubkey)).size);
	const totalPledged = $derived(pledges.reduce((sum, pledge) => sum + pledge.amount, 0));
	const totalReleased = $derived(payouts.reduce((sum, payout) => sum + payout.amount, 0));
	const releasePercent = $derived(
		totalPledged > 0 ? Math.min(100, Math.round((totalReleased / totalPledged) * 100)) : 0
	);
	const needsRelease = $derived(
		accountState.isLoggedIn && myPledges.length > 0 && !hasReleased && winningSolution !== undefined
	);
</script>

{#if payouts.length > 0}
	<div class="space-y-2 text-sm text-muted-foreground">
		<p>
			{releasedPledgers} of {uniquePledgers} pledger{uniquePledgers === 1 ? '' : 's'} released ({releasePercent}%
			of declared funds)
		</p>
		<div class="mt-1.5 h-1.5 w-full rounded-full bg-muted">
			<div
				class="h-full rounded-full bg-success/70 transition-all"
				style="width: {releasePercent}%"
			></div>
		</div>
	</div>
{/if}

{#if hasReleased}
	<p class="text-sm font-medium text-success/70" role="status">
		You released your declared pledge ({myTotalPledged.toLocaleString()} sats).
	</p>
{:else if needsRelease}
	<PaymentUnavailable action="Fund release" />
{/if}
