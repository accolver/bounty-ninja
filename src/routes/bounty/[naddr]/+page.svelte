<script lang="ts">
	import { BountyDetailStore } from '$lib/stores/bounty-detail.svelte';
	import BountyDetailView from '$lib/components/bounty/BountyDetailView.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import ErrorBoundary from '$lib/components/shared/ErrorBoundary.svelte';

	const { data } = $props();

	const store = new BountyDetailStore();

	$effect(() => {
		store.load(data.bountyAddress, data.kind, data.pubkey, data.dTag);

		return () => {
			store.destroy();
		};
	});
</script>

<svelte:head>
	<title>
		{store.bounty ? store.bounty.title : 'Loading Bounty...'} - Bounty.ninja
	</title>
</svelte:head>

<ErrorBoundary>
	{#if store.loading && !store.bounty}
		<div class="flex items-center justify-center py-12">
			<LoadingSpinner size="lg" />
		</div>
	{:else if store.error}
		<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-8 text-center">
			<p class="text-sm text-destructive">{store.error}</p>
		</div>
	{:else if store.bounty}
		<BountyDetailView detail={store.bounty} />
	{:else}
		<div class="rounded-lg border border-border bg-card p-8 text-center">
			<p class="text-muted-foreground">Bounty not found.</p>
		</div>
	{/if}
</ErrorBoundary>
