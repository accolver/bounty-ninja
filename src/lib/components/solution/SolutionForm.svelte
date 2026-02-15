<script lang="ts">
	import { accountState } from '$lib/nostr/account.svelte';
	import { publishEvent } from '$lib/nostr/signer.svelte';
	import { solutionBlueprint } from '$lib/bounty/blueprints';
	import { SOLUTION_KIND } from '$lib/bounty/kinds';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { rateLimiter } from '$lib/nostr/rate-limiter';
	import { decodeToken } from '$lib/cashu/token';
	import type { TokenInfo } from '$lib/cashu/types';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import LoginButton from '$lib/components/auth/LoginButton.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';
	import MarkdownEditor from '$lib/components/shared/MarkdownEditor.svelte';
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
	const feeAmount = $derived(requiredFee);
	let submitting = $state(false);

	// ── Anti-spam token state (supports multiple tokens) ────────
	let feeTokenInput = $state('');
	let feeTokens = $state<Array<{ raw: string; info: TokenInfo }>>([]);
	let feeDecodeError = $state('');
	let decoding = $state(false);

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

	// Fee is always set by the bounty creator and immutable for solvers

	// ── Fee token management ─────────────────────────────────────

	/** Total sats across all added tokens */
	const feeTokenTotal = $derived(feeTokens.reduce((sum, t) => sum + t.info.amount, 0));

	/** How many more sats are needed */
	const feeRemaining = $derived(Math.max(0, feeAmount - feeTokenTotal));

	/** Whether the fee is fully covered */
	const isFeeTokenValid = $derived(feeAmount <= 0 || feeTokenTotal >= feeAmount);

	/** Add a token from the input field */
	async function addFeeToken() {
		const trimmed = feeTokenInput.trim();
		if (!trimmed) return;

		if (!trimmed.startsWith('cashuA') && !trimmed.startsWith('cashuB')) {
			feeDecodeError = 'Token must start with cashuA or cashuB';
			return;
		}

		// Check for duplicate
		if (feeTokens.some((t) => t.raw === trimmed)) {
			feeDecodeError = 'This token has already been added';
			return;
		}

		decoding = true;
		feeDecodeError = '';

		try {
			const info = await decodeToken(trimmed);
			if (!info) {
				feeDecodeError = 'Invalid Cashu token — could not decode';
				return;
			}
			if (info.amount <= 0) {
				feeDecodeError = 'Token has no value';
				return;
			}

			feeTokens = [...feeTokens, { raw: trimmed, info }];
			feeTokenInput = '';
			feeDecodeError = '';
		} catch {
			feeDecodeError = 'Failed to decode token';
		} finally {
			decoding = false;
		}
	}

	/** Remove a token by index */
	function removeFeeToken(index: number) {
		feeTokens = feeTokens.filter((_, i) => i !== index);
	}

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
		feeAmount === 0 || (Number.isInteger(feeAmount) && feeAmount > 0)
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
			// Use the real Cashu token(s) pasted by the user as the anti-spam fee.
			// Tokens are NOT P2PK-locked — they are immediately claimable by the bounty creator.
			const antiSpamTokens = feeAmount > 0 ? feeTokens.map((t) => t.raw) : undefined;

			const template = solutionBlueprint({
				bountyAddress,
				creatorPubkey,
				description: description.trim(),
				antiSpamTokens,
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
		feeTokenInput = '';
		feeTokens = [];
		feeDecodeError = '';
	}
</script>

{#if !isVisible}
	<!-- Hidden entirely for completed/expired/cancelled -->
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
					<span class="ml-1 text-xs font-normal text-muted-foreground">Markdown</span>
				</label>
				<MarkdownEditor
					id="solution-description"
					value={description}
					placeholder="Describe your solution in detail. What did you build and how does it meet the requirements?"
					maxlength={DESCRIPTION_MAX}
					onchange={(md) => (description = md)}
				/>
				<div class="flex items-center justify-between">
					{#if !descriptionLengthValid}
						<p class="text-xs text-destructive" role="alert">
							Description must be {DESCRIPTION_MAX.toLocaleString()} characters or fewer.
						</p>
					{:else if description.length > 0 && description.trim().length === 0}
						<p class="text-xs text-destructive" role="alert">
							Description cannot be empty.
						</p>
					{:else}
						<span></span>
					{/if}
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

			<!-- Anti-spam fee (set by bounty creator, immutable) -->
			{#if feeAmount > 0}
				<div class="space-y-3">
					<label for="solution-fee-token" class="text-sm font-medium text-foreground">
						<span class="inline-flex items-center gap-1.5">
							<CoinsIcon class="size-3.5" />
							Anti-spam fee ({feeAmount} sats)
						</span>
						<span class="text-destructive">*</span>
					</label>

					<!-- Added tokens list -->
					{#if feeTokens.length > 0}
						<ul class="space-y-1.5" aria-label="Added fee tokens">
							{#each feeTokens as token, i (i)}
								<li
									class="flex items-center justify-between rounded-md border border-success/30 bg-success/5 px-3 py-2"
								>
									<span class="text-xs text-muted-foreground font-mono truncate max-w-[60%]">
										{token.raw.slice(0, 20)}...{token.raw.slice(-8)}
									</span>
									<div class="flex items-center gap-2">
										<SatAmount amount={token.info.amount} />
										<button
											type="button"
											onclick={() => removeFeeToken(i)}
											disabled={submitting}
											class="cursor-pointer rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
											aria-label="Remove token"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												viewBox="0 0 16 16"
												fill="currentColor"
												class="h-3 w-3"
												aria-hidden="true"
											>
												<path
													d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z"
												/>
											</svg>
										</button>
									</div>
								</li>
							{/each}
						</ul>

						<!-- Progress summary -->
						<div
							class="flex items-center justify-between rounded-md border px-3 py-2 text-sm {isFeeTokenValid
								? 'border-success/30 bg-success/5'
								: 'border-border bg-muted/30'}"
						>
							<span class="text-foreground/80">
								{isFeeTokenValid ? 'Fee covered' : `${feeRemaining} sats remaining`}
							</span>
							<span class="font-medium {isFeeTokenValid ? 'text-success' : 'text-foreground'}">
								{new Intl.NumberFormat().format(feeTokenTotal)} / {new Intl.NumberFormat().format(feeAmount)} sats
							</span>
						</div>
					{/if}

					<!-- Cashu token paste input + add button -->
					{#if !isFeeTokenValid}
						<div class="flex gap-2">
							<textarea
								id="solution-fee-token"
								bind:value={feeTokenInput}
								rows={2}
								disabled={submitting || decoding}
								placeholder="Paste a cashuA... or cashuB... token"
								spellcheck={false}
								autocomplete="off"
								aria-describedby="solution-fee-help"
								class="flex-1 font-mono text-xs border-border bg-input dark:bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border px-3 py-2 shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
							></textarea>
							<button
								type="button"
								onclick={addFeeToken}
								disabled={!feeTokenInput.trim() || submitting || decoding}
								class="cursor-pointer self-end rounded-md border border-border bg-muted px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
							>
								{decoding ? 'Checking...' : 'Add'}
							</button>
						</div>
						<p id="solution-fee-help" class="text-xs text-muted-foreground">
							This bounty requires a {feeAmount} sat submission fee. Paste one or more Cashu tokens
							that total at least {feeAmount} sats. This fee is non-refundable.
						</p>
					{/if}

					{#if feeDecodeError}
						<p class="text-xs text-destructive" role="alert">{feeDecodeError}</p>
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
