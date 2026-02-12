<script lang="ts">
	import type { BountySummary } from '$lib/bounty/types';
	import { BOUNTY_KIND } from '$lib/bounty/kinds';
	import { nip19 } from 'nostr-tools';
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

	/** Show at most 3 tags, indicate overflow */
	const visibleTags = $derived(bounty.tags.slice(0, 3));
	const overflowCount = $derived(Math.max(0, bounty.tags.length - 3));
</script>

<a
	href="/bounty/{naddr}"
	class="group flex flex-col rounded-xl border border-border bg-card transition-all duration-200
		hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5
		focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
	aria-label="Bounty: {bounty.title}"
>
	<!-- Header: Time -->
	<div class="flex items-center justify-end px-4 pt-4 pb-2">
		<TimeAgo timestamp={bounty.createdAt} />
	</div>

	<!-- Title -->
	<div class="px-4 pb-3">
		<h3
			class="line-clamp-2 text-base font-semibold leading-snug text-card-foreground group-hover:text-primary transition-colors"
		>
			{bounty.title}
		</h3>
	</div>

	<!-- Tags -->
	{#if visibleTags.length > 0}
		<div class="flex flex-wrap gap-1.5 px-4 pb-3" aria-label="Bounty tags">
			{#each visibleTags as tag (tag)}
				<span class="rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
					{tag}
				</span>
			{/each}
			{#if overflowCount > 0}
				<span class="rounded-md bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground/70">
					+{overflowCount}
				</span>
			{/if}
		</div>
	{/if}

	<!-- Spacer to push footer down -->
	<div class="flex-1"></div>

	<!-- Funding bar + Reward -->
	<div class="mt-auto border-t border-border/50 px-4 pt-3 pb-4">
		<!-- Pledged amount -->
		<div class="flex items-baseline gap-2">
			<span class="text-lg font-bold">
				<SatAmount amount={bounty.totalPledged} />
			</span>
			<span class="text-xs text-muted-foreground">pledged</span>
		</div>

		<!-- Solutions count -->
		{#if bounty.solutionCount > 0}
			<div class="mt-2 text-xs text-muted-foreground">
				{bounty.solutionCount}
				{bounty.solutionCount === 1 ? 'solution' : 'solutions'} submitted
			</div>
		{/if}
	</div>
</a>
