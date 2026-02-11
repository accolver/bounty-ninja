<script lang="ts">
	import { searchStore } from '$lib/stores/search.svelte';
	import BountyCard from '$lib/components/bounty/BountyCard.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import type { BountySummary } from '$lib/bounty/types';

	let statusFilter = $state<'all' | 'open' | 'completed'>('all');
	let minReward = $state(0);

	const filteredResults = $derived(
		searchStore.results.filter((b: BountySummary) => {
			if (statusFilter !== 'all' && b.status !== statusFilter) return false;
			if (b.rewardAmount < minReward) return false;
			return true;
		})
	);
</script>

<div class="space-y-4">
	<!-- Filters -->
	<div class="flex flex-wrap items-center gap-3">
		<div class="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
			{#each ['all', 'open', 'completed'] as status}
				<button
					type="button"
					class="rounded-md px-3 py-1 text-xs font-medium transition-colors
						{statusFilter === status
						? 'bg-primary text-primary-foreground'
						: 'text-muted-foreground hover:text-foreground'}"
					onclick={() => (statusFilter = status as 'all' | 'open' | 'completed')}
				>
					{status.charAt(0).toUpperCase() + status.slice(1)}
				</button>
			{/each}
		</div>
		<span class="text-xs text-muted-foreground">
			{filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}
		</span>
	</div>

	<!-- Results -->
	{#if searchStore.loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array(3) as _}
				<div class="h-40 animate-pulse rounded-lg border border-border bg-card"></div>
			{/each}
		</div>
	{:else if searchStore.error}
		<div class="rounded-lg border border-warning/50 bg-warning/10 p-4 text-center" role="alert">
			<p class="text-sm text-warning">{searchStore.error}</p>
		</div>
	{:else if filteredResults.length === 0}
		<EmptyState message={`No bounties found for "${searchStore.query}"`} />
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each filteredResults as bounty (bounty.id)}
				<BountyCard {bounty} />
			{/each}
		</div>
	{/if}
</div>
