<script lang="ts">
	import { config } from '$lib/config';
	import { fade } from 'svelte/transition';
	import { BountyDetailStore } from '$lib/stores/bounty-detail.svelte';
	import BountyDetailView from '$lib/components/bounty/BountyDetailView.svelte';
	import LoadingLogo from '$lib/components/shared/LoadingLogo.svelte';
	import ErrorBoundary from '$lib/components/shared/ErrorBoundary.svelte';

	const { data } = $props();

	const store = new BountyDetailStore();

	// Track whether the loading logo was actually shown.
	// If EventStore already had cached data, load() resolves synchronously
	// and we skip the fade-in on subsequent navigations.
	let showedLoading = $state(false);

	// Load bounty data — must NOT read store.bounty/store.loading here
	// to avoid a reactive cycle (load writes those, re-triggering the effect).
	$effect(() => {
		store.load(data.bountyAddress, data.kind, data.pubkey, data.dTag);

		return () => {
			store.destroy();
		};
	});

	// Separate effect to detect if loading state was visible to the user.
	// Reads store.bounty/store.loading reactively without calling store.load().
	$effect(() => {
		if (!store.bounty && store.loading) {
			showedLoading = true;
		}
	});

	const fadeDuration = $derived(showedLoading ? 500 : 0);
</script>

<svelte:head>
	<title>
		{store.bounty ? store.bounty.title : 'Loading Bounty...'} - {config.app.nameCaps}
	</title>
</svelte:head>

<ErrorBoundary>
	<div class="grid [&>*]:col-start-1 [&>*]:row-start-1">
		{#if store.loading && !store.bounty}
			<div out:fade={{ duration: 300 }}>
				<LoadingLogo />
			</div>
		{:else if store.error}
			<div
				in:fade={{ duration: fadeDuration }}
				class="mx-auto max-w-5xl rounded-lg border border-destructive/50 bg-destructive/10 p-8 text-center"
			>
				<p class="text-sm text-destructive">{store.error}</p>
			</div>
		{:else if store.bounty}
			<div in:fade={{ duration: fadeDuration }}>
				<BountyDetailView detail={store.bounty} />
			</div>
		{:else}
			<div
				in:fade={{ duration: fadeDuration }}
				class="mx-auto max-w-5xl py-8 text-center space-y-3"
			>
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
</ErrorBoundary>
