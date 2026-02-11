<script lang="ts">
	import type { Solution, Vote } from '$lib/bounty/types';
	import { nip19 } from 'nostr-tools';
	import { formatNpub } from '$lib/utils/format';
	import Markdown from '$lib/components/shared/Markdown.svelte';
	import TimeAgo from '$lib/components/shared/TimeAgo.svelte';

	const { solution, votes = [] }: { solution: Solution; votes?: Vote[] } = $props();

	const solverNpub = $derived(nip19.npubEncode(solution.pubkey));

	const approveCount = $derived(votes.filter((v) => v.choice === 'approve').length);
	const rejectCount = $derived(votes.filter((v) => v.choice === 'reject').length);
</script>

<li class="rounded-lg border border-border bg-card p-4">
	<div class="space-y-3">
		<!-- Header: solver + time -->
		<div class="flex items-center justify-between gap-2">
			<a
				href="/profile/{solverNpub}"
				class="text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
				aria-label="Solver profile: {formatNpub(solverNpub)}"
			>
				{formatNpub(solverNpub)}
			</a>
			<TimeAgo timestamp={solution.createdAt} />
		</div>

		<!-- Description -->
		<Markdown content={solution.description} />

		<!-- Deliverable URL -->
		{#if solution.deliverableUrl}
			<div class="text-sm">
				<span class="text-muted-foreground">Deliverable: </span>
				<a
					href={solution.deliverableUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="font-medium text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
					aria-label="Deliverable link (opens in new tab)"
				>
					{solution.deliverableUrl}
				</a>
			</div>
		{/if}

		<!-- Vote summary (if votes exist) -->
		{#if votes.length > 0}
			<div class="flex items-center gap-3 border-t border-border pt-2 text-xs text-muted-foreground">
				<span class="text-success" aria-label="{approveCount} approvals">
					{approveCount} approve
				</span>
				<span class="text-destructive" aria-label="{rejectCount} rejections">
					{rejectCount} reject
				</span>
			</div>
		{/if}
	</div>
</li>
