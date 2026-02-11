import type { Subscription } from 'rxjs';
import { combineLatest } from 'rxjs';
import type { NostrEvent } from 'nostr-tools';
import type { BountyDetail } from '$lib/bounty/types';
import { eventStore } from '$lib/nostr/event-store';
import { parseBountyDetail } from '$lib/bounty/helpers';
import { PLEDGE_KIND, SOLUTION_KIND, VOTE_KIND, PAYOUT_KIND } from '$lib/bounty/kinds';
import { pool } from '$lib/nostr/relay-pool';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import { getDefaultRelays } from '$lib/utils/env';
import { createPledgeLoader } from '$lib/nostr/loaders/pledge-loader';
import { createSolutionLoader } from '$lib/nostr/loaders/solution-loader';
import { createVoteLoader } from '$lib/nostr/loaders/vote-loader';
import { createProfileLoader } from '$lib/nostr/loaders/profile-loader';

/**
 * Reactive store for a single bounty's full detail.
 * Subscribes to multiple EventStore timelines and composes them
 * into a single BountyDetail object.
 */
export class BountyDetailStore {
	#bounty = $state<BountyDetail | null>(null);
	#loading = $state(true);
	#error = $state<string | null>(null);
	#combinedSub: Subscription | null = null;
	#relaySubs: Array<{ unsubscribe(): void }> = [];

	/** The full bounty detail, or null if not loaded */
	get bounty(): BountyDetail | null {
		return this.#bounty;
	}

	/** Whether the initial load is still in progress */
	get loading(): boolean {
		return this.#loading;
	}

	/** Error message if loading failed */
	get error(): string | null {
		return this.#error;
	}

	/**
	 * Load a bounty and all related events.
	 * Cleans up any previous subscriptions first.
	 */
	load(bountyAddress: string, kind: number, pubkey: string, dTag: string) {
		this.destroy();
		this.#loading = true;
		this.#error = null;

		// Subscribe to EventStore timelines for all related event kinds
		const bounty$ = eventStore.replaceable(kind, pubkey, dTag);
		const pledges$ = eventStore.timeline({ kinds: [PLEDGE_KIND], '#a': [bountyAddress] });
		const solutions$ = eventStore.timeline({ kinds: [SOLUTION_KIND], '#a': [bountyAddress] });
		const votes$ = eventStore.timeline({ kinds: [VOTE_KIND], '#a': [bountyAddress] });
		const payouts$ = eventStore.timeline({ kinds: [PAYOUT_KIND], '#a': [bountyAddress] });

		this.#combinedSub = combineLatest([bounty$, pledges$, solutions$, votes$, payouts$]).subscribe({
			next: ([bountyEvent, pledgeEvents, solutionEvents, voteEvents, payoutEvents]: [
				NostrEvent | undefined,
				NostrEvent[],
				NostrEvent[],
				NostrEvent[],
				NostrEvent[]
			]) => {
				if (bountyEvent) {
					this.#bounty = parseBountyDetail(
						bountyEvent,
						pledgeEvents,
						solutionEvents,
						voteEvents,
						payoutEvents,
						[] // delete events — not tracked in Phase 2
					);
				}
				this.#loading = false;
			},
			error: (err: unknown) => {
				this.#error = err instanceof Error ? err.message : 'Failed to load bounty details';
				this.#loading = false;
			}
		});

		// Start relay loaders to feed events into EventStore
		this.#relaySubs.push(createPledgeLoader(bountyAddress));
		this.#relaySubs.push(createSolutionLoader(bountyAddress));
		this.#relaySubs.push(createVoteLoader(bountyAddress));
		this.#relaySubs.push(createProfileLoader([pubkey]));

		// Also load the bounty event itself from relays via a direct subscription
		this.#loadBountyFromRelays(kind, pubkey, dTag);
	}

	#loadBountyFromRelays(kind: number, pubkey: string, dTag: string) {
		const filter = { kinds: [kind], authors: [pubkey], '#d': [dTag] };
		const relayUrls = getDefaultRelays();

		for (const url of relayUrls) {
			try {
				const sub = pool
					.relay(url)
					.subscription(filter)
					.pipe(onlyEvents(), mapEventsToStore(eventStore))
					.subscribe();
				this.#relaySubs.push(sub);
			} catch {
				// Skip unreachable relays
			}
		}
	}

	/** Clean up all subscriptions */
	destroy() {
		this.#combinedSub?.unsubscribe();
		this.#combinedSub = null;
		for (const sub of this.#relaySubs) {
			sub.unsubscribe();
		}
		this.#relaySubs = [];
	}
}
