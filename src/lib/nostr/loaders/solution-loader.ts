import type { Subscription } from 'rxjs';
import { pool } from '$lib/nostr/relay-pool';
import { eventStore } from '$lib/nostr/event-store';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import { getDefaultRelays } from '$lib/utils/env';
import { solutionsForBountyFilter } from '$lib/bounty/filters';

/**
 * Create a loader that subscribes to solution events (Kind 73001)
 * for a specific bounty address from all default relays.
 */
export function createSolutionLoader(bountyAddress: string): { unsubscribe(): void } {
	const filter = solutionsForBountyFilter(bountyAddress);
	const relayUrls = getDefaultRelays();
	const subscriptions: Subscription[] = [];

	for (const url of relayUrls) {
		try {
			const sub = pool
				.relay(url)
				.subscription(filter)
				.pipe(onlyEvents(), mapEventsToStore(eventStore))
				.subscribe();
			subscriptions.push(sub);
		} catch (e) {
			console.warn('[solution-loader] Failed to subscribe to relay:', url, e);
		}
	}

	return {
		unsubscribe() {
			for (const sub of subscriptions) {
				sub.unsubscribe();
			}
		}
	};
}
