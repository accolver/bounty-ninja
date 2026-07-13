<script lang="ts">
	import BountyListItem from './BountyListItem.svelte';
	import type { FeaturedBountyGroups } from '$lib/bounty/featured';

	interface Props {
		groups: FeaturedBountyGroups;
	}

	const { groups }: Props = $props();

	const sections = $derived(
		[
			{
				title: 'Most funded',
				description: 'Bounties with the most sats pledged.',
				items: groups.mostFunded
			},
			{
				title: 'Ending soon',
				description: 'Active bounties with the nearest deadlines.',
				items: groups.endingSoon
			},
			{
				title: 'New',
				description: 'Freshly posted work to browse first.',
				items: groups.newest
			},
			{
				title: 'Needs solutions',
				description: 'Open bounties waiting for their first submission.',
				items: groups.needsSolutions
			}
		].filter((section) => section.items.length > 0)
	);
</script>

{#if sections.length > 0}
	<section class="space-y-4 border-b border-border px-4 pb-6" aria-labelledby="featured-bounties">
		<div class="space-y-1">
			<p class="text-xs font-medium uppercase tracking-wide text-primary">Start here</p>
			<h2 id="featured-bounties" class="text-lg font-semibold text-foreground">
				Featured bounties
			</h2>
			<p class="text-sm text-muted-foreground">
				Browse funded, urgent, new, and underserved bounties derived from relay data.
			</p>
		</div>

		<div class="grid gap-6 xl:grid-cols-2">
			{#each sections as section (section.title)}
				<div class="space-y-2">
					<div>
						<h3 class="text-sm font-medium text-foreground">{section.title}</h3>
						<p class="text-xs text-muted-foreground">{section.description}</p>
					</div>
					<div class="overflow-hidden rounded-lg border border-border">
						{#each section.items as bounty (bounty.id)}
							<BountyListItem {bounty} />
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</section>
{/if}
