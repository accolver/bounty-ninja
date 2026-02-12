<script lang="ts">
	import { accountState } from '$lib/nostr/account.svelte';
	import { publishEvent } from '$lib/nostr/signer.svelte';
	import { pledgeBlueprint } from '$lib/bounty/blueprints';
	import { PLEDGE_KIND } from '$lib/bounty/kinds';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { getDefaultMint } from '$lib/utils/env';
	import { rateLimiter } from '$lib/nostr/rate-limiter';
	import { decodeToken, encodeToken, getProofsAmount } from '$lib/cashu/token';
	import { createPledgeToken } from '$lib/cashu/escrow';
	import { MintConnectionError, DoubleSpendError } from '$lib/cashu/types';
	import type { TokenInfo } from '$lib/cashu/types';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import CoinsIcon from '@lucide/svelte/icons/coins';
	import { connectivity } from '$lib/stores/connectivity.svelte';

	let {
		bountyAddress,
		creatorPubkey,
		mintUrl,
		deadline = null,
		open = $bindable(false)
	}: {
		bountyAddress: string;
		creatorPubkey: string;
		mintUrl: string | null;
		deadline: number | null;
		open: boolean;
	} = $props();

	let tokenInput = $state('');
	let message = $state('');
	let acknowledged = $state(false);
	let submitting = $state(false);
	let decodeError = $state('');

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

		const info = decodeToken(trimmed);
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

	const effectiveMint = $derived(mintUrl || getDefaultMint());

	const mintMismatch = $derived(
		decodedToken !== null &&
			decodedToken.mint.replace(/\/+$/, '') !== effectiveMint.replace(/\/+$/, '')
	);

	const isValidToken = $derived(decodedToken !== null && !mintMismatch);

	const isValid = $derived(
		isValidToken && acknowledged && !submitting && !isRateLimited && connectivity.online
	);

	const formattedAmount = $derived(
		decodedToken ? new Intl.NumberFormat().format(decodedToken.amount) : '0'
	);

	async function handleSubmit() {
		if (!isValid || !accountState.pubkey || !decodedToken) return;

		// Rate limit check
		const rateCheck = rateLimiter.canPublish(PLEDGE_KIND);
		if (!rateCheck.allowed) {
			rateLimitRemaining = Math.ceil(rateCheck.remainingMs / 1000);
			toastStore.error(`Wait ${rateLimitRemaining}s before submitting another pledge`);
			return;
		}

		submitting = true;

		try {
			// Create P2PK-locked token for the bounty creator
			const result = await createPledgeToken(
				decodedToken.proofs,
				creatorPubkey,
				decodedToken.mint,
				deadline ?? undefined,
				accountState.pubkey
			);

			if (!result.success) {
				toastStore.error(result.error ?? 'Failed to lock token');
				return;
			}

			// Encode the locked proofs into a token string for the event
			const lockedTokenStr = encodeToken(result.proofs, decodedToken.mint, 'Bounty.ninja pledge');
			const actualAmount = getProofsAmount(result.proofs);

			const template = pledgeBlueprint({
				bountyAddress,
				creatorPubkey,
				amount: actualAmount,
				cashuToken: lockedTokenStr,
				mintUrl: decodedToken.mint,
				message: message.trim() || undefined
			});

			await publishEvent(template);
			rateLimiter.recordPublish(PLEDGE_KIND);
			toastStore.success(
				`Pledge of ${new Intl.NumberFormat().format(actualAmount)} sats submitted!`
			);
			resetForm();
			open = false;
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

	function resetForm() {
		tokenInput = '';
		message = '';
		acknowledged = false;
		decodedToken = null;
		decodeError = '';
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
				<label for="pledge-token" class="text-sm font-medium text-foreground"> Cashu Token </label>
				<textarea
					id="pledge-token"
					bind:value={tokenInput}
					rows={3}
					disabled={submitting}
					placeholder="Paste a cashuA... or cashuB... token"
					spellcheck={false}
					autocomplete="off"
					aria-describedby="pledge-token-help"
					aria-invalid={tokenInput.trim().length > 0 && !isValidToken}
					class="font-mono text-xs border-border bg-white dark:bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-md border px-3 py-2 shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
				></textarea>
				<p id="pledge-token-help" class="text-xs text-muted-foreground">
					Get a token from your Cashu wallet (e.g. Minibits, eNuts, Nutstash). Mint: <span
						class="font-mono text-foreground/80">{effectiveMint}</span
					>
				</p>
				{#if decodeError}
					<p class="text-xs text-destructive" role="alert">{decodeError}</p>
				{/if}
				{#if mintMismatch && decodedToken}
					<p class="text-xs text-destructive" role="alert">
						Token mint ({decodedToken.mint}) does not match bounty mint ({effectiveMint}). Please use
						a token from the correct mint.
					</p>
				{/if}
			</div>

			<!-- Decoded token summary -->
			{#if decodedToken && !mintMismatch}
				<div
					class="flex items-center justify-between rounded-md border border-success/30 bg-success/5 px-3 py-2"
				>
					<span class="text-sm text-foreground/80">Token amount</span>
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
					disabled={submitting}
					placeholder="Leave a note for the bounty creator..."
					class="border-border bg-white dark:bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
				></textarea>
				<p class="text-right text-xs text-muted-foreground">
					{message.length}/280
				</p>
			</div>

			<!-- Bearer instrument warning -->
			<div class="rounded-lg border border-warning/30 bg-warning/5 p-3" role="alert">
				<div class="flex items-start gap-2">
					<TriangleAlertIcon class="mt-0.5 size-4 shrink-0 text-warning" />
					<div class="space-y-2">
						<p class="text-sm font-medium text-warning">Bearer instrument warning</p>
						<p class="text-xs text-foreground/80">
							Cashu tokens are like cash. Once pledged, the tokens are locked to the bounty creator.
							{#if deadline}
								If the bounty expires without a payout, you can reclaim your tokens after the
								deadline.
							{:else}
								Ensure you trust this bounty creator before pledging.
							{/if}
						</p>
						<label class="flex items-start gap-2 cursor-pointer">
							<input
								type="checkbox"
								bind:checked={acknowledged}
								disabled={submitting}
								class="mt-0.5 size-4 shrink-0 rounded border-border accent-primary"
								aria-describedby="acknowledge-desc"
							/>
							<span id="acknowledge-desc" class="text-xs text-foreground/80">
								I understand that this pledge locks my tokens and I accept the risk.
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
				<Button type="submit" disabled={!isValid}>
					{#if submitting}
						<LoadingSpinner size="sm" />
						Locking tokens...
					{:else if isRateLimited}
						Wait {rateLimitRemaining}s
					{:else if !connectivity.online}
						Offline — cannot publish
					{:else}
						<CoinsIcon class="size-4" />
						Pledge {formattedAmount} sats
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
