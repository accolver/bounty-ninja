<script lang="ts">
	import { onMount } from 'svelte';
	import type { Pledge } from '$lib/bounty/types';
	import { Button } from '$lib/components/ui/button/index.js';
	import { retractionBlueprint, reputationBlueprint } from '$lib/bounty/blueprints';
	import { accountState } from '$lib/nostr/account.svelte';
	import { publishEvent, signEventTemplate } from '$lib/nostr/signer.svelte';
	import { paymentJournal, type PaymentOperationRecord } from '$lib/cashu/payment-journal';
	import { publishJournaledEvent } from '$lib/cashu/publish-journaled-event';
	import { verifySourceProofsSpent } from '$lib/cashu/manual-token-verifier';
	import { arePaymentWritesEnabled } from '$lib/utils/env';
	import XCircle from '@lucide/svelte/icons/x-circle';

	const {
		bountyAddress,
		pledge,
		hasSolutions
	}: {
		bountyAddress: string;
		pledge: Pledge;
		hasSolutions: boolean;
	} = $props();
	const paymentWritesEnabled = arePaymentWritesEnabled();
	let confirming = $state(false);
	let publishing = $state(false);
	let operation = $state<PaymentOperationRecord | null>(null);
	let error = $state('');

	onMount(async () => {
		operation =
			(await paymentJournal.listPending()).find(
				(item) => item.intent.kind === 'reclaim' && item.intent.sourceEventIds.includes(pledge.id)
			) ?? null;
		if (operation) confirming = true;
	});

	async function beginReclaim() {
		if (!paymentWritesEnabled) return;
		confirming = true;
		if (!operation) {
			operation = await paymentJournal.create({
				kind: 'reclaim',
				sourceEventIds: [pledge.id],
				mintUrl: pledge.mintUrl,
				amount: pledge.amount,
				requiresWalletHandoff: false,
				targetPaymentPubkey: pledge.paymentPubkey ?? undefined
			});
			operation = await paymentJournal.transition(operation.id, 'awaiting-wallet');
		}
	}

	async function handleRetract() {
		if (!paymentWritesEnabled || !operation || !accountState.pubkey) return;
		publishing = true;
		error = '';
		try {
			if (operation.status === 'published') {
				operation = await paymentJournal.transition(operation.id, 'confirmed');
				confirming = false;
				return;
			}
			if (!operation.signedEvent) {
				const spent = await verifySourceProofsSpent(pledge.cashuToken, pledge.mintUrl);
				if (!spent.spent) throw new Error(spent.error ?? 'Source proofs are not spent');
				if (operation.status === 'awaiting-wallet') {
					operation = await paymentJournal.transition(operation.id, 'source-spent');
				}
				const creatorPubkey = bountyAddress.split(':')[1];
				if (!creatorPubkey) throw new Error('Invalid bounty address');
				const signedEvent = await signEventTemplate(
					retractionBlueprint({
						taskAddress: bountyAddress,
						type: 'pledge',
						pledgeEventId: pledge.id,
						creatorPubkey,
						reason: 'Source token reclaimed with Minibits Revert'
					})
				);
				operation = await paymentJournal.transition(operation.id, 'event-signed', { signedEvent });
			}

			operation = await publishJournaledEvent(operation);

			if (hasSolutions) {
				await publishEvent(
					reputationBlueprint({
						offenderPubkey: accountState.pubkey,
						taskAddress: bountyAddress,
						type: 'pledge_retraction',
						retractionEventId: operation.signedEvent!.id,
						description: 'Retracted pledge after solutions were submitted'
					})
				);
			}
			confirming = false;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Reclaim verification failed';
		} finally {
			publishing = false;
		}
	}
</script>

{#if confirming}
	<div class="space-y-3 border-t border-border pt-3">
		<p class="text-sm font-medium text-foreground">Reclaim in Minibits before retracting</p>
		<ol class="list-decimal space-y-1 pl-5 text-xs text-foreground/80">
			<li>Open the SAME backed-up Minibits wallet that controls this pledge key.</li>
			<li>
				Find the ORIGINAL pending Minibits send that created this pledge and use Revert on it.
			</li>
			<li>
				Never import the public source token first. Importing it can race the original send and lose
				your reclaim.
			</li>
			<li>
				Return here. Retraction remains blocked until the mint reports every source proof spent.
			</li>
		</ol>
		<p class="text-xs text-muted-foreground">
			The saved recovery journal survives reload. No private key is requested or stored.
		</p>
		{#if hasSolutions}<p class="text-xs font-medium text-destructive/70">
				Solutions exist. Retraction will publish a reputation event.
			</p>{/if}
		{#if error}<p class="text-xs text-destructive" role="alert">{error}</p>{/if}
		<div class="flex gap-2">
			<Button
				variant="outline"
				size="sm"
				disabled={publishing || !paymentWritesEnabled}
				onclick={handleRetract}
				>{publishing
					? 'Checking mint...'
					: operation?.signedEvent
						? 'Retry exact retraction'
						: 'Verify Revert and retract'}</Button
			>
		</div>
	</div>
{:else}
	<button
		type="button"
		onclick={beginReclaim}
		disabled={!paymentWritesEnabled}
		class="text-xs text-destructive/70 transition-colors hover:text-destructive hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
		aria-label="Reclaim and retract pledge"
	>
		<XCircle class="inline size-3" /> Reclaim / retract
	</button>
{/if}
