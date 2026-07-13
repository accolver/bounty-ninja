<script lang="ts">
	import { onMount } from 'svelte';
	import { accountState } from '$lib/nostr/account.svelte';
	import { signEventTemplate } from '$lib/nostr/signer.svelte';
	import { pledgeBlueprint } from '$lib/bounty/blueprints';
	import { PLEDGE_KIND } from '$lib/bounty/kinds';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { arePaymentWritesEnabled, getDefaultMint } from '$lib/utils/env';
	import { rateLimiter } from '$lib/nostr/rate-limiter';
	import { decodeToken } from '$lib/cashu/token';
	import { MintConnectionError, DoubleSpendError } from '$lib/cashu/types';
	import type { TokenInfo } from '$lib/cashu/types';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import CoinsIcon from '@lucide/svelte/icons/coins';
	import { connectivity } from '$lib/stores/connectivity.svelte';
	import PaymentUnavailable from '$lib/components/shared/PaymentUnavailable.svelte';
	import {
		normalizeMinibitsPaymentPubkey,
		verifyManualP2PKToken
	} from '$lib/cashu/manual-token-verifier';
	import { paymentJournal, type PaymentOperationRecord } from '$lib/cashu/payment-journal';
	import { publishJournaledEvent } from '$lib/cashu/publish-journaled-event';

	const paymentWritesEnabled = arePaymentWritesEnabled();

	let {
		bountyAddress,
		// creatorPubkey is used for the `p` notification tag in the pledge event,
		// NOT for token locking. Tokens are locked only to the Cashu payment key.
		creatorPubkey: _creatorPubkey,
		mintUrl,
		financialDataComplete,
		deadline: _deadline = null,
		open = $bindable(false)
	}: {
		bountyAddress: string;
		creatorPubkey: string;
		mintUrl: string | null;
		financialDataComplete: boolean;
		deadline: number | null;
		open: boolean;
	} = $props();

	let tokenInput = $state('');
	let amount = $state<number | undefined>(undefined);
	let paymentKeyInput = $state('');
	let message = $state('');
	let acknowledged = $state(false);
	let submitting = $state(false);
	let decodeError = $state('');
	let verificationError = $state('');
	let operation = $state<PaymentOperationRecord | null>(null);

	onMount(async () => {
		const pending = await paymentJournal.listPending();
		const existing = pending.find(
			(item) => item.intent.kind === 'pledge' && item.intent.bountyAddress === bountyAddress
		);
		if (!existing) return;

		operation = existing;
		tokenInput = existing.recovery?.token ?? '';
		amount = existing.intent.amount;
		paymentKeyInput = existing.intent.targetPaymentPubkey ?? '';
		message = existing.intent.eventContent ?? '';
		acknowledged = true;
		open = true;
	});

	// ── Rate limit state ────────────────────────────────────────
	let rateLimitRemaining = $state(0);

	$effect(() => {
		if (rateLimitRemaining <= 0) return;
		const interval = setInterval(() => {
			const result = rateLimiter.canPublish(PLEDGE_KIND);
			rateLimitRemaining = result.allowed ? 0 : Math.ceil(result.remainingMs / 1000);
		}, 1000);
		return () => clearInterval(interval);
	});

	const isRateLimited = $derived(rateLimitRemaining > 0);

	// ── Token decoding ──────────────────────────────────────────
	let decodedToken = $state<TokenInfo | null>(null);

	$effect(() => {
		const trimmed = tokenInput.trim();
		if (!trimmed) {
			decodedToken = null;
			decodeError = '';
			return;
		}

		if (!trimmed.startsWith('cashuA') && !trimmed.startsWith('cashuB')) {
			decodedToken = null;
			decodeError = 'Token must start with cashuA or cashuB';
			return;
		}

		// decodeToken is async (lazy-loaded Cashu module). Fire and update state
		// on resolution. The `currentInput` guard prevents stale responses from
		// overwriting results when the user types faster than the decode resolves.
		const currentInput = trimmed;
		decodedToken = null;
		decodeError = '';

		decodeToken(trimmed).then((info) => {
			// Guard: input changed while we were decoding — discard this result
			if (tokenInput.trim() !== currentInput) return;

			if (!info) {
				decodedToken = null;
				decodeError = 'Invalid Cashu token — could not decode';
				return;
			}

			if (info.amount <= 0) {
				decodedToken = null;
				decodeError = 'Token has zero amount';
				return;
			}

			decodedToken = info;
			decodeError = '';
		});
	});

	const effectiveMint = $derived(mintUrl || getDefaultMint());

	const mintMismatch = $derived(
		decodedToken !== null &&
			decodedToken.mint.replace(/\/+$/, '') !== effectiveMint.replace(/\/+$/, '')
	);

	const paymentKeyValid = $derived.by(() => {
		try {
			normalizeMinibitsPaymentPubkey(paymentKeyInput);
			return true;
		} catch {
			return false;
		}
	});
	const isValidToken = $derived(decodedToken !== null && !mintMismatch);

	const isValid = $derived(
		paymentWritesEnabled &&
			financialDataComplete &&
			isValidToken &&
			Number.isSafeInteger(amount) &&
			(amount ?? 0) > 0 &&
			paymentKeyValid &&
			acknowledged &&
			!submitting &&
			!isRateLimited &&
			connectivity.online
	);
	const canSubmit = $derived(
		operation ? paymentWritesEnabled && !submitting && connectivity.online : isValid
	);

	const formattedAmount = $derived(
		decodedToken ? new Intl.NumberFormat().format(decodedToken.amount) : '0'
	);

	async function handleSubmit() {
		if (!paymentWritesEnabled || !financialDataComplete) return;
		if (!accountState.pubkey || !canSubmit) return;

		if (operation) {
			submitting = true;
			try {
				await resumePledge(operation);
			} catch (err) {
				toastStore.error(err instanceof Error ? err.message : 'Failed to resume pledge');
			} finally {
				submitting = false;
			}
			return;
		}
		if (!isValid || !decodedToken || !amount) return;

		// Rate limit check
		const rateCheck = rateLimiter.canPublish(PLEDGE_KIND);
		if (!rateCheck.allowed) {
			rateLimitRemaining = Math.ceil(rateCheck.remainingMs / 1000);
			toastStore.error(`Wait ${rateLimitRemaining}s before submitting another pledge`);
			return;
		}

		submitting = true;

		try {
			verificationError = '';
			const verified = await verifyManualP2PKToken(tokenInput, {
				mintUrl: effectiveMint,
				amount,
				paymentPubkey: paymentKeyInput
			});
			if (!verified.valid || !verified.tokenInfo || !verified.paymentPubkey) {
				verificationError = verified.error ?? 'Token verification failed';
				toastStore.error(verificationError);
				return;
			}

			operation = await paymentJournal.create(
				{
					kind: 'pledge',
					sourceEventIds: [],
					mintUrl: verified.tokenInfo.mint,
					amount,
					requiresWalletHandoff: false,
					targetPaymentPubkey: verified.paymentPubkey,
					bountyAddress,
					eventContent: message.trim() || undefined
				},
				undefined,
				{ recovery: { token: tokenInput.trim() } }
			);
			operation = await paymentJournal.transition(operation.id, 'token-verified');
			await resumePledge(operation);
		} catch (err) {
			if (err instanceof DoubleSpendError) {
				toastStore.error('Token has already been spent — use a fresh token');
			} else if (err instanceof MintConnectionError) {
				toastStore.error('Could not connect to the Cashu mint. Please try again.');
			} else {
				toastStore.error(err instanceof Error ? err.message : 'Failed to submit pledge');
			}
		} finally {
			submitting = false;
		}
	}

	async function resumePledge(record: PaymentOperationRecord) {
		if (record.status === 'published') {
			operation = await paymentJournal.transition(record.id, 'confirmed');
			finishPledge(record.intent.amount);
			return;
		}

		if (!record.signedEvent) {
			const token = record.recovery?.token;
			const paymentPubkey = record.intent.targetPaymentPubkey;
			const savedBountyAddress = record.intent.bountyAddress;
			const savedCreatorPubkey = savedBountyAddress?.split(':')[1];
			if (!token || !paymentPubkey || !savedBountyAddress || !savedCreatorPubkey) {
				throw new Error('Saved pledge recovery data is incomplete');
			}
			if (record.status === 'prepared') {
				record = await paymentJournal.transition(record.id, 'token-verified');
			}

			const signedEvent = await signEventTemplate(
				pledgeBlueprint({
					bountyAddress: savedBountyAddress,
					creatorPubkey: savedCreatorPubkey,
					paymentPubkey,
					amount: record.intent.amount,
					cashuToken: token,
					mintUrl: record.intent.mintUrl,
					message: record.intent.eventContent || undefined
				})
			);
			record = await paymentJournal.transition(record.id, 'event-signed', { signedEvent });
			operation = record;
		}

		operation = await publishJournaledEvent(record);
		rateLimiter.recordPublish(PLEDGE_KIND);
		finishPledge(record.intent.amount);
	}

	function finishPledge(pledgeAmount: number) {
		toastStore.success(`Pledge of ${new Intl.NumberFormat().format(pledgeAmount)} sats submitted!`);
		operation = null;
		resetForm();
		open = false;
	}

	function resetForm() {
		tokenInput = '';
		amount = undefined;
		paymentKeyInput = '';
		message = '';
		acknowledged = false;
		decodedToken = null;
		decodeError = '';
		verificationError = '';
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Fund this bounty</Dialog.Title>
			<Dialog.Description>
				Paste a Cashu token from your wallet to pledge sats to this bounty.
			</Dialog.Description>
		</Dialog.Header>
		{#if !paymentWritesEnabled}
			<PaymentUnavailable action="Pledging" />
		{/if}

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
			class="space-y-5"
			aria-label="Pledge form"
		>
			<!-- Token paste input -->
			<div class="space-y-2">
				<label for="pledge-payment-key" class="text-sm font-medium text-foreground"
					>Minibits wallet public key</label
				>
				<input
					id="pledge-payment-key"
					bind:value={paymentKeyInput}
					disabled={submitting || !paymentWritesEnabled || operation !== null}
					placeholder="npub1... or public-key hex"
					autocomplete="off"
					spellcheck={false}
					aria-invalid={paymentKeyInput.length > 0 && !paymentKeyValid}
					aria-describedby="pledge-payment-key-help pledge-payment-key-error"
					class="border-border bg-input dark:bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-md border px-3 py-2 font-mono text-xs outline-none transition-[color,box-shadow] focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
				/>
				<p id="pledge-payment-key-help" class="text-xs text-muted-foreground">
					In Minibits, use this same wallet key for both creating and later reverting or releasing
					the token. Back up the wallet that controls it. Never enter a private key here.
				</p>
				<p id="pledge-payment-key-error" class="text-xs text-destructive" aria-live="polite">
					{paymentKeyInput.length > 0 && !paymentKeyValid
						? 'Enter a valid Minibits wallet public key.'
						: ''}
				</p>
			</div>
			<div class="space-y-2">
				<label for="pledge-amount" class="text-sm font-medium text-foreground"
					>Exact pledge amount (sats)</label
				>
				<input
					id="pledge-amount"
					type="number"
					min="1"
					step="1"
					bind:value={amount}
					disabled={submitting || !paymentWritesEnabled || operation !== null}
					class="border-border bg-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-md border px-3 py-2 outline-none transition-[color,box-shadow] focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
				/>
			</div>
			<div class="border-t border-border pt-3 text-xs text-foreground/80">
				<p class="font-medium">Create the token in Minibits first</p>
				<ol class="mt-1 list-decimal space-y-1 pl-5">
					<li>
						Create an exact-amount P2PK token from mint <span class="font-mono"
							>{effectiveMint}</span
						>.
					</li>
					<li>Lock it to the SAME public key entered above.</li>
					<li>
						Use no locktime. Keep the permanent SIG_INPUTS policy, then paste that already-locked
						token below.
					</li>
				</ol>
			</div>
			<div class="space-y-2">
				<label for="pledge-token" class="text-sm font-medium text-foreground"> Cashu Token </label>
				<textarea
					id="pledge-token"
					bind:value={tokenInput}
					rows={3}
					disabled={submitting || !paymentWritesEnabled || operation !== null}
					placeholder="Paste a cashuA... or cashuB... token"
					spellcheck={false}
					autocomplete="off"
					aria-describedby="pledge-token-help pledge-token-error"
					aria-invalid={tokenInput.trim().length > 0 && !isValidToken}
					class="font-mono text-xs border-border bg-input dark:bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-md border px-3 py-2 shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
				></textarea>
				<p id="pledge-token-help" class="text-xs text-muted-foreground">
					Paste the P2PK token created in Minibits. Mint: <span class="font-mono text-foreground/80"
						>{effectiveMint}</span
					>
				</p>
				<p id="pledge-token-error" class="text-xs text-destructive" role="alert">
					{decodeError ||
						(mintMismatch && decodedToken
							? `Token mint ${decodedToken.mint} does not match bounty mint ${effectiveMint}. Please use a token from the correct mint.`
							: verificationError)}
				</p>
			</div>

			<!-- Decoded token summary -->
			{#if decodedToken && !mintMismatch}
				<div
					class="flex items-center justify-between rounded-md border border-success bg-success/5 px-3 py-2"
				>
					<span class="text-sm text-foreground">Token amount</span>
					<SatAmount amount={decodedToken.amount} />
				</div>
			{/if}

			<!-- Optional message -->
			<div class="space-y-2">
				<label for="pledge-message" class="text-sm font-medium text-foreground">
					Message <span class="font-normal text-muted-foreground">(optional)</span>
				</label>
				<textarea
					id="pledge-message"
					bind:value={message}
					rows={2}
					maxlength={280}
					disabled={submitting || !paymentWritesEnabled || operation !== null}
					placeholder="Leave a note for the bounty creator..."
					class="border-border bg-input dark:bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
				></textarea>
				<p class="text-right text-xs text-muted-foreground">
					{message.length}/280
				</p>
			</div>

			<!-- Bearer instrument warning -->
			<div class="rounded-lg border border-warning bg-warning/5 p-3" role="alert">
				<div class="flex items-start gap-2">
					<TriangleAlertIcon class="mt-0.5 size-4 shrink-0 text-warning" />
					<div class="space-y-2">
						<p class="text-sm font-medium text-warning">Bearer instrument warning</p>
						<p class="text-xs text-foreground">
							This public token will be posted to Nostr. Only the backed-up Minibits wallet
							controlling the entered key can release or revert it.
						</p>
						<label class="flex items-start gap-2 cursor-pointer">
							<input
								type="checkbox"
								bind:checked={acknowledged}
								disabled={submitting || !paymentWritesEnabled}
								class="pledge-checkbox mt-0.5 size-4 shrink-0"
								aria-describedby="acknowledge-desc"
							/>
							<span id="acknowledge-desc" class="text-xs text-foreground">
								I understand Cashu tokens are bearer instruments and can be lost.
							</span>
						</label>
					</div>
				</div>
			</div>

			<!-- Actions -->
			<Dialog.Footer>
				<Button
					type="button"
					variant="outline"
					onclick={() => (open = false)}
					disabled={submitting}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={!canSubmit || !paymentWritesEnabled}>
					{#if submitting}
						<LoadingSpinner size="sm" />
						{operation?.signedEvent ? 'Retrying exact pledge event...' : 'Preparing pledge...'}
					{:else if !paymentWritesEnabled}
						Payments disabled
					{:else if isRateLimited}
						Wait {rateLimitRemaining}s
					{:else if !connectivity.online}
						Offline — cannot publish
					{:else if operation?.signedEvent}
						Retry exact signed pledge event
					{:else if operation}
						Resume saved pledge
					{:else}
						<CoinsIcon class="size-4" />
						Pledge {formattedAmount} sats
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<style>
	.pledge-checkbox {
		appearance: none;
		border-radius: 0.25rem;
		border: 1.5px solid var(--color-border);
		background: var(--color-input);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.pledge-checkbox:checked {
		background: var(--color-primary);
		border-color: var(--color-primary);
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3E%3C/svg%3E");
	}
	.pledge-checkbox:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
