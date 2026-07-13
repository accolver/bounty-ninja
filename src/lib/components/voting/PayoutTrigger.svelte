<script lang="ts">
	import type { Solution, Pledge, Payout } from '$lib/bounty/types';
	import { payoutBlueprint } from '$lib/bounty/blueprints';
	import { accountState } from '$lib/nostr/account.svelte';
	import { signEventTemplate } from '$lib/nostr/signer.svelte';
	import { paymentJournal, type PaymentOperationRecord } from '$lib/cashu/payment-journal';
	import { publishJournaledEvent } from '$lib/cashu/publish-journaled-event';
	import { verifyManualP2PKToken, verifySourceProofsSpent } from '$lib/cashu/manual-token-verifier';
	import { arePaymentWritesEnabled } from '$lib/utils/env';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import PaymentUnavailable from '$lib/components/shared/PaymentUnavailable.svelte';

	let {
		bountyAddress,
		winningSolution,
		pledges,
		payouts = [],
		financialDataComplete
	}: {
		bountyAddress: string;
		winningSolution: Solution | undefined;
		pledges: Pledge[];
		payouts: Payout[];
		financialDataComplete: boolean;
	} = $props();

	const paymentWritesEnabled = arePaymentWritesEnabled();
	let operation = $state<PaymentOperationRecord | null>(null);
	let selectedPledge = $state<Pledge | null>(null);
	let payoutToken = $state('');
	let busy = $state(false);
	let error = $state('');
	let sourceCopied = $state(false);

	const myPledges = $derived.by(() =>
		accountState.pubkey ? pledges.filter((pledge) => pledge.pubkey === accountState.pubkey) : []
	);
	const releasedPledgeIds = $derived(
		new Set(payouts.map((payout) => payout.sourcePledgeId).filter(Boolean))
	);
	const unreleased = $derived(myPledges.filter((pledge) => !releasedPledgeIds.has(pledge.id)));
	const uniquePledgers = $derived(new Set(pledges.map((pledge) => pledge.pubkey)).size);
	const releasedPledgers = $derived(new Set(payouts.map((payout) => payout.pubkey)).size);
	const totalPledged = $derived(pledges.reduce((sum, pledge) => sum + pledge.amount, 0));
	const totalReleased = $derived(payouts.reduce((sum, payout) => sum + payout.amount, 0));
	const releasePercent = $derived(
		totalPledged > 0 ? Math.min(100, Math.round((totalReleased / totalPledged) * 100)) : 0
	);

	$effect(() => {
		const pubkey = accountState.pubkey;
		const currentPledges = myPledges;
		if (!pubkey || currentPledges.length === 0 || operation) return;
		void paymentJournal.listPending().then((pending) => {
			if (accountState.pubkey !== pubkey || operation) return;
			const existing = pending.find(
				(item) =>
					item.intent.kind === 'release' &&
					currentPledges.some((pledge) => item.intent.sourceEventIds.includes(pledge.id))
			);
			if (!existing) return;
			operation = existing;
			selectedPledge =
				currentPledges.find((pledge) => existing.intent.sourceEventIds.includes(pledge.id)) ?? null;
			payoutToken = existing.recovery?.token ?? '';
		});
	});

	async function begin(pledge: Pledge) {
		if (!winningSolution?.paymentPubkey || !paymentWritesEnabled || !financialDataComplete) return;
		selectedPledge = pledge;
		error = '';
		operation = await paymentJournal.create({
			kind: 'release',
			sourceEventIds: [pledge.id],
			mintUrl: pledge.mintUrl,
			amount: pledge.amount,
			requiresWalletHandoff: false,
			targetPaymentPubkey: winningSolution.paymentPubkey
		});
		operation = await paymentJournal.transition(operation.id, 'awaiting-wallet');
	}

	async function copySourceToken() {
		if (!selectedPledge) return;
		await navigator.clipboard.writeText(selectedPledge.cashuToken);
		sourceCopied = true;
		setTimeout(() => (sourceCopied = false), 2000);
	}

	async function publishRecorded(record: PaymentOperationRecord) {
		if (!record.signedEvent) throw new Error('The exact signed payout event is unavailable');
		operation = await publishJournaledEvent(record);
		toastStore.success('Source-bound payout published');
	}

	async function submitRelease() {
		if (
			!paymentWritesEnabled ||
			!financialDataComplete ||
			!operation ||
			!selectedPledge ||
			!winningSolution?.paymentPubkey
		)
			return;
		busy = true;
		error = '';
		try {
			if (operation.status === 'published') {
				operation = await paymentJournal.transition(operation.id, 'confirmed');
				return;
			}
			if (operation.signedEvent) {
				await publishRecorded(operation);
				return;
			}

			const token = operation.recovery?.token ?? payoutToken.trim();
			const verified = await verifyManualP2PKToken(token, {
				mintUrl: selectedPledge.mintUrl,
				amount: selectedPledge.amount,
				paymentPubkey: winningSolution.paymentPubkey
			});
			if (!verified.valid) throw new Error(verified.error ?? 'Replacement token is invalid');
			if (operation.status === 'awaiting-wallet') {
				operation = await paymentJournal.transition(operation.id, 'token-verified', {
					recovery: { token }
				});
			}
			const source = await verifySourceProofsSpent(
				selectedPledge.cashuToken,
				selectedPledge.mintUrl
			);
			if (!source.spent) throw new Error(source.error ?? 'Source proofs are not spent');
			if (operation.status === 'token-verified') {
				operation = await paymentJournal.transition(operation.id, 'source-spent');
			}

			const signedEvent = await signEventTemplate(
				payoutBlueprint({
					bountyAddress,
					solutionId: winningSolution.id,
					sourcePledgeId: selectedPledge.id,
					solverPubkey: winningSolution.pubkey,
					paymentPubkey: winningSolution.paymentPubkey,
					amount: selectedPledge.amount,
					cashuToken: token,
					mintUrl: selectedPledge.mintUrl
				})
			);
			operation = await paymentJournal.transition(operation.id, 'event-signed', { signedEvent });
			await publishRecorded(operation);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Release failed';
			toastStore.error(error);
		} finally {
			busy = false;
		}
	}
</script>

{#if payouts.length > 0}
	<div class="space-y-2 text-sm text-muted-foreground">
		<p>
			{releasedPledgers} of {uniquePledgers} pledgers released ({releasePercent}% of declared funds)
		</p>
		<div class="h-1.5 w-full rounded-full bg-muted">
			<div
				class="h-full rounded-full bg-success/70 transition-all"
				style="width: {releasePercent}%"
			></div>
		</div>
	</div>
{/if}

{#if accountState.isAuthenticated && myPledges.length > 0 && winningSolution}
	{#if !paymentWritesEnabled}<PaymentUnavailable action="Fund release" />{/if}
	{#if !winningSolution.paymentPubkey}
		<p class="text-sm text-destructive">
			Release blocked: the winning solution has no Minibits payout key.
		</p>
	{:else if unreleased.length === 0}
		<p class="text-sm font-medium text-success" role="status">You released every source pledge.</p>
	{:else if operation && selectedPledge}
		<section class="border-t border-border pt-4 space-y-3" aria-labelledby="manual-release-title">
			<h3 id="manual-release-title" class="font-medium text-foreground">
				Release pledge of {selectedPledge.amount.toLocaleString()} sats
			</h3>
			<ol class="list-decimal space-y-1 pl-5 text-sm text-foreground/80">
				<li>
					In the SAME backed-up Minibits wallet, import/redeem the exact source token from this
					pledge.
				</li>
				<li>
					Create an exact {selectedPledge.amount.toLocaleString()} sat P2PK token to
					<span class="break-all font-mono text-xs">{winningSolution.paymentPubkey}</span>.
				</li>
				<li>
					Use no locktime and keep SIG_INPUTS. Paste the new token below. Do not create another
					token when retrying a saved operation.
				</li>
			</ol>
			<Button variant="outline" onclick={copySourceToken}
				>{sourceCopied ? 'Source token copied' : 'Copy exact source token'}</Button
			>
			<textarea
				bind:value={payoutToken}
				rows={3}
				disabled={busy || operation.signedEvent !== undefined}
				placeholder="cashuA... or cashuB..."
				aria-label="Solver-locked Minibits payout token"
				class="font-mono text-xs border-border bg-input dark:bg-input/30 flex w-full rounded-md border px-3 py-2 outline-none transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
			></textarea>
			{#if error}<p class="text-xs text-destructive" role="alert">{error}</p>{/if}
			<Button
				onclick={submitRelease}
				disabled={busy || (!payoutToken.trim() && !operation.signedEvent)}
				>{busy
					? 'Verifying...'
					: operation.signedEvent
						? 'Retry exact signed event'
						: 'Verify and publish payout'}</Button
			>
		</section>
	{:else}
		<div class="space-y-2 border-t border-border pt-4">
			<p class="text-sm text-foreground">
				Release each pledge separately. The operation is saved before Minibits handoff.
			</p>
			{#each unreleased as pledge (pledge.id)}
				<Button
					variant="outline"
					onclick={() => begin(pledge)}
					disabled={!paymentWritesEnabled || !financialDataComplete}
					>Release {pledge.amount.toLocaleString()} sats</Button
				>
			{/each}
		</div>
	{/if}
{/if}
