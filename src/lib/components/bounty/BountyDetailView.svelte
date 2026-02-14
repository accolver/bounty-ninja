<script lang="ts">
	import type { BountyDetail } from '$lib/bounty/types';
	import { tallyVotes } from '$lib/bounty/voting';
	import { BOUNTY_KIND } from '$lib/bounty/kinds';
	import { accountState } from '$lib/nostr/account.svelte';
	import { nip19 } from 'nostr-tools';
	import BountyStatusBadge from './BountyStatusBadge.svelte';
	import BountyTags from './BountyTags.svelte';
	import BountyTimer from './BountyTimer.svelte';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';
	import TimeAgo from '$lib/components/shared/TimeAgo.svelte';
	import Markdown from '$lib/components/shared/Markdown.svelte';
	import ErrorBoundary from '$lib/components/shared/ErrorBoundary.svelte';
	import PledgeList from '$lib/components/pledge/PledgeList.svelte';
	import PledgeButton from '$lib/components/pledge/PledgeButton.svelte';
	import PledgeForm from '$lib/components/pledge/PledgeForm.svelte';
	import ReclaimAlert from '$lib/components/pledge/ReclaimAlert.svelte';
	import SolutionList from '$lib/components/solution/SolutionList.svelte';
	import SolutionForm from '$lib/components/solution/SolutionForm.svelte';
	import VoteButton from '$lib/components/voting/VoteButton.svelte';
	import VoteProgress from '$lib/components/voting/VoteProgress.svelte';
	import VoteResults from '$lib/components/voting/VoteResults.svelte';
	import PayoutTrigger from '$lib/components/voting/PayoutTrigger.svelte';
	import SolverClaim from '$lib/components/voting/SolverClaim.svelte';
	import { formatNpub } from '$lib/utils/format';

	const { detail }: { detail: BountyDetail } = $props();

	const creatorNpub = $derived(nip19.npubEncode(detail.pubkey));

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
		if (detail.status === 'completed' && detail.payout) {
			return detail.solutions.find((s) => s.id === detail.payout?.solutionId);
		}
		// Check for consensus-approved solutions (pre-payout)
		for (const solution of detail.solutions) {
			const votes = detail.votesBySolution.get(solution.id) ?? [];
			const tally = tallyVotes(votes, pledgesByPubkey, detail.totalPledged);
			if (tally.isApproved) return solution;
		}
		return undefined;
	});

	let pledgeFormOpen = $state(false);
</script>

<article class="mx-auto max-w-3xl space-y-8">
	<!-- Header -->
	<header class="space-y-4">
		<div class="flex flex-wrap items-center gap-3">
			<BountyStatusBadge status={detail.status} />
			<BountyTimer deadline={detail.deadline} />
			<TimeAgo timestamp={detail.createdAt} />
		</div>

		<h1 class="text-2xl font-bold text-foreground">{detail.title}</h1>

		<div class="flex flex-wrap items-center gap-4 text-sm">
			<span class="text-muted-foreground">
				Posted by
				<a
					href="/profile/{creatorNpub}"
					class="font-medium text-primary transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
				>
					{formatNpub(creatorNpub)}
				</a>
			</span>
		</div>
	</header>

	<!-- Reclaim alert for expired bounties (prominent, persistent) -->
	<ReclaimAlert {detail} />

	<!-- Reward & Pledges summary -->
	<section
		class="flex flex-wrap gap-6 rounded-lg border border-border bg-card p-4"
		aria-label="Bounty funding"
	>
		<div class="space-y-1">
			<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reward</p>
			<SatAmount amount={detail.rewardAmount} />
		</div>
		<div class="space-y-1">
			<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
				Total Pledged
			</p>
			<SatAmount amount={detail.totalPledged} />
		</div>
		<div class="space-y-1">
			<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Solutions</p>
			<p class="font-medium text-foreground">{detail.solutionCount}</p>
		</div>
	</section>

	<!-- Description -->
	<section aria-label="Bounty description">
		<h2 class="mb-3 text-lg font-semibold text-foreground">Description</h2>
		<div class="rounded-lg border border-border bg-card p-4">
			<Markdown content={detail.description} />
		</div>
	</section>

	<!-- Tags -->
	{#if detail.tags.length > 0}
		<section aria-label="Tags">
			<h2 class="mb-3 text-lg font-semibold text-foreground">Tags</h2>
			<BountyTags tags={detail.tags} />
		</section>
	{/if}

	<!-- Pledges section with PledgeButton + PledgeForm -->
	<ErrorBoundary>
		<section aria-label="Pledges">
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-foreground">
					Pledges ({detail.pledges.length})
				</h2>
				<PledgeButton taskStatus={detail.status} onPledge={() => (pledgeFormOpen = true)} />
			</div>
			<PledgeList pledges={detail.pledges} />
			<PledgeForm
				{bountyAddress}
				creatorPubkey={detail.pubkey}
				mintUrl={detail.mintUrl}
				deadline={detail.deadline}
				bind:open={pledgeFormOpen}
			/>
		</section>
	</ErrorBoundary>

	<!-- Solutions section with SolutionForm + VoteButton per solution -->
	<ErrorBoundary>
		<section aria-label="Solutions">
			<h2 class="mb-3 text-lg font-semibold text-foreground">
				Solutions ({detail.solutions.length})
			</h2>

			<!-- Existing solutions with voting controls -->
			{#if detail.solutions.length === 0}
				<div class="rounded-lg border border-border bg-card p-6 text-center">
					<p class="text-sm text-muted-foreground">No solutions submitted yet.</p>
				</div>
			{:else}
				<ul class="space-y-4" aria-label="Solution list">
					{#each detail.solutions as solution (solution.id)}
						{@const votes = detail.votesBySolution.get(solution.id) ?? []}
						{@const tally = tallyVotes(votes, pledgesByPubkey, detail.totalPledged)}
						<li class="rounded-lg border border-border bg-card p-4 space-y-3">
							<!-- Solution content -->
							<div class="flex items-center justify-between gap-2">
								<a
									href="/profile/{nip19.npubEncode(solution.pubkey)}"
									class="text-sm font-medium text-primary transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
								>
									{formatNpub(nip19.npubEncode(solution.pubkey))}
								</a>
								<TimeAgo timestamp={solution.createdAt} />
							</div>

							<Markdown content={solution.description} />

							{#if solution.deliverableUrl}
								<div class="text-sm">
									<span class="text-muted-foreground">Deliverable: </span>
									<a
										href={solution.deliverableUrl}
										target="_blank"
										rel="noopener noreferrer"
										class="font-medium text-primary underline underline-offset-2 transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
									>
										{solution.deliverableUrl}
									</a>
								</div>
							{/if}

							<!-- Vote progress bar -->
							{#if votes.length > 0}
								<div class="border-t border-border pt-3">
									<VoteProgress {tally} />
								</div>
							{/if}

							<!-- Vote buttons (only when bounty is in_review) -->
							{#if detail.status === 'in_review' || detail.status === 'open'}
								<div class="border-t border-border pt-3">
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
								<div class="rounded-md border border-success/40 bg-success/10 p-2 text-center">
									<p class="text-sm font-medium text-success">
										Solution approved! Awaiting payout from bounty creator.
									</p>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}

			<!-- Solution submission form -->
			<div class="mt-4">
				<SolutionForm
					{bountyAddress}
					creatorPubkey={detail.pubkey}
					taskStatus={detail.status}
					requiredFee={detail.submissionFee}
				/>
			</div>
		</section>
	</ErrorBoundary>

	<!-- Payout section -->
	<ErrorBoundary>
		<!-- Payout trigger for creator when a solution has consensus -->
		{#if winningSolution && !detail.payout}
			<section aria-label="Payout">
				<h2 class="mb-3 text-lg font-semibold text-foreground">Payout</h2>
				{#if isCreator}
					<PayoutTrigger {bountyAddress} {winningSolution} pledges={detail.pledges} {isCreator} />
				{:else}
					<div class="rounded-lg border border-border bg-card p-4 text-center">
						<p class="text-sm text-muted-foreground">Awaiting payout from bounty creator.</p>
					</div>
				{/if}
			</section>
		{/if}

		<!-- Solver claim notification when payout exists -->
		{#if detail.payout}
			<section aria-label="Payout claim">
				<h2 class="mb-3 text-lg font-semibold text-foreground">Payout</h2>
				<SolverClaim payout={detail.payout} />
				<VoteResults {winningSolution} payout={detail.payout} />
			</section>
		{/if}
	</ErrorBoundary>

	<!-- Vote Results (if completed, no payout section already shown) -->
	{#if detail.status === 'completed' && !detail.payout}
		<section aria-label="Vote results">
			<h2 class="mb-3 text-lg font-semibold text-foreground">Results</h2>
			<VoteResults {winningSolution} payout={detail.payout ?? undefined} />
		</section>
	{/if}
</article>
