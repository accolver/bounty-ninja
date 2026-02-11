<script lang="ts">
	import { accountState } from '$lib/nostr/account.svelte';
	import { publishEvent } from '$lib/nostr/signer.svelte';
	import { pledgeBlueprint } from '$lib/bounty/blueprints';
	import { PLEDGE_KIND } from '$lib/bounty/kinds';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { getDefaultMint } from '$lib/utils/env';
	import { rateLimiter } from '$lib/nostr/rate-limiter';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import CoinsIcon from '@lucide/svelte/icons/coins';
	import { connectivity } from '$lib/stores/connectivity.svelte';

	let {
		bountyAddress,
		creatorPubkey,
		mintUrl,
		open = $bindable(false)
	}: {
		bountyAddress: string;
		creatorPubkey: string;
		mintUrl: string | null;
		open: boolean;
	} = $props();

	let amount = $state(1000);
	let message = $state('');
	let acknowledged = $state(false);
	let submitting = $state(false);

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

	const MIN_PLEDGE = 1;

	const isValidAmount = $derived(
		amount >= MIN_PLEDGE && Number.isInteger(amount) && Number.isFinite(amount)
	);
	const isValid = $derived(
		isValidAmount && acknowledged && !submitting && !isRateLimited && connectivity.online
	);

	const formattedAmount = $derived(new Intl.NumberFormat().format(amount));
	const effectiveMint = $derived(mintUrl || getDefaultMint());

	async function handleSubmit() {
		if (!isValid || !accountState.pubkey) return;

		// Rate limit check
		const rateCheck = rateLimiter.canPublish(PLEDGE_KIND);
		if (!rateCheck.allowed) {
			rateLimitRemaining = Math.ceil(rateCheck.remainingMs / 1000);
			toastStore.error(`Wait ${rateLimitRemaining}s before submitting another pledge`);
			return;
		}

		submitting = true;

		try {
			// For MVP, we encode a placeholder token — actual minting requires user's wallet.
			// In production this would call createPledgeToken() with the user's Cashu proofs.
			const cashuToken = `cashuA_pledge_${amount}_${Date.now()}`;

			const template = pledgeBlueprint({
				bountyAddress,
				creatorPubkey,
				amount,
				cashuToken,
				mintUrl: effectiveMint,
				message: message.trim() || undefined
			});

			await publishEvent(template);
			rateLimiter.recordPublish(PLEDGE_KIND);
			toastStore.success(`Pledge of ${formattedAmount} sats submitted!`);
			resetForm();
			open = false;
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to submit pledge');
		} finally {
			submitting = false;
		}
	}

	function resetForm() {
		amount = 1000;
		message = '';
		acknowledged = false;
	}

	function handleAmountInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const parsed = parseInt(target.value, 10);
		amount = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Fund this bounty</Dialog.Title>
			<Dialog.Description>
				Pledge sats to increase the bounty reward and incentivize solutions.
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
			<!-- Amount input -->
			<div class="space-y-2">
				<label for="pledge-amount" class="text-sm font-medium text-foreground">
					Amount (sats)
				</label>
				<div class="relative">
					<Input
						id="pledge-amount"
						type="number"
						value={amount}
						oninput={handleAmountInput}
						min={MIN_PLEDGE}
						step="1"
						required
						disabled={submitting}
						aria-describedby="pledge-amount-help"
						aria-invalid={amount > 0 && !isValidAmount}
						class="pr-14"
					/>
					<span
						class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
					>
						sats
					</span>
				</div>
				<p id="pledge-amount-help" class="text-xs text-muted-foreground">
					Minimum pledge: {MIN_PLEDGE} sat. You are pledging to mint:
					<span class="font-mono text-foreground/80">{effectiveMint}</span>
				</p>
				{#if amount > 0 && !isValidAmount}
					<p class="text-xs text-destructive" role="alert">
						Please enter a whole number of at least {MIN_PLEDGE} sat.
					</p>
				{/if}
			</div>

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
							Cashu tokens are like cash. Once sent, they cannot be reversed. Ensure you trust this
							bounty creator.
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
								I understand that this pledge is irreversible and I accept the risk.
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
						Submitting...
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
