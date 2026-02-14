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
	import Tooltip from '$lib/components/shared/Tooltip.svelte';
	import ErrorBoundary from '$lib/components/shared/ErrorBoundary.svelte';
	import InfoIcon from '@lucide/svelte/icons/info';
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

	let pledgeFormOpen = $state(false);
</script>

<article class="mx-auto max-w-5xl space-y-6">
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
					class="font-medium text-primary transition-colors hover:underline hover:cursor-pointer focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
				>
					{formatNpub(creatorNpub)}
				</a>
			</span>
		</div>
	</header>

	<!-- Reclaim alert for expired bounties (prominent, persistent) -->
	<ReclaimAlert {detail} />

	<!-- Main content row: Description (2 cols) + Sidebar (1 col) -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Description — takes 2 cols on desktop -->
		<section aria-label="Bounty description" class="lg:col-span-2">
			<div class="space-y-4 rounded-lg border border-border bg-card p-5">
				<h2 class="text-lg font-semibold text-foreground">Description</h2>
				<Markdown content={detail.description} />
			</div>
		</section>

		<!-- Sidebar: Funding + Tags -->
		<div class="space-y-6">
			<!-- Reward & Pledges summary -->
			<section
				class="space-y-4 rounded-lg border border-border bg-card p-5"
				aria-label="Bounty funding"
			>
				<h2 class="text-lg font-semibold text-foreground">Funding</h2>
				<div class="grid grid-cols-2 gap-3 lg:grid-cols-1">
					<div class="rounded-md border border-border bg-background p-3">
						<p
							class="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
						<SatAmount amount={detail.rewardAmount} />
					</div>
					<div class="rounded-md border border-border bg-background p-3">
						<p
							class="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
						<SatAmount amount={detail.totalPledged} />
					</div>
					<div class="rounded-md border border-border bg-background p-3">
						<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Solutions
						</p>
						<p class="font-medium text-foreground">{detail.solutionCount}</p>
					</div>
				</div>
			</section>

			<!-- Tags -->
			{#if detail.tags.length > 0}
				<section class="space-y-3 rounded-lg border border-border bg-card p-5" aria-label="Tags">
					<h2 class="text-lg font-semibold text-foreground">Tags</h2>
					<BountyTags tags={detail.tags} />
				</section>
			{/if}
		</div>
	</div>

	<!-- Pledges + Solutions row — side by side on md+ -->
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
		<!-- Pledges section -->
		<ErrorBoundary>
			<section class="space-y-4 rounded-lg border border-border bg-card p-5" aria-label="Pledges">
				<div class="flex items-center justify-between">
					<h2 class="text-lg font-semibold text-foreground">
						Pledges ({detail.pledges.length})
					</h2>
					<PledgeButton taskStatus={detail.status} onPledge={() => (pledgeFormOpen = true)} />
				</div>
				<PledgeList pledges={detail.pledges} payouts={detail.payouts} />
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
			<section class="space-y-4 rounded-lg border border-border bg-card p-5" aria-label="Solutions">
				<h2 class="text-lg font-semibold text-foreground">
					Solutions ({detail.solutions.length})
				</h2>

				<!-- Existing solutions with voting controls -->
				{#if detail.solutions.length === 0}
					<div class="rounded-md border border-border bg-background p-6 text-center">
						<p class="text-sm text-muted-foreground">No solutions submitted yet.</p>
					</div>
				{:else}
					<ul class="space-y-4" aria-label="Solution list">
						{#each detail.solutions as solution (solution.id)}
							{@const votes = detail.votesBySolution.get(solution.id) ?? []}
							{@const tally = tallyVotes(votes, pledgesByPubkey, detail.totalPledged)}
							<li class="rounded-md border border-border bg-background p-4 space-y-3">
								<!-- Solution content -->
								<div class="flex items-center justify-between gap-2">
									<a
										href="/profile/{nip19.npubEncode(solution.pubkey)}"
										class="text-sm font-medium text-primary transition-colors hover:underline hover:cursor-pointer focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
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
											class="font-medium text-primary underline underline-offset-2 transition-colors hover:text-primary/80 hover:cursor-pointer focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
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

								<!-- Vote buttons (only when bounty is in_review or open) -->
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
				<div class="border-t border-border pt-4">
					<SolutionForm
						{bountyAddress}
						creatorPubkey={detail.pubkey}
						taskStatus={detail.status}
						requiredFee={detail.submissionFee}
					/>
				</div>
			</section>
		</ErrorBoundary>
	</div>

	<!-- Payout / Release section — full width -->
	<ErrorBoundary>
		<!-- Release trigger for pledgers when consensus reached or releasing -->
		{#if winningSolution && (isReleasePhase || detail.payouts.length > 0)}
			<section class="space-y-4 rounded-lg border border-border bg-card p-5" aria-label="Payout">
				<h2 class="text-lg font-semibold text-foreground">Payout</h2>
				<div class="space-y-3">
					<PayoutTrigger
						{bountyAddress}
						{winningSolution}
						pledges={detail.pledges}
						payouts={detail.payouts}
					/>
					<SolverClaim payouts={detail.payouts} pledges={detail.pledges} />
					<VoteResults {winningSolution} payouts={detail.payouts} pledges={detail.pledges} />
				</div>
			</section>
		{/if}

		<!-- Completed bounty with no release phase visible (e.g. loaded after completion) -->
		{#if detail.status === 'completed' && detail.payouts.length > 0 && !isReleasePhase && !winningSolution}
			<section
				class="space-y-4 rounded-lg border border-border bg-card p-5"
				aria-label="Vote results"
			>
				<h2 class="text-lg font-semibold text-foreground">Results</h2>
				<VoteResults payouts={detail.payouts} pledges={detail.pledges} />
			</section>
		{/if}
	</ErrorBoundary>
</article>
