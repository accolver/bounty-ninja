<script lang="ts">
	import type { BountySummary } from '$lib/bounty/types';
	import { BOUNTY_KIND } from '$lib/bounty/kinds';
	import { nip19 } from 'nostr-tools';
	import BountyStatusBadge from './BountyStatusBadge.svelte';
	import SatAmount from '$lib/components/shared/SatAmount.svelte';
	import TimeAgo from '$lib/components/shared/TimeAgo.svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

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
	class="group flex items-center gap-4 border-b border-border/50 px-4 py-5
		transition-colors hover:bg-card/60
		focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
	aria-label="Bounty: {bounty.title}"
>
	<!-- Title + metadata -->
	<div class="min-w-0 flex-1">
		<h3 class="truncate text-base font-semibold text-foreground group-hover:text-primary transition-colors">
			{bounty.title}
		</h3>
		<p class="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
			{#if bounty.totalPledged > 0}
				<span class="text-base font-semibold">
					<SatAmount amount={bounty.totalPledged} />
				</span>
				<span aria-hidden="true">&middot;</span>
			{/if}
			{#if bounty.solutionCount > 0}
				<span>
					{bounty.solutionCount} {bounty.solutionCount === 1 ? 'solution' : 'solutions'}
				</span>
				<span aria-hidden="true">&middot;</span>
			{/if}
			<TimeAgo timestamp={bounty.createdAt} />
		</p>
	</div>

	<!-- Status badge + chevron -->
	<div class="flex shrink-0 items-center gap-3">
		<BountyStatusBadge status={bounty.status} />
		<ChevronRight class="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
	</div>
</a>
