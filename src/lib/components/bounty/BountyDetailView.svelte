<script lang="ts">
	import type { BountyDetail } from '$lib/bounty/types';
	import { tallyVotes } from '$lib/bounty/voting';
	import { BOUNTY_KIND } from '$lib/bounty/kinds';
	import { accountState } from '$lib/nostr/account.svelte';
	import BountyStatusBadge from './BountyStatusBadge.svelte';
	import BountyTimer from './BountyTimer.svelte';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';
	import TimeAgo from '$lib/components/shared/TimeAgo.svelte';
	import ProfileLink from '$lib/components/shared/ProfileLink.svelte';
	import MarkdownViewer from '$lib/components/shared/MarkdownViewer.svelte';
	import Tooltip from '$lib/components/shared/Tooltip.svelte';
	import ErrorBoundary from '$lib/components/shared/ErrorBoundary.svelte';
	import InfoIcon from '@lucide/svelte/icons/info';
	import PledgeList from '$lib/components/pledge/PledgeList.svelte';
	import PledgeButton from '$lib/components/pledge/PledgeButton.svelte';
	import PledgeForm from '$lib/components/pledge/PledgeForm.svelte';
	import ReclaimAlert from '$lib/components/pledge/ReclaimAlert.svelte';
	import SolutionForm from '$lib/components/solution/SolutionForm.svelte';
	import VoteButton from '$lib/components/voting/VoteButton.svelte';
	import VoteProgress from '$lib/components/voting/VoteProgress.svelte';
	import PayoutTrigger from '$lib/components/voting/PayoutTrigger.svelte';
	import SolverClaim from '$lib/components/voting/SolverClaim.svelte';
	import RetractButton from '$lib/components/bounty/RetractButton.svelte';
	import { connectivity } from '$lib/stores/connectivity.svelte';
	import type { Retraction } from '$lib/bounty/types';
	import UnlockIcon from '@lucide/svelte/icons/unlock';
	import CrownIcon from '@lucide/svelte/icons/crown';

	const {
		detail,
		retractions = []
	}: {
		detail: BountyDetail;
		retractions?: Retraction[];
	} = $props();

	/** NIP-33 bounty address: kind:pubkey:d-tag */
	const bountyAddress = $derived(`${BOUNTY_KIND}:${detail.pubkey}:${detail.dTag}`);

	/** Whether the current user is the bounty creator */
	const isCreator = $derived(accountState.pubkey === detail.pubkey);

	/** Build a map of pubkey → total pledge amount for voting */
	const pledgesByPubkey = $derived.by(() => {
		const map = new Map<string, number>();
		for (const p of detail.pledges) {
			map.set(p.pubkey, (map.get(p.pubkey) ?? 0) + p.amount);
		}
		return map;
	});

	/** Find the winning solution (approved by consensus) */
	const winningSolution = $derived.by(() => {
		// Check if any payout references a solution
		if (detail.payouts.length > 0) {
			const solutionId = detail.payouts[0].solutionId;
			return detail.solutions.find((s) => s.id === solutionId);
		}
		// Check for consensus-approved solutions (pre-payout)
		for (const solution of detail.solutions) {
			const votes = detail.votesBySolution.get(solution.id) ?? [];
			const tally = tallyVotes(votes, pledgesByPubkey, detail.totalPledged);
			if (tally.isApproved) return solution;
		}
		return undefined;
	});

	/** Whether the bounty is in a release phase */
	const isReleasePhase = $derived(
		detail.status === 'consensus_reached' || detail.status === 'releasing'
	);

	/** Solutions sorted with winning solution first */
	const sortedSolutions = $derived.by(() => {
		if (!winningSolution) return detail.solutions;
		const winner = detail.solutions.find((s) => s.id === winningSolution.id);
		const rest = detail.solutions.filter((s) => s.id !== winningSolution.id);
		return winner ? [winner, ...rest] : detail.solutions;
	});

	/** Release progress stats for pledges header */
	const uniquePledgers = $derived(new Set(detail.pledges.map((p) => p.pubkey)).size);
	const releasedPledgers = $derived(new Set(detail.payouts.map((p) => p.pubkey)).size);

	/** Whether the current user is a pledger who still needs to release funds */
	const needsRelease = $derived.by(() => {
		if (!accountState.isLoggedIn || !accountState.pubkey) return false;
		if (!winningSolution) return false;
		if (!isReleasePhase && detail.payouts.length === 0) return false;
		const isPledger = detail.pledges.some((p) => p.pubkey === accountState.pubkey);
		if (!isPledger) return false;
		const hasReleased = detail.payouts.some((p) => p.pubkey === accountState.pubkey);
		return !hasReleased;
	});

	/** Amount the current user has pledged */
	const myPledgeTotal = $derived(
		detail.pledges
			.filter((p) => p.pubkey === accountState.pubkey)
			.reduce((sum, p) => sum + p.amount, 0)
	);

	let pledgeFormOpen = $state(false);
	let releaseDialogOpen = $state(false);
</script>

<article class="mx-auto max-w-5xl space-y-4">
	<!-- Header + stats -->
	<div
		class="flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-end md:justify-between"
	>
		<header class="space-y-3">
			<div class="flex flex-wrap items-center gap-2">
				<BountyStatusBadge status={detail.status} />
				<BountyTimer deadline={detail.deadline} />
				<TimeAgo timestamp={detail.createdAt} />
			</div>

			<h1 class="pt-4 text-2xl font-bold text-foreground">{detail.title}</h1>

			<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
				<span class="inline-flex items-center gap-1 text-muted-foreground">
					Posted by
					<ProfileLink pubkey={detail.pubkey} />
				</span>
				{#if isCreator && detail.status !== 'completed' && detail.status !== 'cancelled'}
					<RetractButton taskAddress={bountyAddress} hasSolutions={detail.solutions.length > 0} />
				{/if}
				{#if detail.tags.length > 0}
					<div class="flex items-center gap-1.5" aria-label="Bounty tags">
						{#each detail.tags as tag (tag)}
							<span
								class="inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
							>
								{tag}
							</span>
						{/each}
					</div>
				{/if}
			</div>
		</header>

		<!-- Funding stats -->
		<section
			class="flex flex-wrap gap-x-10 gap-y-3 md:shrink-0 md:text-right"
			aria-label="Bounty funding"
		>
			<div>
				<p
					class="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground md:justify-end"
				>
					<span>Asking</span>
					<Tooltip
						text="The amount the creator is requesting. This is a target — no funds are locked until someone pledges."
					>
						{#snippet children()}
							<InfoIcon class="h-3 w-3 text-muted-foreground/70" />
						{/snippet}
					</Tooltip>
				</p>
				<p class="text-lg font-semibold text-foreground">
					<SatAmount amount={detail.rewardAmount} />
				</p>
			</div>
			<div>
				<p
					class="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground md:justify-end"
				>
					<span>Funded</span>
					<Tooltip
						text="Actual ecash pledged by supporters, held in escrow until a solution is approved. Anyone can pledge — not just the creator."
					>
						{#snippet children()}
							<InfoIcon class="h-3 w-3 text-muted-foreground/70" />
						{/snippet}
					</Tooltip>
				</p>
				<p class="text-lg font-semibold text-foreground">
					<SatAmount amount={detail.totalPledged} />
				</p>
			</div>
			<div>
				<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Solutions</p>
				<p class="text-lg font-semibold text-foreground">{detail.solutionCount}</p>
			</div>
		</section>
	</div>

	<!-- Sticky release banner for pledgers who need to act -->
	{#if needsRelease}
		<div
			class="sticky top-0 z-30 -mx-4 pt-2 sm:-mx-0"
			role="alert"
			aria-label="Action required: release funds"
		>
			<button
				onclick={() => (releaseDialogOpen = true)}
				disabled={!connectivity.online}
				class="flex w-full items-center justify-between gap-3 border-b border-success/40 bg-success/90 px-4 py-3 text-left transition-colors hover:bg-success hover:cursor-pointer sm:rounded-lg sm:border"
			>
				<div class="min-w-0">
					<p class="text-sm font-semibold text-success-foreground">
						Action Required: Release Your Funds
					</p>
					<p class="text-xs text-success-foreground/80">
						You pledged {myPledgeTotal.toLocaleString()} sats — release them to the winning solver.
					</p>
				</div>
				<UnlockIcon class="size-4 shrink-0 text-success-foreground" />
			</button>
		</div>
	{/if}

	<!-- Retraction history -->
	{#if retractions.length > 0}
		<section
			class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2"
			aria-label="Retraction history"
		>
			<h2 class="text-sm font-semibold text-destructive">Retraction History</h2>
			<ul class="space-y-1">
				{#each retractions as retraction (retraction.id)}
					<li class="text-xs text-muted-foreground">
						<span class="font-medium"
							>{retraction.type === 'bounty' ? 'Bounty cancelled' : 'Pledge retracted'}</span
						>
						{#if retraction.reason}
							— {retraction.reason}
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Reclaim alert for expired bounties (prominent, persistent) -->
	<ReclaimAlert {detail} />

	<!-- Description — full width -->
	<section class="py-5" aria-label="Bounty description">
		<MarkdownViewer content={detail.description} />
	</section>

	<!-- Pledges + Solutions row — side by side on md+ -->
	<div class="grid grid-cols-1 gap-12 pt-5 md:grid-cols-2">
		<!-- Pledges section -->
		<ErrorBoundary>
			<section class="order-2 md:order-1 space-y-3" aria-label="Pledges">
				<div class="flex items-center justify-between">
					<h2 class="text-base font-semibold text-foreground">
						Pledges ({detail.pledges.length})
					</h2>
					<PledgeButton taskStatus={detail.status} onPledge={() => (pledgeFormOpen = true)} />
				</div>
				{#if (isReleasePhase || detail.payouts.length > 0) && uniquePledgers > 0}
					<div class="flex items-center gap-2 text-xs text-muted-foreground">
						<span
							>{releasedPledgers} of {uniquePledgers} pledger{uniquePledgers === 1 ? '' : 's'} released</span
						>
						<div class="h-1.5 flex-1 rounded-full bg-muted">
							<div
								class="h-full rounded-full bg-success transition-all"
								style="width: {uniquePledgers > 0
									? Math.round((releasedPledgers / uniquePledgers) * 100)
									: 0}%"
							></div>
						</div>
					</div>
				{/if}
				<PledgeList pledges={detail.pledges} payouts={detail.payouts} {isReleasePhase} />
				<PledgeForm
					{bountyAddress}
					creatorPubkey={detail.pubkey}
					mintUrl={detail.mintUrl}
					deadline={detail.deadline}
					bind:open={pledgeFormOpen}
				/>
			</section>
		</ErrorBoundary>

		<!-- Solutions section -->
		<ErrorBoundary>
			<section class="order-1 md:order-2 space-y-3" aria-label="Solutions">
				<h2 class="text-base font-semibold text-foreground">
					Solutions ({detail.solutions.length})
				</h2>

				<!-- Existing solutions with voting controls -->
				{#if detail.solutions.length === 0}
					<div class="py-4 text-center">
						<p class="text-sm text-muted-foreground">No solutions submitted yet.</p>
					</div>
				{:else}
					<ul class="space-y-3" aria-label="Solution list">
						{#each sortedSolutions as solution (solution.id)}
							{@const votes = detail.votesBySolution.get(solution.id) ?? []}
							{@const tally = tallyVotes(votes, pledgesByPubkey, detail.totalPledged)}
							{@const isWinner = winningSolution?.id === solution.id}
							<li
								class="py-3 border-b border-border last:border-b-0 space-y-2 {isWinner
									? 'bg-primary/5 -mx-3 px-3 rounded-md'
									: ''}"
							>
								<!-- Solution content -->
								<div class="flex items-center justify-between gap-2">
									<div class="flex items-center gap-2">
										{#if isWinner}
											<CrownIcon class="size-4 text-warning" aria-label="Winning solution" />
										{/if}
										<ProfileLink pubkey={solution.pubkey} />
									</div>
									<TimeAgo timestamp={solution.createdAt} />
								</div>

								<MarkdownViewer content={solution.description} />

								{#if solution.deliverableUrl}
									<div class="text-sm">
										<span class="text-muted-foreground">Deliverable: </span>
										<a
											href={solution.deliverableUrl}
											target="_blank"
											rel="noopener noreferrer"
											class="font-medium text-foreground underline underline-offset-2 hover:text-primary transition-colors hover:cursor-pointer focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
										>
											{solution.deliverableUrl}
										</a>
									</div>
								{/if}

								<!-- Vote progress bar -->
								{#if votes.length > 0}
									<div class="border-t border-border pt-2">
										<VoteProgress {tally} />
									</div>
								{/if}

								<!-- Vote buttons (only when bounty is in_review or open) -->
								{#if detail.status === 'in_review' || detail.status === 'open'}
									<div class="border-t border-border pt-2">
										<VoteButton
											{bountyAddress}
											{solution}
											pledges={detail.pledges}
											existingVotes={votes}
										/>
									</div>
								{/if}

								<!-- Consensus message -->
								{#if tally.isApproved}
									<div class="mt-2 text-center">
										<p class="text-sm font-medium text-primary">
											{#if isReleasePhase}
												Solution approved! Pledgers are releasing funds to the solver.
											{:else if detail.payouts.length > 0}
												Solution approved! Funds have been released.
											{:else}
												Solution approved! Awaiting fund releases from pledgers.
											{/if}
										</p>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}

				<!-- Solution submission form -->
				<SolutionForm
					{bountyAddress}
					creatorPubkey={detail.pubkey}
					taskStatus={detail.status}
					requiredFee={detail.submissionFee}
				/>
			</section>
		</ErrorBoundary>
	</div>

	<!-- Payout / Release section — full width -->
	<ErrorBoundary>
		<!-- Release trigger for pledgers when consensus reached or releasing -->
		{#if winningSolution && (isReleasePhase || detail.payouts.length > 0)}
			<section class="space-y-3" aria-label="Payout">
				<PayoutTrigger
					{bountyAddress}
					{winningSolution}
					pledges={detail.pledges}
					payouts={detail.payouts}
					bind:open={releaseDialogOpen}
				/>
				<SolverClaim payouts={detail.payouts} pledges={detail.pledges} />
			</section>
		{/if}
	</ErrorBoundary>
</article>
