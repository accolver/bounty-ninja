<script lang="ts">
	import type { Payout } from '$lib/bounty/types';
	import { accountState } from '$lib/nostr/account.svelte';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';

	const { payout }: { payout: Payout } = $props();

	const isSolver = $derived(accountState.pubkey === payout.solverPubkey);

	let copied = $state(false);

	async function copyToken() {
		try {
			await navigator.clipboard.writeText(payout.cashuToken);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Fallback: select text for manual copy
			copied = false;
		}
	}
</script>

{#if isSolver}
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
				You have been awarded <SatAmount amount={payout.amount} />!
			</p>
		</div>

		<!-- Claim instructions -->
		<p class="text-sm text-muted-foreground">
			Claim your tokens by importing the Cashu token below into your wallet.
		</p>

		<!-- Token display with copy -->
		<div class="flex items-stretch gap-2">
			<div class="flex-1 overflow-hidden rounded-md border border-border bg-background px-3 py-2">
				<p class="truncate font-mono text-xs text-foreground" title={payout.cashuToken}>
					{payout.cashuToken}
				</p>
			</div>
			<button
				type="button"
				class="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors
					hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				onclick={copyToken}
				aria-label={copied ? 'Token copied to clipboard' : 'Copy Cashu token to clipboard'}
			>
				{#if copied}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						class="h-3.5 w-3.5 text-success"
						aria-hidden="true"
					>
						<path
							fill-rule="evenodd"
							d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
							clip-rule="evenodd"
						/>
					</svg>
					Copied
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						class="h-3.5 w-3.5"
						aria-hidden="true"
					>
						<path
							d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z"
						/>
						<path
							d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z"
						/>
					</svg>
					Copy
				{/if}
			</button>
		</div>

		<!-- Security warning -->
		<p class="text-xs text-muted-foreground">
			<span class="font-medium text-warning">Important:</span> Cashu tokens are bearer instruments. Anyone
			with this token can redeem it. Import it into your wallet promptly.
		</p>
	</div>
{/if}
