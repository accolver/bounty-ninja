<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { retractionBlueprint, reputationBlueprint } from '$lib/bounty/blueprints';
	import { accountState } from '$lib/nostr/account.svelte';
	import { publishEvent } from '$lib/nostr/signer.svelte';
	import XCircle from '@lucide/svelte/icons/x-circle';

	const {
		taskAddress,
		pledgeEventId,
		hasSolutions
	}: {
		/** NIP-33 bounty address */
		taskAddress: string;
		/** Event ID of the pledge to retract */
		pledgeEventId: string;
		/** Whether solutions have been submitted */
		hasSolutions: boolean;
	} = $props();

	let confirming = $state(false);
	let publishing = $state(false);

	async function handleRetract() {
		if (!confirming) {
			confirming = true;
			return;
		}

		publishing = true;
		try {
			const template = retractionBlueprint({
				taskAddress,
				type: 'pledge',
				pledgeEventId,
				creatorPubkey: accountState.pubkey!
			});

			const { event: signed } = await publishEvent(template);

			// If solutions exist, publish reputation event
			if (hasSolutions) {
				const repTemplate = reputationBlueprint({
					offenderPubkey: accountState.pubkey!,
					taskAddress,
					type: 'pledge_retraction',
					retractionEventId: signed.id,
					description: 'Retracted pledge after solutions were submitted'
				});
				await publishEvent(repTemplate);
			}

			// Note: Token reclaim requires private key access.
			// The pledger retains the P2PK key and can reclaim tokens
			// from their Cashu wallet at any time independently.

			confirming = false;
		} catch (err) {
			console.error('[RetractPledgeButton] Failed to retract:', err);
		} finally {
			publishing = false;
		}
	}

	function cancel() {
		confirming = false;
	}
</script>

{#if confirming}
	<div class="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
		{#if hasSolutions}
			<p class="text-xs font-medium text-destructive">
				⚠️ Solutions exist. Retracting will publish a reputation event.
			</p>
		{/if}
		<div class="flex gap-2">
			<Button variant="destructive" size="sm" disabled={publishing} onclick={handleRetract}>
				{publishing ? 'Retracting…' : 'Confirm'}
			</Button>
			<Button variant="outline" size="sm" onclick={cancel} disabled={publishing}>
				Cancel
			</Button>
		</div>
	</div>
{:else}
	<button
		type="button"
		onclick={handleRetract}
		class="text-xs text-destructive/70 transition-colors hover:text-destructive hover:cursor-pointer"
		aria-label="Retract pledge"
	>
		<XCircle class="inline size-3" />
		Retract
	</button>
{/if}
