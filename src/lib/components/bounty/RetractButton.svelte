<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { retractionBlueprint, reputationBlueprint } from '$lib/bounty/blueprints';
	import { accountState } from '$lib/nostr/account.svelte';
	import { publishEvent } from '$lib/nostr/signer.svelte';
	import XCircle from '@lucide/svelte/icons/x-circle';

	const {
		taskAddress,
		hasSolutions
	}: {
		/** NIP-33 bounty address (kind:pubkey:d-tag) */
		taskAddress: string;
		/** Whether solutions have been submitted */
		hasSolutions: boolean;
	} = $props();

	let confirming = $state(false);
	let publishing = $state(false);
	let reason = $state('');

	async function handleRetract() {
		if (!confirming) {
			confirming = true;
			return;
		}

		publishing = true;
		try {
			const template = retractionBlueprint({
				taskAddress,
				type: 'bounty',
				creatorPubkey: accountState.pubkey!,
				reason
			});

			const { event: signed } = await publishEvent(template);

			// If solutions exist, publish reputation event
			if (hasSolutions) {
				const repTemplate = reputationBlueprint({
					offenderPubkey: accountState.pubkey!,
					taskAddress,
					type: 'bounty_retraction',
					retractionEventId: signed.id,
					description: `Cancelled bounty after solutions were submitted`
				});
				await publishEvent(repTemplate);
			}

			confirming = false;
		} catch (err) {
			console.error('[RetractButton] Failed to retract:', err);
		} finally {
			publishing = false;
		}
	}

	function cancel() {
		confirming = false;
		reason = '';
	}
</script>

{#if confirming}
	<div class="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
		{#if hasSolutions}
			<p class="text-sm font-medium text-destructive">
				⚠️ This bounty has solutions. Cancelling will publish a reputation event visible to all
				users.
			</p>
		{/if}
		<label class="block">
			<span class="text-xs text-muted-foreground">Reason (optional)</span>
			<input
				type="text"
				bind:value={reason}
				placeholder="Why are you cancelling?"
				class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
			/>
		</label>
		<div class="flex gap-2">
			<Button
				variant="destructive"
				size="sm"
				disabled={publishing}
				onclick={handleRetract}
				class="gap-1.5"
			>
				{#if publishing}
					Cancelling…
				{:else}
					Confirm Cancel
				{/if}
			</Button>
			<Button variant="outline" size="sm" onclick={cancel} disabled={publishing}>
				Keep Bounty
			</Button>
		</div>
	</div>
{:else}
	<Button variant="outline" size="sm" onclick={handleRetract} class="gap-1.5 text-destructive hover:text-destructive hover:cursor-pointer transition-colors">
		<XCircle class="size-4" />
		Cancel Bounty
	</Button>
{/if}
