<script lang="ts">
	import { accountState } from '$lib/nostr/account.svelte';
	import { publishEvent } from '$lib/nostr/signer.svelte';
	import { solutionBlueprint } from '$lib/bounty/blueprints';
	import { SOLUTION_KIND } from '$lib/bounty/kinds';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { rateLimiter } from '$lib/nostr/rate-limiter';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import MarkdownEditor from '$lib/components/shared/MarkdownEditor.svelte';
	import type { BountyStatus } from '$lib/bounty/types';
	import SendIcon from '@lucide/svelte/icons/send';
	import LinkIcon from '@lucide/svelte/icons/link';
	import XIcon from '@lucide/svelte/icons/x';
	import { connectivity } from '$lib/stores/connectivity.svelte';
	import { normalizeMinibitsPaymentPubkey } from '$lib/cashu/manual-token-verifier';

	// ── Constants ────────────────────────────────────────────────
	const DESCRIPTION_MAX = 100_000;

	let {
		bountyAddress,
		creatorPubkey,
		bountyStatus,
		open = $bindable(false)
	}: {
		bountyAddress: string;
		creatorPubkey: string;
		bountyStatus: BountyStatus;
		open: boolean;
	} = $props();

	let description = $state('');
	let deliverableUrl = $state('');
	let paymentKeyInput = $state('');
	let submitting = $state(false);

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

	// ── Dirty state detection ───────────────────────────────────
	const isDirty = $derived(
		description.trim().length > 0 ||
			deliverableUrl.trim().length > 0 ||
			paymentKeyInput.trim().length > 0
	);

	const canSubmit = $derived(
		(bountyStatus === 'open' || bountyStatus === 'in_review') && accountState.isAuthenticated
	);

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

	const paymentPubkey = $derived.by(() => {
		try {
			return normalizeMinibitsPaymentPubkey(paymentKeyInput);
		} catch {
			return null;
		}
	});

	const isValid = $derived(
		description.trim().length > 0 &&
			descriptionLengthValid &&
			isUrlValid &&
			paymentPubkey !== null &&
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
			if (!paymentPubkey) throw new Error('A valid Minibits payout key is required');
			const template = solutionBlueprint({
				bountyAddress,
				creatorPubkey,
				paymentPubkey,
				description: description.trim(),
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
			open = false;
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to submit solution');
		} finally {
			submitting = false;
		}
	}

	function resetForm() {
		description = '';
		deliverableUrl = '';
		paymentKeyInput = '';
	}

	/** Attempt to close the dialog — confirm if form has unsaved data */
	function requestClose() {
		if (submitting) return;
		if (isDirty) {
			const confirmed = confirm('You have unsaved changes. Are you sure you want to close?');
			if (!confirmed) return;
		}
		resetForm();
		open = false;
	}
</script>

<Dialog.Root
	bind:open
	onOpenChange={(isOpen) => {
		if (isOpen) return;
		// Closing is handled exclusively by requestClose — block all other close attempts
		requestClose();
	}}
>
	<Dialog.Content
		showCloseButton={false}
		interactOutsideBehavior="ignore"
		escapeKeydownBehavior="ignore"
		class="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
	>
		<!-- Custom close button with confirm-before-discard -->
		<button
			type="button"
			onclick={requestClose}
			disabled={submitting}
			class="ring-offset-background focus:ring-ring absolute end-4 top-4 rounded-md p-1.5 opacity-70 transition-all hover:opacity-100 hover:bg-muted hover:cursor-pointer focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
			aria-label="Close"
		>
			<XIcon />
		</button>

		<Dialog.Header>
			<Dialog.Title>Submit a solution</Dialog.Title>
			<Dialog.Description>
				Describe your solution in detail and provide a link to your deliverable.
			</Dialog.Description>
		</Dialog.Header>

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
					ariaInvalid={description.length > 0 &&
						(!descriptionLengthValid || description.trim().length === 0)}
					ariaDescribedby="solution-description-error"
				/>
				<div class="flex items-center justify-between">
					{#if !descriptionLengthValid}
						<p id="solution-description-error" class="text-xs text-destructive" role="alert">
							Description must be {DESCRIPTION_MAX.toLocaleString()} characters or fewer.
						</p>
					{:else if description.length > 0 && description.trim().length === 0}
						<p id="solution-description-error" class="text-xs text-destructive" role="alert">
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
					aria-describedby="solution-url-help solution-url-error"
					aria-invalid={deliverableUrl.trim().length > 0 && !isUrlValid}
				/>
				{#if deliverableUrl.trim().length > 0 && !isUrlValid}
					<p id="solution-url-error" class="text-xs text-destructive" role="alert">
						Please enter a valid URL (https:// or http://).
					</p>
				{:else}
					<p id="solution-url-help" class="text-xs text-muted-foreground">
						Link to your code repository, demo, or deliverable.
					</p>
				{/if}
			</div>

			<!-- Anti-spam fee (set by bounty creator, immutable) -->
			<div class="space-y-2 border-t border-border pt-4">
				<label for="solution-payment-key" class="text-sm font-medium text-foreground"
					>Minibits payout public key <span class="text-destructive">*</span></label
				>
				<Input
					id="solution-payment-key"
					bind:value={paymentKeyInput}
					disabled={submitting}
					placeholder="npub1... or public-key hex"
					autocomplete="off"
					spellcheck={false}
					aria-invalid={paymentKeyInput.length > 0 && paymentPubkey === null}
					aria-describedby="solution-payment-key-help solution-payment-key-error"
				/>
				{#if paymentKeyInput.length > 0 && paymentPubkey === null}
					<p id="solution-payment-key-error" class="text-xs text-destructive" role="alert">
						Enter a valid npub, x-only key, or compressed public key.
					</p>
				{:else}
					<p id="solution-payment-key-help" class="text-xs text-muted-foreground">
						Payout tokens will be public on Nostr but locked to this Minibits key. Using a dedicated
						wallet improves privacy. Back it up before submitting; a lost wallet cannot claim
						winnings. Never enter a private key.
					</p>
				{/if}
			</div>

			<!-- Actions -->
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={requestClose} disabled={submitting}>
					Cancel
				</Button>
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
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
