<script lang="ts">
	import type { BountyDetail, Pledge } from '$lib/bounty/types';
	import { accountState } from '$lib/nostr/account.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { collectPledgeTokens, reclaimExpiredPledge } from '$lib/cashu/escrow';
	import { encodeToken, getProofsAmount } from '$lib/cashu/token';
	import { DoubleSpendError } from '$lib/cashu/types';
	import { nip19 } from 'nostr-tools';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';

	const { detail }: { detail: BountyDetail } = $props();

	// Track dismissed state per bounty (persists only for session)
	let dismissed = $state(false);
	let reclaiming = $state(false);
	let reclaimStep = $state('');
	let showKeyInput = $state(false);
	let privkeyInput = $state('');
	let reclaimedToken = $state('');

	/** Find pledges made by the current user */
	const myPledges = $derived.by(() => {
		if (!accountState.pubkey) return [];
		return detail.pledges.filter((p: Pledge) => p.pubkey === accountState.pubkey);
	});

	/** Total amount the current user has pledged */
	const myTotalPledged = $derived(myPledges.reduce((sum: number, p: Pledge) => sum + p.amount, 0));

	/** Is the bounty expired? */
	const isExpired = $derived(detail.status === 'expired');

	/** Has no payout been made? */
	const noPayout = $derived(!detail.payout);

	/** Should the alert be visible? */
	const shouldShow = $derived(
		!dismissed &&
			isExpired &&
			noPayout &&
			myPledges.length > 0 &&
			accountState.isLoggedIn &&
			!reclaimedToken
	);

	/** Validate the private key format (hex or nsec) */
	function isValidKey(key: string): boolean {
		const trimmed = key.trim();
		// Hex: 64 hex chars
		if (/^[0-9a-f]{64}$/i.test(trimmed)) return true;
		// nsec: starts with nsec1
		if (trimmed.startsWith('nsec1')) return true;
		return false;
	}

	/** Convert nsec to hex if needed */
	function toHexPrivkey(input: string): string {
		const trimmed = input.trim();
		if (/^[0-9a-f]{64}$/i.test(trimmed)) return trimmed;
		if (trimmed.startsWith('nsec1')) {
			try {
				const decoded = nip19.decode(trimmed);
				if (decoded.type === 'nsec') {
					// nip19.decode returns Uint8Array for nsec — convert to hex
					const bytes = decoded.data as Uint8Array;
					return Array.from(bytes)
						.map((b) => b.toString(16).padStart(2, '0'))
						.join('');
				}
			} catch {
				// fall through
			}
		}
		throw new Error('Invalid private key format');
	}

	async function handleReclaim() {
		if (!isValidKey(privkeyInput)) {
			toastStore.error('Invalid private key. Enter your nsec or hex private key.');
			return;
		}

		reclaiming = true;
		reclaimStep = 'Preparing...';

		try {
			const hexKey = await toHexPrivkey(privkeyInput);

			// Build Nostr events for our pledges to decode tokens
			reclaimStep = 'Decoding pledge tokens...';
			const pledgeEvents = myPledges.map((p: Pledge) => p.event);
			const decoded = await collectPledgeTokens(pledgeEvents);

			if (decoded.length === 0) {
				toastStore.error('No valid pledge tokens found to reclaim.');
				return;
			}

			const reclaimedProofs: { proofs: import('@cashu/cashu-ts').Proof[]; mint: string }[] = [];
			let totalReclaimed = 0;

			for (let i = 0; i < decoded.length; i++) {
				const pledge = decoded[i];
				reclaimStep = `Reclaiming token ${i + 1}/${decoded.length}...`;

				const result = await reclaimExpiredPledge(pledge, hexKey);
				if (result.success && result.sendProofs.length > 0) {
					const amount = getProofsAmount(result.sendProofs);
					totalReclaimed += amount;
					reclaimedProofs.push({ proofs: result.sendProofs, mint: pledge.mint });
				} else if (!result.success) {
					console.warn(`[reclaim] Failed for pledge ${pledge.eventId}: ${result.error}`);
				}
			}

			if (reclaimedProofs.length === 0) {
				toastStore.error('Could not reclaim any tokens. They may have already been spent.');
				return;
			}

			// Encode reclaimed proofs as a token string the user can copy
			reclaimStep = 'Encoding reclaimed tokens...';
			const tokenStrings: string[] = [];
			for (const entry of reclaimedProofs) {
				const encoded = await encodeToken(
					entry.proofs,
					entry.mint,
					'Reclaimed bounty.ninja pledge'
				);
				tokenStrings.push(encoded);
			}
			reclaimedToken = tokenStrings.join('\n');

			toastStore.success(`Reclaimed ${totalReclaimed} sats!`);
		} catch (err) {
			if (err instanceof DoubleSpendError) {
				toastStore.error('Tokens already spent — the creator may have claimed them.');
			} else {
				toastStore.error(err instanceof Error ? err.message : 'Reclaim failed');
			}
		} finally {
			reclaiming = false;
			reclaimStep = '';
			privkeyInput = ''; // Clear private key from memory
		}
	}
</script>

{#if shouldShow}
	<div
		class="rounded-lg border-2 border-warning/60 bg-warning/10 p-4"
		role="alert"
		aria-live="assertive"
	>
		<div class="flex items-start gap-3">
			<div class="flex-shrink-0 text-warning text-xl" aria-hidden="true">!</div>
			<div class="flex-1 space-y-2">
				<p class="font-semibold text-warning">
					This bounty has expired. You can reclaim your pledge.
				</p>
				<p class="text-sm text-foreground">
					You pledged <SatAmount amount={myTotalPledged} /> to this bounty. Since it expired without a
					payout, you can reclaim your tokens using your private key.
				</p>

				{#if !showKeyInput}
					<div class="flex gap-2 pt-1">
						<button
							type="button"
							onclick={() => (showKeyInput = true)}
							class="cursor-pointer rounded-md bg-warning px-4 py-2 text-sm font-medium text-warning-foreground transition-colors hover:bg-warning/90 focus-visible:ring-2 focus-visible:ring-ring"
						>
							Reclaim Tokens
						</button>
						<button
							type="button"
							onclick={() => (dismissed = true)}
							class="cursor-pointer rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
						>
							Dismiss
						</button>
					</div>
				{:else}
					<div class="space-y-3 pt-1">
						<div class="space-y-1.5">
							<label for="reclaim-key" class="text-sm font-medium text-foreground">
								Private Key (nsec or hex)
							</label>
							<input
								id="reclaim-key"
								type="password"
								bind:value={privkeyInput}
								placeholder="nsec1... or hex private key"
								disabled={reclaiming}
								class="w-full rounded-md border border-border bg-white dark:bg-input/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background focus:outline-none disabled:opacity-50"
							/>
							<p class="text-xs text-muted-foreground">
								Your key is used locally to sign the refund and is never stored or transmitted.
							</p>
						</div>
						<div class="flex gap-2">
							<button
								type="button"
								onclick={handleReclaim}
								disabled={reclaiming || !privkeyInput.trim()}
								class="cursor-pointer rounded-md bg-warning px-4 py-2 text-sm font-medium text-warning-foreground transition-colors hover:bg-warning/90 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
							>
								{#if reclaiming}
									{reclaimStep || 'Reclaiming...'}
								{:else}
									Confirm Reclaim
								{/if}
							</button>
							<button
								type="button"
								onclick={() => {
									showKeyInput = false;
									privkeyInput = '';
								}}
								disabled={reclaiming}
								class="cursor-pointer rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
							>
								Cancel
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

{#if reclaimedToken}
	<div
		class="rounded-lg border-2 border-success/60 bg-success/10 p-4"
		role="alert"
		aria-live="polite"
	>
		<div class="space-y-2">
			<p class="font-semibold text-success">Tokens reclaimed successfully!</p>
			<p class="text-sm text-foreground">
				Copy the token below and receive it in your Cashu wallet.
			</p>
			<div class="relative">
				<textarea
					readonly
					value={reclaimedToken}
					rows={3}
					class="w-full rounded-md border border-border bg-white dark:bg-input/30 px-3 py-2 text-xs font-mono text-foreground"
				></textarea>
				<button
					type="button"
					onclick={() => {
						navigator.clipboard.writeText(reclaimedToken);
						toastStore.success('Token copied to clipboard');
					}}
					class="absolute top-2 right-2 cursor-pointer rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring"
				>
					Copy
				</button>
			</div>
		</div>
	</div>
{/if}
