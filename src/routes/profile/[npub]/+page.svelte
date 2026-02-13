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
	import BountyCard from '$lib/components/bounty/BountyCard.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import ErrorBoundary from '$lib/components/shared/ErrorBoundary.svelte';
	import ProfileAvatar from '$lib/components/auth/ProfileAvatar.svelte';
	import { formatNpub } from '$lib/utils/format';
	import { accountState } from '$lib/nostr/account.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import Plus from '@lucide/svelte/icons/plus';

	const { data } = $props();

	const npub = $derived(nip19.npubEncode(data.pubkey));

	let profile = $state<Record<string, string> | null>(null);
	let bounties = $state<BountySummary[]>([]);
	let loading = $state(true);

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
				}
				loading = false;
			});
		subs.push(profileSub);

		// Subscribe to bounties by this author from EventStore
		const bountySub = eventStore
			.timeline({ kinds: [BOUNTY_KIND], authors: [data.pubkey] })
			.subscribe((events: NostrEvent[]) => {
				bounties = events.map(parseBountySummary).filter((s): s is BountySummary => s !== null);
				loading = false;
			});
		subs.push(bountySub);

		// Start relay loaders
		subs.push(createProfileLoader([data.pubkey]));
		subs.push(createBountyByAuthorLoader(data.pubkey));

		// Timeout fallback
		const timer = setTimeout(() => {
			loading = false;
		}, 5000);

		return () => {
			clearTimeout(timer);
			for (const sub of subs) {
				sub.unsubscribe();
			}
		};
	});

	const displayName = $derived(profile?.name || profile?.display_name || formatNpub(npub));
	const about = $derived(profile?.about || '');
	const isOwnProfile = $derived(accountState.pubkey === data.pubkey);
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

			{#if loading && bounties.length === 0}
				<div class="flex items-center justify-center py-12">
					<LoadingSpinner size="md" />
				</div>
			{:else if bounties.length === 0}
				<EmptyState
					message={isOwnProfile ? "You haven't posted any bounties yet." : "This user hasn't posted any bounties yet."}
					hint={isOwnProfile ? "Post your first bounty to get started — describe what you need built and set a reward." : undefined}
					action={isOwnProfile ? { label: 'Create Your First Bounty', href: '/bounty/new' } : undefined}
				/>
			{:else}
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					{#each bounties as bounty (bounty.id)}
						<BountyCard {bounty} />
					{/each}
				</div>
			{/if}
		</section>
	</section>
</ErrorBoundary>
