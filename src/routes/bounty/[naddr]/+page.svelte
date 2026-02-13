<script lang="ts">
	import { config } from '$lib/config';
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
		{store.bounty ? store.bounty.title : 'Loading Bounty...'} - {config.app.nameCaps}
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
		<div class="rounded-lg border border-border bg-card p-8 text-center space-y-3">
			<p class="text-base font-medium text-foreground">Bounty not found</p>
			<p class="text-sm text-muted-foreground">
				This could happen if the bounty was deleted, the relay that stored it is offline, or the link is incorrect.
			</p>
			<div class="flex items-center justify-center gap-3 pt-2">
				<a
					href="/"
					class="inline-flex cursor-pointer items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
				>
					Browse Bounties
				</a>
				<button
					onclick={() => history.back()}
					class="cursor-pointer rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
				>
					Go Back
				</button>
			</div>
		</div>
	{/if}
</ErrorBoundary>
