<script lang="ts">
	import { accountState } from '$lib/nostr/account.svelte';
	import { publishEvent } from '$lib/nostr/signer.svelte';
	import { solutionBlueprint } from '$lib/bounty/blueprints';
	import { SOLUTION_KIND } from '$lib/bounty/kinds';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { getMinSubmissionFee, getMaxSubmissionFee } from '$lib/utils/env';
	import { rateLimiter } from '$lib/nostr/rate-limiter';
	import { decodeToken } from '$lib/cashu/token';
	import type { TokenInfo } from '$lib/cashu/types';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import LoginButton from '$lib/components/auth/LoginButton.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';
	import type { BountyStatus } from '$lib/bounty/types';
	import SendIcon from '@lucide/svelte/icons/send';
	import LinkIcon from '@lucide/svelte/icons/link';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import CoinsIcon from '@lucide/svelte/icons/coins';
	import { connectivity } from '$lib/stores/connectivity.svelte';

	// ── Constants ────────────────────────────────────────────────
	const DESCRIPTION_MAX = 100_000;

	const {
		bountyAddress,
		creatorPubkey,
		taskStatus,
		requiredFee
	}: {
		bountyAddress: string;
		creatorPubkey: string;
		taskStatus: BountyStatus;
		requiredFee: number;
	} = $props();

	let description = $state('');
	let deliverableUrl = $state('');
	let feeAmount = $state(getMinSubmissionFee());
	let submitting = $state(false);

	// ── Anti-spam token state ────────────────────────────────────
	let feeTokenInput = $state('');
	let decodedFeeToken = $state<TokenInfo | null>(null);
	let feeDecodeError = $state('');

	// ── Rate limit state ────────────────────────────────────────
	let rateLimitRemaining = $state(0);

	$effect(() => {
		if (rateLimitRemaining <= 0) return;
		const interval = setInterval(() => {
			const result = rateLimiter.canPublish(SOLUTION_KIND);
			rateLimitRemaining = result.allowed ? 0 : Math.ceil(result.remainingMs / 1000);
		}, 1000);
		return () => clearInterval(interval);
	});

	const isRateLimited = $derived(rateLimitRemaining > 0);

	const minFee = getMinSubmissionFee();
	const maxFee = getMaxSubmissionFee();
	const hasFixedFee = $derived(requiredFee > 0);

	// Sync feeAmount when the requiredFee prop changes
	$effect(() => {
		feeAmount = requiredFee || minFee;
	});

	// ── Fee token decoding ───────────────────────────────────────
	$effect(() => {
		const trimmed = feeTokenInput.trim();
		if (!trimmed) {
			decodedFeeToken = null;
			feeDecodeError = '';
			return;
		}

		if (!trimmed.startsWith('cashuA') && !trimmed.startsWith('cashuB')) {
			decodedFeeToken = null;
			feeDecodeError = 'Token must start with cashuA or cashuB';
			return;
		}

		// decodeToken is async (lazy-loaded Cashu module). Fire and update state
		// on resolution. The `currentInput` guard prevents stale responses from
		// overwriting results when the user types faster than the decode resolves.
		const currentInput = trimmed;
		const currentFee = feeAmount;
		decodedFeeToken = null;
		feeDecodeError = '';

		decodeToken(trimmed).then((info) => {
			// Guard: input changed while we were decoding — discard this result
			if (feeTokenInput.trim() !== currentInput) return;

			if (!info) {
				decodedFeeToken = null;
				feeDecodeError = 'Invalid Cashu token — could not decode';
				return;
			}

			if (info.amount < currentFee) {
				decodedFeeToken = null;
				feeDecodeError = `Token amount (${info.amount} sats) is less than the required fee (${currentFee} sats)`;
				return;
			}

			decodedFeeToken = info;
			feeDecodeError = '';
		});
	});

	const isFeeTokenValid = $derived(feeAmount <= 0 || decodedFeeToken !== null);

	const canSubmit = $derived(
		(taskStatus === 'open' || taskStatus === 'in_review') && accountState.isLoggedIn
	);

	const isVisible = $derived(taskStatus === 'open' || taskStatus === 'in_review');

	const isUrlValid = $derived.by(() => {
		if (!deliverableUrl.trim()) return true; // optional field
		try {
			const url = new URL(deliverableUrl.trim());
			return url.protocol === 'https:' || url.protocol === 'http:';
		} catch {
			return false;
		}
	});

	const descriptionLengthValid = $derived(description.length <= DESCRIPTION_MAX);

	const isFeeValid = $derived(
		Number.isInteger(feeAmount) &&
			Number.isFinite(feeAmount) &&
			feeAmount >= minFee &&
			feeAmount <= maxFee
	);

	const isValid = $derived(
		description.trim().length > 0 &&
			descriptionLengthValid &&
			isFeeValid &&
			isFeeTokenValid &&
			isUrlValid &&
			!submitting &&
			!isRateLimited &&
			connectivity.online
	);

	async function handleSubmit() {
		if (!isValid || !canSubmit || !accountState.pubkey) return;

		// Rate limit check
		const rateCheck = rateLimiter.canPublish(SOLUTION_KIND);
		if (!rateCheck.allowed) {
			rateLimitRemaining = Math.ceil(rateCheck.remainingMs / 1000);
			toastStore.error(`Wait ${rateLimitRemaining}s before submitting another solution`);
			return;
		}

		submitting = true;

		try {
			// Use the real Cashu token pasted by the user as the anti-spam fee.
			// The token is NOT P2PK-locked — it is immediately claimable by the bounty creator.
			const antiSpamToken = feeAmount > 0 ? feeTokenInput.trim() : undefined;

			const template = solutionBlueprint({
				bountyAddress,
				creatorPubkey,
				description: description.trim(),
				antiSpamToken,
				deliverableUrl: deliverableUrl.trim() || undefined
			});

			const { broadcast } = await publishEvent(template);
			rateLimiter.recordPublish(SOLUTION_KIND);

			if (!broadcast.success) {
				toastStore.error(
					'Failed to publish to relays. Your solution was saved locally but may not be visible to others.'
				);
				return;
			}

			toastStore.success('Solution submitted successfully!');
			resetForm();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to submit solution');
		} finally {
			submitting = false;
		}
	}

	function resetForm() {
		description = '';
		deliverableUrl = '';
		feeAmount = requiredFee || minFee;
		feeTokenInput = '';
		decodedFeeToken = null;
		feeDecodeError = '';
	}

	function handleFeeInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const parsed = parseInt(target.value, 10);
		feeAmount = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
	}
</script>

{#if !isVisible}
	<!-- Hidden entirely for draft/completed/expired/cancelled -->
{:else if !accountState.isLoggedIn}
	<!-- Unauthenticated prompt -->
	<section class="rounded-lg border border-border bg-card p-6" aria-label="Submit a solution">
		<div class="flex flex-col items-center gap-3 text-center">
			<FileTextIcon class="size-8 text-muted-foreground" />
			<p class="text-sm text-muted-foreground">
				Sign in with a Nostr extension to submit a solution
			</p>
			<LoginButton />
		</div>
	</section>
{:else}
	<!-- Solution submission form -->
	<section class="rounded-lg border border-border bg-card p-6" aria-label="Submit a solution">
		<h3 class="mb-4 text-lg font-semibold text-foreground">Submit a solution</h3>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
			class="space-y-5"
			aria-label="Solution submission form"
		>
			<!-- Description (required) -->
			<div class="space-y-2">
				<label for="solution-description" class="text-sm font-medium text-foreground">
					Description
					<span class="text-destructive">*</span>
				</label>
				<textarea
					id="solution-description"
					bind:value={description}
					rows={6}
					required
					maxlength={DESCRIPTION_MAX}
					disabled={submitting}
					placeholder="Describe your solution in detail. Markdown is supported."
					aria-describedby="solution-desc-help solution-desc-count"
					aria-invalid={description.length > 0 &&
						(description.trim().length === 0 || !descriptionLengthValid)}
					class="border-border bg-white dark:bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
				></textarea>
				<div class="flex items-center justify-between">
					{#if !descriptionLengthValid}
						<p class="text-xs text-destructive" role="alert">
							Description must be {DESCRIPTION_MAX.toLocaleString()} characters or fewer.
						</p>
					{:else}
						<p id="solution-desc-help" class="text-xs text-muted-foreground">
							Markdown formatting is supported. Explain what you built and how it meets the bounty
							requirements.
						</p>
					{/if}
					<p
						id="solution-desc-count"
						class="shrink-0 text-xs {!descriptionLengthValid
							? 'text-destructive font-medium'
							: 'text-muted-foreground'}"
						aria-live="polite"
					>
						{description.length.toLocaleString()}/{DESCRIPTION_MAX.toLocaleString()}
					</p>
				</div>
			</div>

			<!-- Deliverable URL (optional) -->
			<div class="space-y-2">
				<label for="solution-url" class="text-sm font-medium text-foreground">
					<span class="inline-flex items-center gap-1.5">
						<LinkIcon class="size-3.5" />
						Deliverable URL
					</span>
					<span class="ml-1 font-normal text-muted-foreground">(optional)</span>
				</label>
				<Input
					id="solution-url"
					type="url"
					bind:value={deliverableUrl}
					disabled={submitting}
					placeholder="https://github.com/you/repo"
					aria-describedby="solution-url-help"
					aria-invalid={deliverableUrl.trim().length > 0 && !isUrlValid}
				/>
				{#if deliverableUrl.trim().length > 0 && !isUrlValid}
					<p class="text-xs text-destructive" role="alert">
						Please enter a valid URL (https:// or http://).
					</p>
				{:else}
					<p id="solution-url-help" class="text-xs text-muted-foreground">
						Link to your code repository, demo, or deliverable.
					</p>
				{/if}
			</div>

			<!-- Anti-spam fee -->
			{#if feeAmount > 0}
				<div class="space-y-2">
					<label for="solution-fee" class="text-sm font-medium text-foreground">
						<span class="inline-flex items-center gap-1.5">
							<CoinsIcon class="size-3.5" />
							Anti-spam fee ({feeAmount} sats)
						</span>
						<span class="text-destructive">*</span>
					</label>

					{#if !hasFixedFee}
						<!-- Adjustable fee within range -->
						<div class="space-y-2">
							<Input
								id="solution-fee"
								type="number"
								value={feeAmount}
								oninput={handleFeeInput}
								min={minFee}
								max={maxFee}
								step="1"
								disabled={submitting}
								aria-describedby="solution-fee-range"
								aria-invalid={feeAmount > 0 && !isFeeValid}
								class="max-w-32"
							/>
							<p id="solution-fee-range" class="text-xs text-muted-foreground">
								Anti-spam fee between {minFee} and {maxFee} sats. This fee is non-refundable.
							</p>
							{#if feeAmount > 0 && !isFeeValid}
								<p class="text-xs text-destructive" role="alert">
									Fee must be a whole number between {minFee} and {maxFee} sats.
								</p>
							{/if}
						</div>
					{/if}

					<!-- Cashu token paste input -->
					<textarea
						id="solution-fee-token"
						bind:value={feeTokenInput}
						rows={3}
						disabled={submitting}
						placeholder="Paste a cashuA... or cashuB... token"
						spellcheck={false}
						autocomplete="off"
						aria-describedby="solution-fee-help"
						aria-invalid={feeTokenInput.trim().length > 0 && !isFeeTokenValid}
						class="font-mono text-xs border-border bg-white dark:bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-md border px-3 py-2 shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
					></textarea>
					<p id="solution-fee-help" class="text-xs text-muted-foreground">
						{#if hasFixedFee}
							This bounty requires a {requiredFee} sat submission fee to deter spam. Paste a Cashu token from your wallet.
						{:else}
							Paste a Cashu token from your wallet (e.g. Minibits, eNuts, Nutstash). The token amount must be at least {feeAmount} sats.
						{/if}
					</p>
					{#if feeDecodeError}
						<p class="text-xs text-destructive" role="alert">{feeDecodeError}</p>
					{/if}

					<!-- Decoded token summary -->
					{#if decodedFeeToken}
						<div
							class="flex items-center justify-between rounded-md border border-success/30 bg-success/5 px-3 py-2"
						>
							<span class="text-sm text-foreground/80">Token amount</span>
							<SatAmount amount={decodedFeeToken.amount} />
						</div>
					{/if}
				</div>
			{/if}

			<!-- Submit button -->
			<div class="flex items-center justify-end gap-3 border-t border-border pt-4">
				{#if !connectivity.online}
					<p class="text-xs text-warning" role="alert">Offline — cannot publish</p>
				{:else if isRateLimited}
					<p class="text-xs text-muted-foreground">Please wait {rateLimitRemaining}s</p>
				{/if}
				<Button type="submit" disabled={!isValid || !canSubmit}>
					{#if submitting}
						<LoadingSpinner size="sm" />
						Submitting...
					{:else if !connectivity.online}
						Offline
					{:else if isRateLimited}
						Wait {rateLimitRemaining}s
					{:else}
						<SendIcon class="size-4" />
						Submit solution
					{/if}
				</Button>
			</div>
		</form>
	</section>
{/if}
