<script lang="ts">
	import { untrack } from 'svelte';
	import { config } from '$lib/config';
	import { fade } from 'svelte/transition';
	import { BountyDetailStore } from '$lib/stores/bounty-detail.svelte';
	import BountyDetailView from '$lib/components/bounty/BountyDetailView.svelte';
	import LoadingLogo from '$lib/components/shared/LoadingLogo.svelte';
	import ErrorBoundary from '$lib/components/shared/ErrorBoundary.svelte';
	import { pageLoading } from '$lib/stores/page-loading.svelte';

	const { data } = $props();

	const store = new BountyDetailStore();

	// Full-page loading overlay: show for at least 1s, skip entirely if data resolves synchronously.
	let minTimeElapsed = $state(false);
	let needsOverlay = $state(false);

	$effect(() => {
		store.load(data.bountyAddress, data.kind, data.pubkey, data.dTag);

		// Check whether data resolved synchronously from cache.
		// Use untrack to avoid creating a reactive dependency on store state
		// (which would cause an infinite effect loop since load() writes to it).
		untrack(() => {
			if (!store.bounty && store.loading) {
				needsOverlay = true;
			}
		});

		return () => {
			store.destroy();
		};
	});

	if (!minTimeElapsed) {
		setTimeout(() => {
			minTimeElapsed = true;
		}, 1000);
	}

	const dataReady = $derived(!!store.bounty || store.error || !store.loading);
	const showOverlay = $derived(needsOverlay && (!dataReady || !minTimeElapsed));

	// Sync overlay state to layout so footer can be hidden during loading
	$effect(() => {
		pageLoading.active = showOverlay;
	});
</script>

<svelte:head>
	<title>
		{store.bounty ? store.bounty.title : 'Loading Bounty...'} - {config.app.nameCaps}
	</title>
</svelte:head>

<ErrorBoundary>
	<div class="relative">
		{#if showOverlay}
			<div out:fade={{ duration: 300 }} onoutroend={() => pageLoading.showNavLogo(1000)}>
				<LoadingLogo />
			</div>
		{/if}

		<div class:animate-fade-in={needsOverlay && !showOverlay}>
			{#if store.error}
				<div
					class="mx-auto max-w-5xl rounded-lg border border-destructive/50 bg-destructive/10 p-8 text-center"
				>
					<p class="text-sm text-destructive">{store.error}</p>
				</div>
			{:else if store.bounty}
				<BountyDetailView detail={store.bounty} />
			{:else if !store.loading}
				<div class="mx-auto max-w-5xl py-8 text-center space-y-3">
					<p class="text-base font-medium text-foreground">Bounty not found</p>
					<p class="text-sm text-muted-foreground">
						This could happen if the bounty was deleted, the relay that stored it is offline, or the
						link is incorrect.
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
		</div>
	</div></ErrorBoundary
>
