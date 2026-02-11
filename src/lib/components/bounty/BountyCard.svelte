<script lang="ts">
	import type { BountySummary } from '$lib/bounty/types';
	import { BOUNTY_KIND } from '$lib/bounty/kinds';
	import { nip19 } from 'nostr-tools';
	import BountyStatusBadge from './BountyStatusBadge.svelte';
	import BountyTags from './BountyTags.svelte';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';
	import TimeAgo from '$lib/components/shared/TimeAgo.svelte';

	const { bounty }: { bounty: BountySummary } = $props();

	const naddr = $derived(
		nip19.naddrEncode({
			identifier: bounty.dTag,
			pubkey: bounty.pubkey,
			kind: BOUNTY_KIND
		})
	);
</script>

<a
	href="/bounty/{naddr}"
	class="group block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-card/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
	aria-label="Bounty: {bounty.title}"
>
	<!-- Mobile: stacked vertical layout -->
	<div class="flex flex-col gap-3 sm:hidden">
		<!-- Title + Status -->
		<div class="flex items-start justify-between gap-2">
			<h3 class="line-clamp-2 text-sm font-semibold text-card-foreground group-hover:text-primary">
				{bounty.title}
			</h3>
			<BountyStatusBadge status={bounty.status} />
		</div>

		<!-- Tags -->
		<BountyTags tags={bounty.tags} />

		<!-- Reward + Time -->
		<div class="flex flex-wrap items-center gap-3 text-xs">
			<SatAmount amount={bounty.rewardAmount} />

			{#if bounty.totalPledged > 0}
				<span class="text-muted-foreground" aria-label="{bounty.totalPledged} sats pledged">
					+<SatAmount amount={bounty.totalPledged} /> pledged
				</span>
			{/if}

			<span class="ml-auto">
				<TimeAgo timestamp={bounty.createdAt} />
			</span>
		</div>
	</div>

	<!-- Desktop (sm+): horizontal layout with extra metadata -->
	<div class="hidden sm:flex sm:items-center sm:gap-4">
		<!-- Left: title, tags, status -->
		<div class="min-w-0 flex-1 space-y-2">
			<div class="flex items-start justify-between gap-2">
				<h3
					class="line-clamp-1 text-sm font-semibold text-card-foreground group-hover:text-primary"
				>
					{bounty.title}
				</h3>
				<BountyStatusBadge status={bounty.status} />
			</div>
			<BountyTags tags={bounty.tags} />
		</div>

		<!-- Right: metadata -->
		<div class="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
			<span aria-label="{bounty.solutionCount} solutions">
				{bounty.solutionCount}
				{bounty.solutionCount === 1 ? 'solution' : 'solutions'}
			</span>

			{#if bounty.totalPledged > 0}
				<span aria-label="{bounty.totalPledged} sats pledged">
					+<SatAmount amount={bounty.totalPledged} />
				</span>
			{/if}

			<SatAmount amount={bounty.rewardAmount} />

			<TimeAgo timestamp={bounty.createdAt} />
		</div>
	</div>
</a>
