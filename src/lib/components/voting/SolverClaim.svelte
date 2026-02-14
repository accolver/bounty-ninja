<script lang="ts">
	import type { Payout, Pledge } from '$lib/bounty/types';
	import { accountState } from '$lib/nostr/account.svelte';
	import { nip19 } from 'nostr-tools';
	import { formatNpub } from '$lib/utils/format';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';

	const {
		payouts,
		pledges = []
	}: {
		payouts: Payout[];
		pledges?: Pledge[];
	} = $props();

	/** Whether the current user is the solver for these payouts */
	const isSolver = $derived(payouts.length > 0 && accountState.pubkey === payouts[0].solverPubkey);

	/** Total aggregate payout amount */
	const totalAmount = $derived(payouts.reduce((sum, p) => sum + p.amount, 0));

	/** Release progress */
	const uniquePledgers = $derived(new Set(pledges.map((p) => p.pubkey)).size);
	const releasedPledgers = $derived(new Set(payouts.map((p) => p.pubkey)).size);

	let copiedIndex = $state<number | null>(null);

	async function copyToken(token: string, index: number) {
		try {
			await navigator.clipboard.writeText(token);
			copiedIndex = index;
			setTimeout(() => (copiedIndex = null), 2000);
		} catch {
			copiedIndex = null;
		}
	}
</script>

{#if isSolver && payouts.length > 0}
	<div
		class="rounded-lg border border-success/50 bg-success/10 p-4 space-y-3"
		role="status"
		aria-label="Payout awarded"
	>
		<!-- Award header -->
		<div class="flex items-center gap-2">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				class="h-5 w-5 text-success"
				aria-hidden="true"
			>
				<path
					fill-rule="evenodd"
					d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
					clip-rule="evenodd"
				/>
			</svg>
			<p class="font-medium text-foreground">
				You have been awarded <SatAmount amount={totalAmount} />!
			</p>
		</div>

		<!-- Release progress -->
		{#if uniquePledgers > 1}
			<p class="text-xs text-muted-foreground">
				{releasedPledgers} of {uniquePledgers} pledger{uniquePledgers === 1 ? '' : 's'} have released
				funds.
				{#if releasedPledgers < uniquePledgers}
					Some pledgers have not yet released their portion.
				{/if}
			</p>
		{/if}

		<!-- Individual payouts -->
		<div class="space-y-2">
			<p class="text-sm text-muted-foreground">
				{#if payouts.length === 1}
					Claim your tokens by importing the Cashu token below into your wallet.
				{:else}
					Claim each token below by importing them into your wallet.
				{/if}
			</p>

			{#each payouts as payout, i (payout.id)}
				<div class="rounded-md border border-border bg-background p-2 space-y-1.5">
					{#if payouts.length > 1}
						<div class="flex items-center justify-between text-xs text-muted-foreground">
							<span>
								From {formatNpub(nip19.npubEncode(payout.pubkey))}
							</span>
							<SatAmount amount={payout.amount} />
						</div>
					{/if}
					<div class="flex items-stretch gap-2">
						<div class="flex-1 overflow-hidden rounded-md border border-border bg-card px-3 py-2">
							<p class="truncate font-mono text-xs text-foreground" title={payout.cashuToken}>
								{payout.cashuToken}
							</p>
						</div>
						<button
							type="button"
							class="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors
								hover:bg-muted hover:cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
							onclick={() => copyToken(payout.cashuToken, i)}
							aria-label={copiedIndex === i
								? 'Token copied to clipboard'
								: 'Copy Cashu token to clipboard'}
						>
							{#if copiedIndex === i}
								Copied
							{:else}
								Copy
							{/if}
						</button>
					</div>
				</div>
			{/each}
		</div>

		<!-- Security warning -->
		<p class="text-xs text-muted-foreground">
			<span class="font-medium text-warning">Important:</span> Cashu tokens are bearer instruments. Anyone
			with these tokens can redeem them. Import them into your wallet promptly.
		</p>
	</div>
{/if}
