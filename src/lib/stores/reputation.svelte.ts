import type { NostrEvent } from 'nostr-tools';
import { combineLatest, type Subscription } from 'rxjs';
import { eventStore } from '$lib/nostr/event-store';
import { pool } from '$lib/nostr/relay-pool';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import { getDefaultRelays } from '$lib/utils/env';
import { PAYOUT_KIND, PLEDGE_KIND, REPUTATION_KIND } from '$lib/bounty/kinds';
import { deriveReputation, type ReputationScore } from '$lib/reputation/score';

/**
 * Reactive store that caches reputation scores per pubkey.
 * Lazily fetches Kind 73006, 73004, and 73002 events on first access.
 */
export class ReputationStore {
	#cache: Map<string, ReputationScore> = new Map();
	#loading: Set<string> = new Set();
	#subs: Map<string, Array<Subscription | { unsubscribe(): void }>> = new Map();

	/**
	 * Get the cached reputation score for a pubkey, or null if not yet loaded.
	 * Triggers lazy loading on first access.
	 */
	getReputation(pubkey: string): ReputationScore | null {
		if (this.#cache.has(pubkey)) {
			return this.#cache.get(pubkey)!;
		}

		if (!this.#loading.has(pubkey)) {
			this.#loadReputation(pubkey);
		}

		return null;
	}

	#loadReputation(pubkey: string) {
		this.#loading.add(pubkey);
		const subs: Array<Subscription | { unsubscribe(): void }> = [];

		// Subscribe to EventStore timelines
		const repEvents$ = eventStore.timeline({ kinds: [REPUTATION_KIND], '#p': [pubkey] });
		const payoutEvents$ = eventStore.timeline({ kinds: [PAYOUT_KIND] });
		const pledgeEvents$ = eventStore.timeline({ kinds: [PLEDGE_KIND], authors: [pubkey] });

		// Also need payouts where pubkey is the solver (p tag)
		const solverPayouts$ = eventStore.timeline({ kinds: [PAYOUT_KIND], '#p': [pubkey] });

		const combinedSub = combineLatest([
			repEvents$,
			payoutEvents$,
			pledgeEvents$,
			solverPayouts$
		]).subscribe({
			next: ([repEvents, payoutEvents, pledgeEvents, solverPayouts]: [
				NostrEvent[],
				NostrEvent[],
				NostrEvent[],
				NostrEvent[]
			]) => {
				// Merge payout events (deduplicate by id)
				const allPayouts = new Map<string, NostrEvent>();
				for (const e of [...payoutEvents, ...solverPayouts]) {
					allPayouts.set(e.id, e);
				}

				const score = deriveReputation(
					pubkey,
					Array.from(allPayouts.values()),
					repEvents,
					pledgeEvents
				);
				this.#cache.set(pubkey, score);
			}
		});
		subs.push(combinedSub);

		// Start relay subscriptions to feed EventStore
		const relayUrls = getDefaultRelays();
		const filters = [
			{ kinds: [REPUTATION_KIND], '#p': [pubkey] },
			{ kinds: [PAYOUT_KIND], '#p': [pubkey] },
			{ kinds: [PAYOUT_KIND], authors: [pubkey] },
			{ kinds: [PLEDGE_KIND], authors: [pubkey] }
		];

		for (const url of relayUrls) {
			for (const filter of filters) {
				try {
					const sub = pool
						.relay(url)
						.subscription(filter)
						.pipe(onlyEvents(), mapEventsToStore(eventStore))
						.subscribe();
					subs.push(sub);
				} catch {
					// Skip unreachable relays
				}
			}
		}

		this.#subs.set(pubkey, subs);
	}

	/** Clean up all subscriptions */
	destroy() {
		for (const [, subs] of this.#subs) {
			for (const sub of subs) {
				sub.unsubscribe();
			}
		}
		this.#subs.clear();
		this.#cache.clear();
		this.#loading.clear();
	}
}

/** Singleton reputation store */
export const reputationStore = new ReputationStore();
