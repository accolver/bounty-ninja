<script lang="ts">
	import type { BountyDetail, Pledge } from '$lib/bounty/types';
	import { accountState } from '$lib/nostr/account.svelte';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';

	const { detail }: { detail: BountyDetail } = $props();
	let dismissed = $state(false);

	const myPledges = $derived.by(() => {
		if (!accountState.pubkey) return [];
		return detail.pledges.filter((pledge: Pledge) => pledge.pubkey === accountState.pubkey);
	});
	const myTotalPledged = $derived(
		myPledges.reduce((sum: number, pledge: Pledge) => sum + pledge.amount, 0)
	);
	const shouldShow = $derived(
		!dismissed &&
			detail.status === 'expired' &&
			detail.payouts.length === 0 &&
			myPledges.length > 0 &&
			accountState.isAuthenticated
	);
</script>

{#if shouldShow}
	<div class="border-y border-warning/40 py-4" role="alert" aria-live="polite">
		<div class="space-y-3">
			<p class="font-semibold text-warning">This bounty expired with an unreleased pledge.</p>
			<p class="text-sm text-foreground">
				Your declared pledge is <SatAmount amount={myTotalPledged} />. Open each pledge below and
				use Reclaim / retract. The guided flow requires Minibits Revert and verifies every source
				proof is spent before publishing a retraction.
			</p>
			<button
				type="button"
				onclick={() => (dismissed = true)}
				class="cursor-pointer text-xs text-foreground underline transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
			>
				Dismiss notice
			</button>
		</div>
	</div>
{/if}
