<script lang="ts">
	import type { Solution, Vote, Pledge } from '$lib/bounty/types';
	import { accountState } from '$lib/nostr/account.svelte';
	import { publishEvent } from '$lib/nostr/signer.svelte';
	import { voteBlueprint } from '$lib/bounty/blueprints';
	import { VOTE_KIND } from '$lib/bounty/kinds';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { rateLimiter } from '$lib/nostr/rate-limiter';
	import { connectivity } from '$lib/stores/connectivity.svelte';
	import { calculateVoteWeight } from '$lib/bounty/voting';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';

	const {
		bountyAddress,
		solution,
		pledges,
		existingVotes
	}: {
		bountyAddress: string;
		solution: Solution;
		pledges: Pledge[];
		existingVotes: Vote[];
	} = $props();

	// Calculate current user's total pledge amount for this bounty
	const userPledgeAmount = $derived(
		pledges.filter((p) => p.pubkey === accountState.pubkey).reduce((sum, p) => sum + p.amount, 0)
	);
	const hasPledged = $derived(userPledgeAmount > 0);

	// Derive the user's vote weight from their pledge
	const userVoteWeight = $derived(calculateVoteWeight(userPledgeAmount));

	// Find the user's most recent vote on this solution (if any)
	const existingVote = $derived(
		existingVotes
			.filter((v) => v.pubkey === accountState.pubkey && v.solutionId === solution.id)
			.sort((a, b) => b.createdAt - a.createdAt)[0]?.choice ?? null
	);

	// Determine disabled reasons for tooltip
	const disabledReason = $derived.by(() => {
		if (!accountState.isLoggedIn) return 'Sign in to vote';
		if (!hasPledged) return 'Only pledgers can vote';
		return null;
	});

	// ── Rate limit state ────────────────────────────────────────
	let rateLimitRemaining = $state(0);

	$effect(() => {
		if (rateLimitRemaining <= 0) return;
		const interval = setInterval(() => {
			const result = rateLimiter.canPublish(VOTE_KIND);
			rateLimitRemaining = result.allowed ? 0 : Math.ceil(result.remainingMs / 1000);
		}, 1000);
		return () => clearInterval(interval);
	});

	const isRateLimited = $derived(rateLimitRemaining > 0);

	const isDisabled = $derived(disabledReason !== null || isRateLimited || !connectivity.online);

	let submitting = $state(false);

	async function vote(choice: 'approve' | 'reject') {
		if (!accountState.isLoggedIn || !hasPledged || submitting) return;

		if (existingVote === choice) {
			toastStore.info(`You have already voted to ${choice} this solution`);
			return;
		}

		// Rate limit check
		const rateCheck = rateLimiter.canPublish(VOTE_KIND);
		if (!rateCheck.allowed) {
			rateLimitRemaining = Math.ceil(rateCheck.remainingMs / 1000);
			toastStore.error(`Wait ${rateLimitRemaining}s before voting again`);
			return;
		}

		submitting = true;
		try {
			const template = voteBlueprint({
				bountyAddress,
				solutionId: solution.id,
				solutionAuthor: solution.pubkey,
				choice
			});
			const { broadcast } = await publishEvent(template);
			rateLimiter.recordPublish(VOTE_KIND);

			if (!broadcast.success) {
				toastStore.error('Vote may not have been published. Try again.');
				return;
			}

			toastStore.success('Vote submitted!');
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to submit vote');
		} finally {
			submitting = false;
		}
	}
</script>

<div class="flex flex-col gap-2" role="group" aria-label="Vote on solution">
	<!-- Vote buttons -->
	<div class="flex items-center gap-2">
		<!-- Approve button -->
		<button
			type="button"
			class="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all
				focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none
				disabled:pointer-events-none disabled:opacity-50
				{existingVote === 'approve'
				? 'bg-success text-background shadow-sm'
				: 'border border-success/40 text-success hover:bg-success/10'}"
			disabled={isDisabled || submitting}
			title={disabledReason ??
				(existingVote === 'approve' ? 'You approved this solution' : 'Approve this solution')}
			aria-pressed={existingVote === 'approve'}
			aria-label="Approve solution"
			onclick={() => vote('approve')}
		>
			{#if submitting && existingVote !== 'approve'}
				<LoadingSpinner size="sm" />
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					class="h-4 w-4"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
						clip-rule="evenodd"
					/>
				</svg>
			{/if}
			Approve
		</button>

		<!-- Reject button -->
		<button
			type="button"
			class="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all
				focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none
				disabled:pointer-events-none disabled:opacity-50
				{existingVote === 'reject'
				? 'bg-destructive text-destructive-foreground shadow-sm'
				: 'border border-destructive/40 text-destructive hover:bg-destructive/10'}"
			disabled={isDisabled || submitting}
			title={disabledReason ??
				(existingVote === 'reject' ? 'You rejected this solution' : 'Reject this solution')}
			aria-pressed={existingVote === 'reject'}
			aria-label="Reject solution"
			onclick={() => vote('reject')}
		>
			{#if submitting && existingVote !== 'reject'}
				<LoadingSpinner size="sm" />
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					class="h-4 w-4"
					aria-hidden="true"
				>
					<path
						d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
					/>
				</svg>
			{/if}
			Reject
		</button>
	</div>

	<!-- Vote weight indicator for eligible voters -->
	{#if isRateLimited}
		<p class="text-xs text-warning" role="status">Wait {rateLimitRemaining}s before voting again</p>
	{:else if !connectivity.online}
		<p class="text-xs text-warning" role="alert">Offline — cannot vote</p>
	{:else if accountState.isLoggedIn && hasPledged}
		<p
			class="text-xs text-muted-foreground"
			aria-label="Your vote weight: {userVoteWeight.toLocaleString()} sats"
		>
			Your vote weight: <SatAmount amount={userVoteWeight} />
		</p>
	{:else if disabledReason}
		<p class="text-xs text-muted-foreground" role="note">
			{disabledReason}
		</p>
	{/if}
</div>
