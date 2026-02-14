<script lang="ts">
	import type { Solution, Pledge, Payout } from '$lib/bounty/types';
	import { nip19 } from 'nostr-tools';
	import { accountState } from '$lib/nostr/account.svelte';
	import { publishEvent } from '$lib/nostr/signer.svelte';
	import { payoutBlueprint } from '$lib/bounty/blueprints';
	import { PAYOUT_KIND } from '$lib/bounty/kinds';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { rateLimiter } from '$lib/nostr/rate-limiter';
	import { connectivity } from '$lib/stores/connectivity.svelte';
	import { formatNpub } from '$lib/utils/format';
	import { collectPledgeTokens, releasePledgeToSolver, encodePayoutToken } from '$lib/cashu/escrow';
	import { getProofsAmount } from '$lib/cashu/token';
	import { MintConnectionError, DoubleSpendError } from '$lib/cashu/types';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert';

	const {
		bountyAddress,
		winningSolution,
		pledges,
		payouts = []
	}: {
		bountyAddress: string;
		winningSolution: Solution | undefined;
		pledges: Pledge[];
		payouts: Payout[];
	} = $props();

	let showConfirm = $state(false);
	let processing = $state(false);
	let step = $state<'confirm' | 'key-entry' | 'processing' | 'broadcast-failure'>('confirm');
	let nsecInput = $state('');
	let nsecError = $state('');
	let statusMessage = $state('');

	// ── Broadcast failure recovery state ────────────────────────
	let recoveryToken = $state('');
	let tokenCopied = $state(false);

	// ── Rate limit state ────────────────────────────────────────
	let rateLimitRemaining = $state(0);

	$effect(() => {
		if (rateLimitRemaining <= 0) return;
		const interval = setInterval(() => {
			const result = rateLimiter.canPublish(PAYOUT_KIND);
			rateLimitRemaining = result.allowed ? 0 : Math.ceil(result.remainingMs / 1000);
		}, 1000);
		return () => clearInterval(interval);
	});

	const isRateLimited = $derived(rateLimitRemaining > 0);

	/** Current user's pledges */
	const myPledges = $derived.by(() => {
		if (!accountState.pubkey) return [];
		return pledges.filter((p) => p.pubkey === accountState.pubkey);
	});

	/** Total amount the current user has pledged */
	const myTotalPledged = $derived(myPledges.reduce((sum, p) => sum + p.amount, 0));

	/** Whether the current user is a pledger */
	const isPledger = $derived(myPledges.length > 0);

	/** Whether the current user has already released (has a Kind 73004 event) */
	const hasReleased = $derived(
		accountState.pubkey ? payouts.some((p) => p.pubkey === accountState.pubkey) : false
	);

	/** Release progress metrics */
	const uniquePledgers = $derived(new Set(pledges.map((p) => p.pubkey)).size);
	const releasedPledgers = $derived(new Set(payouts.map((p) => p.pubkey)).size);
	const totalPledged = $derived(pledges.reduce((sum, p) => sum + p.amount, 0));
	const totalReleased = $derived(payouts.reduce((sum, p) => sum + p.amount, 0));
	const releasePercent = $derived(
		totalPledged > 0 ? Math.round((totalReleased / totalPledged) * 100) : 0
	);

	const solverNpub = $derived(winningSolution ? nip19.npubEncode(winningSolution.pubkey) : null);
	const formattedSolverNpub = $derived(solverNpub ? formatNpub(solverNpub) : null);

	/** Show release button only for pledgers who haven't released yet */
	const canRelease = $derived(
		accountState.isLoggedIn &&
			isPledger &&
			!hasReleased &&
			winningSolution !== undefined &&
			connectivity.online
	);

	// ── Nsec decoding ───────────────────────────────────────────
	let privkeyHex = $derived.by(() => {
		const trimmed = nsecInput.trim();
		if (!trimmed) return '';

		if (trimmed.startsWith('nsec1')) {
			try {
				const decoded = nip19.decode(trimmed);
				if (decoded.type === 'nsec') {
					return Array.from(new Uint8Array(decoded.data))
						.map((b) => b.toString(16).padStart(2, '0'))
						.join('');
				}
			} catch {
				return '';
			}
		}

		if (/^[0-9a-f]{64}$/i.test(trimmed)) {
			return trimmed.toLowerCase();
		}

		return '';
	});

	$effect(() => {
		const trimmed = nsecInput.trim();
		if (!trimmed) {
			nsecError = '';
			return;
		}
		if (!privkeyHex) {
			nsecError = 'Invalid key — enter an nsec1... or 64-char hex private key';
		} else {
			nsecError = '';
		}
	});

	const isKeyValid = $derived(privkeyHex.length === 64);

	function openDialog() {
		step = 'confirm';
		nsecInput = '';
		nsecError = '';
		statusMessage = '';
		recoveryToken = '';
		tokenCopied = false;
		showConfirm = true;
	}

	async function copyRecoveryToken() {
		try {
			await navigator.clipboard.writeText(recoveryToken);
			tokenCopied = true;
			toastStore.success('Token copied to clipboard');
		} catch {
			toastStore.error('Failed to copy — please select and copy manually');
		}
	}

	function goToKeyEntry() {
		step = 'key-entry';
	}

	async function handleRelease() {
		if (!winningSolution || processing || !isKeyValid) return;

		// Rate limit check
		const rateCheck = rateLimiter.canPublish(PAYOUT_KIND);
		if (!rateCheck.allowed) {
			rateLimitRemaining = Math.ceil(rateCheck.remainingMs / 1000);
			toastStore.error(`Wait ${rateLimitRemaining}s before releasing`);
			return;
		}

		// Capture the private key and immediately clear the input
		const pledgerPrivkey = privkeyHex;
		nsecInput = '';

		processing = true;
		step = 'processing';

		try {
			// Step 1: Collect this pledger's tokens
			statusMessage = 'Collecting your pledge tokens...';
			const pledgeEvents = myPledges.map((p) => p.event);
			const decoded = await collectPledgeTokens(pledgeEvents);

			if (decoded.length === 0) {
				toastStore.error('No valid pledge tokens found');
				return;
			}

			// Step 2: Release each pledge to the solver
			let totalPayoutAmount = 0;
			const allSolverProofs: import('@cashu/cashu-ts').Proof[] = [];
			let releaseMint = '';

			for (let i = 0; i < decoded.length; i++) {
				const pledge = decoded[i];
				statusMessage = `Releasing token ${i + 1}/${decoded.length}...`;

				const result = await releasePledgeToSolver(pledge, pledgerPrivkey, winningSolution.pubkey);

				if (!result.success) {
					toastStore.error(result.error ?? 'Failed to release pledge');
					return;
				}

				totalPayoutAmount += getProofsAmount(result.proofs);
				allSolverProofs.push(...result.proofs);
				// NOTE: If a pledger has pledges from multiple mints, releaseMint will
				// reference only the last mint. Multi-mint pledges from a single pledger
				// are unlikely in practice but the encoded payout token will only carry
				// the final mint URL in that edge case.
				releaseMint = pledge.mint;
			}

			// Step 3: Encode and publish Kind 73004 payout event
			statusMessage = 'Publishing release event...';
			const payoutTokenStr = await encodePayoutToken(allSolverProofs, releaseMint);

			const template = payoutBlueprint({
				bountyAddress,
				solutionId: winningSolution.id,
				solverPubkey: winningSolution.pubkey,
				amount: totalPayoutAmount,
				cashuToken: payoutTokenStr
			});

			const { broadcast } = await publishEvent(template);
			rateLimiter.recordPublish(PAYOUT_KIND);

			if (!broadcast.success) {
				// CRITICAL: Cashu tokens have been swapped but event failed to publish
				recoveryToken = payoutTokenStr;
				step = 'broadcast-failure';
				return;
			}

			toastStore.success(`Released ${totalPayoutAmount.toLocaleString()} sats to solver!`);
			showConfirm = false;
		} catch (err) {
			if (err instanceof DoubleSpendError) {
				toastStore.error('These tokens have already been spent');
			} else if (err instanceof MintConnectionError) {
				toastStore.error('Could not connect to the Cashu mint. Please try again.');
			} else {
				toastStore.error(err instanceof Error ? err.message : 'Release failed');
			}
		} finally {
			processing = false;
			statusMessage = '';
		}
	}
</script>

<!-- Release progress (visible to everyone when payouts exist) -->
{#if payouts.length > 0}
	<div class="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
		<p>
			{releasedPledgers} of {uniquePledgers} pledger{uniquePledgers === 1 ? '' : 's'} released ({releasePercent}%
			of funds)
		</p>
		<div class="mt-1.5 h-1.5 w-full rounded-full bg-muted">
			<div
				class="h-full rounded-full bg-success transition-all"
				style="width: {releasePercent}%"
			></div>
		</div>
	</div>
{/if}

<!-- Already released confirmation -->
{#if hasReleased}
	<div
		class="rounded-lg border border-success/50 bg-success/10 p-3 text-sm"
		role="status"
		aria-label="Funds released"
	>
		<p class="font-medium text-success">
			You have released your funds ({myTotalPledged.toLocaleString()} sats).
		</p>
	</div>
{/if}

<!-- Release button for pledgers who haven't released -->
{#if canRelease}
	<div class="space-y-2">
		{#if !connectivity.online}
			<p class="text-center text-xs text-warning" role="alert">Offline — cannot release funds</p>
		{/if}
		<Button
			variant="default"
			class="w-full bg-success text-background hover:bg-success/90 hover:cursor-pointer transition-colors"
			onclick={openDialog}
			disabled={processing || isRateLimited}
		>
			{#if isRateLimited}
				Wait {rateLimitRemaining}s
			{:else}
				Release Funds to Solver
			{/if}
		</Button>

		<!-- Multi-step release dialog -->
		<Dialog.Root bind:open={showConfirm}>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>
						{#if step === 'confirm'}Release Funds
						{:else if step === 'key-entry'}Enter Private Key
						{:else if step === 'broadcast-failure'}Broadcast Failed — Recovery Required
						{:else}Releasing Funds{/if}
					</Dialog.Title>
					<Dialog.Description>
						{#if step === 'confirm'}
							Review the release details before proceeding.
						{:else if step === 'key-entry'}
							Your private key is needed to unlock your pledge tokens and re-lock them to the
							solver.
						{:else if step === 'broadcast-failure'}
							The payout token was created but could not be published to relays.
						{:else}
							Swapping tokens at the mint...
						{/if}
					</Dialog.Description>
				</Dialog.Header>

				<!-- Step 1: Confirm -->
				{#if step === 'confirm'}
					<div class="space-y-4 py-2">
						<div class="rounded-md border border-border bg-card p-3 space-y-2">
							<h4 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
								Winning Solution
							</h4>
							<p class="text-sm text-foreground line-clamp-3">
								{winningSolution?.description.slice(0, 200)}{winningSolution &&
								winningSolution.description.length > 200
									? '...'
									: ''}
							</p>
						</div>

						<div class="flex items-center justify-between text-sm">
							<span class="text-muted-foreground">Solver</span>
							{#if solverNpub}
								<a
									href="/profile/{solverNpub}"
									class="font-medium text-primary transition-colors hover:underline hover:cursor-pointer focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
								>
									{formattedSolverNpub}
								</a>
							{/if}
						</div>

						<div class="flex items-center justify-between text-sm">
							<span class="text-muted-foreground">Your Pledge Amount</span>
							<SatAmount amount={myTotalPledged} />
						</div>

						<div
							class="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3"
							role="alert"
						>
							<TriangleAlertIcon class="mt-0.5 size-4 shrink-0 text-warning" />
							<p class="text-xs text-warning">
								This action cannot be undone. Your Cashu tokens will be transferred to the solver.
								Ensure the winning solution meets the bounty requirements.
							</p>
						</div>
					</div>

					<Dialog.Footer>
						<Button variant="outline" onclick={() => (showConfirm = false)}>Cancel</Button>
						<Button
							class="bg-success text-background hover:bg-success/90 hover:cursor-pointer transition-colors"
							onclick={goToKeyEntry}
						>
							Continue
						</Button>
					</Dialog.Footer>

					<!-- Step 2: Key entry -->
				{:else if step === 'key-entry'}
					<div class="space-y-4 py-2">
						<div
							class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3"
							role="alert"
						>
							<ShieldAlertIcon class="mt-0.5 size-4 shrink-0 text-destructive" />
							<div class="space-y-1">
								<p class="text-xs font-medium text-destructive">Private key required</p>
								<p class="text-xs text-foreground/80">
									Your private key is used to sign your P2PK-locked pledge tokens and re-lock them
									to the solver. It is held in memory only for the swap operation and immediately
									cleared. It is never stored or transmitted.
								</p>
							</div>
						</div>

						<div class="space-y-2">
							<label for="release-nsec" class="text-sm font-medium text-foreground">
								Private Key
							</label>
							<input
								id="release-nsec"
								type="password"
								bind:value={nsecInput}
								autocomplete="off"
								spellcheck={false}
								placeholder="nsec1... or hex private key"
								class="font-mono text-xs border-border bg-white dark:bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-md border px-3 py-2 shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]"
							/>
							{#if nsecError}
								<p class="text-xs text-destructive" role="alert">{nsecError}</p>
							{/if}
						</div>
					</div>

					<Dialog.Footer>
						<Button variant="outline" onclick={() => (step = 'confirm')}>Back</Button>
						<Button
							class="bg-success text-background hover:bg-success/90 hover:cursor-pointer transition-colors"
							onclick={handleRelease}
							disabled={!isKeyValid}
						>
							Sign & Release Funds
						</Button>
					</Dialog.Footer>

					<!-- Step 3: Broadcast failure recovery -->
				{:else if step === 'broadcast-failure'}
					<div class="space-y-4 py-2">
						<div
							class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3"
							role="alert"
						>
							<ShieldAlertIcon class="mt-0.5 size-4 shrink-0 text-destructive" />
							<div class="space-y-1">
								<p class="text-xs font-medium text-destructive">
									WARNING: Payout tokens were created but the Nostr event failed to publish.
								</p>
								<p class="text-xs text-foreground/80">
									Copy the token below and share it with the solver directly. These tokens represent
									real funds that have already been swapped at the mint. Do NOT close this dialog
									until you have saved the token.
								</p>
							</div>
						</div>

						<div class="space-y-2">
							<label for="recovery-token" class="text-sm font-medium text-foreground">
								Payout Token
							</label>
							<textarea
								id="recovery-token"
								readonly
								rows={4}
								value={recoveryToken}
								class="font-mono text-xs border-border bg-white dark:bg-input/30 flex w-full rounded-md border px-3 py-2 shadow-xs outline-none select-all break-all"
							></textarea>
						</div>

						{#if formattedSolverNpub}
							<p class="text-xs text-muted-foreground">
								Send this token to the solver ({formattedSolverNpub}) via direct message or another
								secure channel.
							</p>
						{/if}
					</div>

					<Dialog.Footer>
						<Button variant="default" class="bg-primary" onclick={copyRecoveryToken}>
							{#if tokenCopied}
								Copied!
							{:else}
								Copy Token
							{/if}
						</Button>
					</Dialog.Footer>

					<!-- Step 4: Processing -->
				{:else}
					<div class="flex flex-col items-center gap-3 py-6">
						<LoadingSpinner size="lg" />
						<p class="text-sm text-muted-foreground">{statusMessage}</p>
					</div>
				{/if}
			</Dialog.Content>
		</Dialog.Root>
	</div>
{/if}

<!-- Read-only status for non-pledgers -->
{#if !isPledger && !hasReleased && winningSolution && payouts.length === 0}
	<div class="rounded-lg border border-border bg-card p-4 text-center">
		<p class="text-sm text-muted-foreground">Awaiting fund releases from pledgers.</p>
	</div>
{/if}
