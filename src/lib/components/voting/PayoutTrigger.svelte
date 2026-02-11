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
	import SatAmount from '$lib/components/shared/SatAmount.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

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

	// Only render when user is the bounty creator and there's a winning solution
	const canTriggerPayout = $derived(
		accountState.isLoggedIn && isCreator && winningSolution !== undefined
	);

	async function handlePayout() {
		if (!winningSolution || processing) return;

		// Rate limit check
		const rateCheck = rateLimiter.canPublish(PAYOUT_KIND);
		if (!rateCheck.allowed) {
			rateLimitRemaining = Math.ceil(rateCheck.remainingMs / 1000);
			toastStore.error(`Wait ${rateLimitRemaining}s before triggering another payout`);
			return;
		}

		processing = true;
		try {
			// For MVP: create a placeholder payout token
			const cashuToken = `cashuA_payout_${totalPledged}_${Date.now()}`;

			const template = payoutBlueprint({
				bountyAddress,
				solutionId: winningSolution.id,
				solverPubkey: winningSolution.pubkey,
				amount: totalPledged,
				cashuToken
			});

			await publishEvent(template);
			rateLimiter.recordPublish(PAYOUT_KIND);
			toastStore.success(`Payout of ${totalPledged.toLocaleString()} sats sent to solver!`);
			showConfirm = false;
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Payout failed');
		} finally {
			processing = false;
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
			onclick={() => (showConfirm = true)}
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

		<!-- Confirmation dialog -->
		<Dialog.Root bind:open={showConfirm}>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>Confirm Payout</Dialog.Title>
					<Dialog.Description>
						Review the payout details before confirming. This action is irreversible.
					</Dialog.Description>
				</Dialog.Header>

				<div class="space-y-4 py-2">
					<!-- Winning solution summary -->
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

					<!-- Solver -->
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

					<!-- Payout amount -->
					<div class="flex items-center justify-between text-sm">
						<span class="text-muted-foreground">Payout Amount</span>
						<SatAmount amount={totalPledged} />
					</div>

					<!-- Warning -->
					<div
						class="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3"
						role="alert"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
							class="mt-0.5 h-4 w-4 shrink-0 text-warning"
							aria-hidden="true"
						>
							<path
								fill-rule="evenodd"
								d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
								clip-rule="evenodd"
							/>
						</svg>
						<p class="text-xs text-warning">
							This action cannot be undone. The Cashu tokens will be transferred to the solver.
							Ensure the winning solution meets the bounty requirements.
						</p>
					</div>
				</div>

				<Dialog.Footer>
					<Button variant="outline" onclick={() => (showConfirm = false)} disabled={processing}>
						Cancel
					</Button>
					<Button
						class="bg-success text-background hover:bg-success/90"
						onclick={handlePayout}
						disabled={processing || !connectivity.online}
					>
						{#if processing}
							<LoadingSpinner size="sm" />
							Processing...
						{:else if !connectivity.online}
							Offline
						{:else}
							Confirm Payout
						{/if}
					</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>
	</div>
{/if}
