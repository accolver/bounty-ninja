<script lang="ts">
	import { bountyList } from '$lib/stores/bounties.svelte';
	import SearchBar from '$lib/components/search/SearchBar.svelte';
	import BountyCard from '$lib/components/bounty/BountyCard.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import ErrorBoundary from '$lib/components/shared/ErrorBoundary.svelte';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import type { BountySummary } from '$lib/bounty/types';

	let selectedTag = $state('');

	const commonTabs = ['development', 'design', 'documentation', 'writing'] as const;

	const filteredBounties = $derived(
		selectedTag
			? bountyList.popular.filter((b: BountySummary) => b.tags.includes(selectedTag))
			: bountyList.popular
	);
</script>

<svelte:head>
	<title>Tasks.fyi - Decentralized Bounty Board</title>
</svelte:head>

<ErrorBoundary>
	<div class="flex gap-8">
		<Sidebar bind:selectedTag />

		<section class="min-w-0 flex-1 space-y-6">
			<!-- Hero Search -->
			<div class="py-4 text-center">
				<h1 class="mb-4 text-2xl font-bold text-foreground">Bounties</h1>
				<SearchBar variant="hero" />
			</div>

			<!-- Category tabs -->
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors
					{selectedTag === ''
						? 'bg-primary text-primary-foreground'
						: 'border border-border text-muted-foreground hover:text-foreground'}"
					onclick={() => (selectedTag = '')}
				>
					All
				</button>
				{#each commonTabs as tab}
					<button
						type="button"
						class="rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors
						{selectedTag === tab
							? 'bg-primary text-primary-foreground'
							: 'border border-border text-muted-foreground hover:text-foreground'}"
						onclick={() => (selectedTag = tab)}
					>
						{tab}
					</button>
				{/each}
			</div>

			<!-- Bounty list -->
			{#if bountyList.loading && bountyList.items.length === 0}
				<div class="flex items-center justify-center py-12">
					<LoadingSpinner size="lg" />
				</div>
			{:else if bountyList.error}
				<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-8 text-center">
					<p class="text-sm text-destructive">{bountyList.error}</p>
				</div>
			{:else if filteredBounties.length === 0}
				<EmptyState
					message={selectedTag
						? `No bounties found for "${selectedTag}". Try a different category.`
						: 'No bounties found. Be the first to post one!'}
				/>
			{:else}
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each filteredBounties as bounty (bounty.id)}
						<BountyCard {bounty} />
					{/each}
				</div>
			{/if}
		</section>
	</div>
</ErrorBoundary>
