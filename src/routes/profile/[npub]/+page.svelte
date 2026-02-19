<script lang="ts">
	import { config } from '$lib/config';
	import type { Subscription } from 'rxjs';
	import type { NostrEvent } from 'nostr-tools';
	import { nip19 } from 'nostr-tools';
	import { eventStore } from '$lib/nostr/event-store';
	import { BOUNTY_KIND } from '$lib/bounty/kinds';
	import { parseBountySummary } from '$lib/bounty/helpers';
	import { createProfileLoader } from '$lib/nostr/loaders/profile-loader';
	import { createBountyByAuthorLoader } from '$lib/nostr/loaders/bounty-loader';
	import type { BountySummary } from '$lib/bounty/types';
	import { fade } from 'svelte/transition';
	import BountyCard from '$lib/components/bounty/BountyCard.svelte';
	import LoadingLogo from '$lib/components/shared/LoadingLogo.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import ErrorBoundary from '$lib/components/shared/ErrorBoundary.svelte';
	import ProfileAvatar from '$lib/components/auth/ProfileAvatar.svelte';
	import { formatNpub } from '$lib/utils/format';
	import { accountState } from '$lib/nostr/account.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import Plus from '@lucide/svelte/icons/plus';
	import CredibilityBadge from '$lib/components/reputation/CredibilityBadge.svelte';
	import { reputationStore } from '$lib/stores/reputation.svelte';

	const { data } = $props();

	const npub = $derived(nip19.npubEncode(data.pubkey));

	let profile = $state<Record<string, string> | null>(null);
	let bounties = $state<BountySummary[]>([]);
	let loading = $state(true);

	// Track whether the loading logo was actually shown.
	// If EventStore already had cached data, subscriptions resolve synchronously
	// and we skip the fade-in on subsequent navigations.
	let showedLoading = $state(false);

	$effect(() => {
		const subs: Array<Subscription | { unsubscribe(): void }> = [];

		// Subscribe to profile metadata from EventStore
		const profileSub = eventStore
			.replaceable(0, data.pubkey)
			.subscribe((event: NostrEvent | undefined) => {
				if (event) {
					try {
						profile = JSON.parse(event.content);
					} catch {
						profile = null;
					}
					// Only stop loading when we have actual data
					loading = false;
				}
			});
		subs.push(profileSub);

		// Subscribe to bounties by this author from EventStore
		const bountySub = eventStore
			.timeline({ kinds: [BOUNTY_KIND], authors: [data.pubkey] })
			.subscribe((events: NostrEvent[]) => {
				bounties = events.map(parseBountySummary).filter((s): s is BountySummary => s !== null);
				// Only stop loading when we have actual data
				if (events.length > 0) {
					loading = false;
				}
			});
		subs.push(bountySub);

		// Start relay loaders
		subs.push(createProfileLoader([data.pubkey]));
		subs.push(createBountyByAuthorLoader(data.pubkey));

		// If data didn't resolve synchronously from cache, we're showing the loading logo
		if (loading && bounties.length === 0) {
			showedLoading = true;
		}

		// Safety timeout: stop loading after 8s if no data arrives
		const timer = setTimeout(() => {
			loading = false;
		}, 8000);

		return () => {
			clearTimeout(timer);
			for (const sub of subs) {
				sub.unsubscribe();
			}
		};
	});

	const fadeDuration = $derived(showedLoading ? 500 : 0);
	const displayName = $derived(profile?.name || profile?.display_name || formatNpub(npub));
	const about = $derived(profile?.about || '');
	const isOwnProfile = $derived(accountState.pubkey === data.pubkey);
	const reputation = $derived(reputationStore.getReputation(data.pubkey));
</script>

<svelte:head>
	<title>{displayName} - {config.app.nameCaps}</title>
</svelte:head>

<ErrorBoundary>
	<section class="mx-auto max-w-3xl space-y-8">
		<!-- Profile header -->
		<header class="flex items-center gap-4">
			<ProfileAvatar pubkey={data.pubkey} size="xl" />
			<div>
				<h1 class="text-xl font-bold text-foreground">{displayName}</h1>
				<p class="text-xs font-mono text-muted-foreground">{formatNpub(npub)}</p>
			</div>
		</header>

		{#if about}
			<p class="text-sm text-muted-foreground">{about}</p>
		{/if}

		<!-- Reputation section -->
		{#if reputation}
			<section class="border-t border-border pt-5 space-y-4" aria-label="Reputation">
				<div class="flex items-center gap-2">
					<h2 class="text-lg font-semibold text-foreground">Reputation</h2>
					<CredibilityBadge pubkey={data.pubkey} size="md" />
				</div>
				<div class="flex gap-x-8 gap-y-4 flex-wrap">
					<div>
						<p class="text-xs uppercase text-muted-foreground">Bounties Completed</p>
						<p class="text-lg font-semibold text-foreground">{reputation.bountiesCompleted}</p>
					</div>
					<div>
						<p class="text-xs uppercase text-muted-foreground">Solutions Accepted</p>
						<p class="text-lg font-semibold text-foreground">{reputation.solutionsAccepted}</p>
					</div>
					<div>
						<p class="text-xs uppercase text-muted-foreground">Pledges Released</p>
						<p class="text-lg font-semibold text-foreground">
							{reputation.pledgesReleased}/{reputation.totalPledges}
						</p>
					</div>
					{#if reputation.totalPledges > 0}
						<div>
							<p class="text-xs uppercase text-muted-foreground">Release Rate</p>
							<p class="text-lg font-semibold text-foreground">
								{Math.round(reputation.releaseRate * 100)}%
							</p>
						</div>
					{/if}
					{#if reputation.bountyRetractions > 0 || reputation.pledgeRetractions > 0}
						<div>
							<p class="text-xs uppercase text-destructive/70">Retractions</p>
							<p class="text-lg font-semibold text-destructive/70">
								{reputation.bountyRetractions + reputation.pledgeRetractions}
							</p>
						</div>
					{/if}
				</div>
			</section>
		{/if}

		<!-- Bounties by this author -->
		<section>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-foreground">
					{isOwnProfile ? 'My Bounties' : 'Bounties'} ({bounties.length})
				</h2>
				{#if isOwnProfile}
					<a href="/bounty/new">
						<Button variant="default" size="sm" class="gap-1.5">
							<Plus class="size-4" />
							Create Bounty
						</Button>
					</a>
				{/if}
			</div>

			<div class="grid [&>*]:col-start-1 [&>*]:row-start-1">
				{#if loading && bounties.length === 0}
					<div out:fade={{ duration: 300 }}>
						<LoadingLogo />
					</div>
				{:else if bounties.length === 0}
					<div in:fade={{ duration: fadeDuration }}>
						<EmptyState
							message={isOwnProfile
								? "You haven't posted any bounties yet."
								: "This user hasn't posted any bounties yet."}
							hint={isOwnProfile
								? 'Post your first bounty to get started — describe what you need built and set a reward.'
								: undefined}
							action={isOwnProfile
								? { label: 'Create Your First Bounty', href: '/bounty/new' }
								: undefined}
						/>
					</div>
				{:else}
					<div in:fade={{ duration: fadeDuration }} class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{#each bounties as bounty (bounty.id)}
							<BountyCard {bounty} />
						{/each}
					</div>
				{/if}
			</div>
		</section>
	</section>
</ErrorBoundary>
