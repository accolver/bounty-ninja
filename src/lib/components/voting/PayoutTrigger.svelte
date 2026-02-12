<script lang="ts">
	import type { Solution, Pledge } from '$lib/bounty/types';
	import { nip19 } from 'nostr-tools';
	import { accountState } from '$lib/nostr/account.svelte';
	import { publishEvent } from '$lib/nostr/signer.svelte';
	import { payoutBlueprint } from '$lib/bounty/blueprints';
	import { PAYOUT_KIND } from '$lib/bounty/kinds';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { rateLimiter } from '$lib/nostr/rate-limiter';
	import { connectivity } from '$lib/stores/connectivity.svelte';
	import { formatNpub } from '$lib/utils/format';
	import {
		collectPledgeTokens,
		checkPledgeProofsSpendable,
		groupPledgesByMint,
		processMultiMintPayout,
		encodeMultiMintPayoutTokens
	} from '$lib/cashu/escrow';
	import { getWallet } from '$lib/cashu/mint';
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
		isCreator
	}: {
		bountyAddress: string;
		winningSolution: Solution | undefined;
		pledges: Pledge[];
		isCreator: boolean;
	} = $props();

	let showConfirm = $state(false);
	let processing = $state(false);
	let step = $state<'confirm' | 'key-entry' | 'processing' | 'broadcast-failure'>('confirm');
	let nsecInput = $state('');
	let nsecError = $state('');
	let spendableCount = $state<number | null>(null);
	let statusMessage = $state('');

	// ── Broadcast failure recovery state ────────────────────────
	let recoveryToken = $state('');
	let tokenCopied = $state(false);

	// ── Mint summary state ─────────────────────────────────────
	/** Maps mint URL to total pledged amount from that mint. */
	let mintSummary = $state<Map<string, number>>(new Map());

	const isMultiMint = $derived(mintSummary.size > 1);
	const mintSummaryEntries = $derived(Array.from(mintSummary.entries()));

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

	const totalPledged = $derived(pledges.reduce((sum, p) => sum + p.amount, 0));

	const solverNpub = $derived(winningSolution ? nip19.npubEncode(winningSolution.pubkey) : null);

	const formattedSolverNpub = $derived(solverNpub ? formatNpub(solverNpub) : null);

	const canTriggerPayout = $derived(
		accountState.isLoggedIn && isCreator && winningSolution !== undefined
	);

	// ── Nsec decoding ───────────────────────────────────────────
	let privkeyHex = $derived.by(() => {
		const trimmed = nsecInput.trim();
		if (!trimmed) return '';

		// Try nsec1... format
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

		// Try raw 64-char hex
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

	async function openDialog() {
		step = 'confirm';
		nsecInput = '';
		nsecError = '';
		spendableCount = null;
		statusMessage = '';
		recoveryToken = '';
		tokenCopied = false;
		showConfirm = true;

		// Build mint summary from pledge tokens
		const decoded = await collectPledgeTokens(pledges.map((p) => p.event));
		const groups = groupPledgesByMint(decoded);
		const summary = new Map<string, number>();
		for (const [mintUrl, mintPledges] of groups) {
			const total = mintPledges.reduce((sum, p) => sum + p.amount, 0);
			summary.set(mintUrl, total);
		}
		mintSummary = summary;
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

		// Check spendability in background
		checkSpendable();
	}

	async function checkSpendable() {
		try {
			const decoded = await collectPledgeTokens(pledges.map((p) => p.event));
			if (decoded.length === 0) {
				spendableCount = 0;
				return;
			}

			// Check spendability per mint — each mint needs its own wallet
			const groups = groupPledgesByMint(decoded);
			let count = 0;
			for (const [mintUrl, mintPledges] of groups) {
				const wallet = await getWallet(mintUrl);
				const results = await checkPledgeProofsSpendable(mintPledges, wallet);
				for (const [, ok] of results) {
					if (ok) count++;
				}
			}
			spendableCount = count;
		} catch {
			// Non-critical — don't block the flow
			spendableCount = null;
		}
	}

	async function handlePayout() {
		if (!winningSolution || processing || !isKeyValid) return;

		// Rate limit check
		const rateCheck = rateLimiter.canPublish(PAYOUT_KIND);
		if (!rateCheck.allowed) {
			rateLimitRemaining = Math.ceil(rateCheck.remainingMs / 1000);
			toastStore.error(`Wait ${rateLimitRemaining}s before triggering another payout`);
			return;
		}

		// Capture the private key and immediately clear the input
		const creatorPrivkey = privkeyHex;
		nsecInput = '';

		processing = true;
		step = 'processing';

		try {
			// Step 1: Collect pledge tokens from events
			statusMessage = 'Collecting pledge tokens...';
			const decodedPledges = await collectPledgeTokens(pledges.map((p) => p.event));
			if (decodedPledges.length === 0) {
				toastStore.error('No valid pledge tokens found');
				return;
			}

			// Step 2-4: Process payout across all mints (handles grouping internally)
			const payoutResult = await processMultiMintPayout(
				decodedPledges,
				creatorPrivkey,
				winningSolution.pubkey,
				(msg) => { statusMessage = msg; }
			);

			if (!payoutResult.success) {
				toastStore.error(payoutResult.error ?? 'Failed to process payout');
				return;
			}

			// Step 5: Encode and publish payout event
			statusMessage = 'Publishing payout event...';
			const payoutTokenStr = await encodeMultiMintPayoutTokens(payoutResult.entries);
			const payoutAmount = payoutResult.totalAmount;

			const template = payoutBlueprint({
				bountyAddress,
				solutionId: winningSolution.id,
				solverPubkey: winningSolution.pubkey,
				amount: payoutAmount,
				cashuToken: payoutTokenStr
			});

			const { broadcast } = await publishEvent(template);
			rateLimiter.recordPublish(PAYOUT_KIND);

			if (!broadcast.success) {
				// CRITICAL: Cashu tokens have already been swapped but the Nostr
				// event failed to publish. Show recovery UI so the user can
				// manually share the token with the solver.
				recoveryToken = payoutTokenStr;
				step = 'broadcast-failure';
				return;
			}

			toastStore.success(`Payout of ${payoutAmount.toLocaleString()} sats sent to solver!`);
			showConfirm = false;
		} catch (err) {
			if (err instanceof DoubleSpendError) {
				toastStore.error('Pledge tokens have already been spent');
			} else if (err instanceof MintConnectionError) {
				toastStore.error('Could not connect to the Cashu mint. Please try again.');
			} else {
				toastStore.error(err instanceof Error ? err.message : 'Payout failed');
			}
		} finally {
			processing = false;
			statusMessage = '';
		}
	}
</script>

{#if canTriggerPayout}
	<div class="space-y-2">
		{#if !connectivity.online}
			<p class="text-xs text-warning text-center" role="alert">Offline — cannot trigger payout</p>
		{/if}
		<Button
			variant="default"
			class="w-full bg-success text-background hover:bg-success/90"
			onclick={openDialog}
			disabled={processing || !connectivity.online || isRateLimited}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				class="h-4 w-4"
				aria-hidden="true"
			>
				<path
					fill-rule="evenodd"
					d="M1 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4Zm12 4a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM4 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm13-1a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM1.75 14.5a.75.75 0 0 0 0 1.5c4.417 0 8.693.603 12.749 1.73 1.111.309 2.251-.512 2.251-1.696v-.784a.75.75 0 0 0-1.5 0v.784a.272.272 0 0 1-.35.25A49.043 49.043 0 0 0 1.75 14.5Z"
					clip-rule="evenodd"
				/>
			</svg>
			{#if isRateLimited}
				Wait {rateLimitRemaining}s
			{:else}
				Trigger Payout
			{/if}
		</Button>

		<!-- Multi-step payout dialog -->
		<Dialog.Root bind:open={showConfirm}>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>
						{#if step === 'confirm'}Confirm Payout
						{:else if step === 'key-entry'}Enter Private Key
						{:else if step === 'broadcast-failure'}Broadcast Failed — Recovery Required
						{:else}Processing Payout{/if}
					</Dialog.Title>
					<Dialog.Description>
						{#if step === 'confirm'}
							Review the payout details before proceeding.
						{:else if step === 'key-entry'}
							Your private key is needed to unlock the escrowed pledge tokens.
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
									class="font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
								>
									{formattedSolverNpub}
								</a>
							{/if}
						</div>

						<div class="flex items-center justify-between text-sm">
							<span class="text-muted-foreground">Payout Amount</span>
							<SatAmount amount={totalPledged} />
						</div>

						{#if isMultiMint}
							<div class="rounded-md border border-border bg-card p-3 space-y-2">
								<h4 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Mints Involved ({mintSummary.size})
								</h4>
								<ul class="space-y-1">
									{#each mintSummaryEntries as [mintUrl, amount]}
										<li class="flex items-center justify-between text-xs">
											<span class="text-foreground/80 font-mono truncate max-w-[200px]" title={mintUrl}>
												{mintUrl.replace(/^https?:\/\//, '')}
											</span>
											<SatAmount {amount} />
										</li>
									{/each}
								</ul>
								<p class="text-xs text-muted-foreground">
									Tokens will be swapped independently at each mint.
								</p>
							</div>
						{/if}

						<div
							class="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3"
							role="alert"
						>
							<TriangleAlertIcon class="mt-0.5 size-4 shrink-0 text-warning" />
							<p class="text-xs text-warning">
								This action cannot be undone. The Cashu tokens will be transferred to the solver.
								Ensure the winning solution meets the bounty requirements.
							</p>
						</div>
					</div>

					<Dialog.Footer>
						<Button variant="outline" onclick={() => (showConfirm = false)}>Cancel</Button>
						<Button
							class="bg-success text-background hover:bg-success/90"
							onclick={goToKeyEntry}
							disabled={!connectivity.online}
						>
							Continue
						</Button>
					</Dialog.Footer>

					<!-- Step 2: Key entry -->
				{:else if step === 'key-entry'}
					<div class="space-y-4 py-2">
						<!-- Security warning -->
						<div
							class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3"
							role="alert"
						>
							<ShieldAlertIcon class="mt-0.5 size-4 shrink-0 text-destructive" />
							<div class="space-y-1">
								<p class="text-xs font-medium text-destructive">Private key required</p>
								<p class="text-xs text-foreground/80">
									Your private key is used to sign the P2PK-locked pledge tokens. It is held in
									memory only for the swap operation and immediately cleared. It is never stored or
									transmitted.
								</p>
							</div>
						</div>

						<!-- Nsec input -->
						<div class="space-y-2">
							<label for="payout-nsec" class="text-sm font-medium text-foreground">
								Private Key
							</label>
							<input
								id="payout-nsec"
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

						<!-- Spendability check result -->
						{#if spendableCount !== null}
							<p class="text-xs text-muted-foreground">
								{spendableCount} of {pledges.length} pledge token{pledges.length === 1 ? '' : 's'} verified
								as spendable.
							</p>
						{/if}
					</div>

					<Dialog.Footer>
						<Button variant="outline" onclick={() => (step = 'confirm')}>Back</Button>
						<Button
							class="bg-success text-background hover:bg-success/90"
							onclick={handlePayout}
							disabled={!isKeyValid || !connectivity.online}
						>
							Sign & Send Payout
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
									Copy the token below and share it with the solver directly. These tokens
									represent real funds that have already been swapped at the mint. Do NOT
									close this dialog until you have saved the token.
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
								Send this token to the solver ({formattedSolverNpub}) via direct message
								or another secure channel.
							</p>
						{/if}
					</div>

					<Dialog.Footer>
						<Button
							variant="default"
							class="bg-primary"
							onclick={copyRecoveryToken}
						>
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
