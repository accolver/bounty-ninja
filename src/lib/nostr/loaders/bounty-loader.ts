import type { Subscription } from 'rxjs';
import { pool } from '$lib/nostr/relay-pool';
import { ingestEventsFrom } from '$lib/nostr/event-ingestion';
import { onlyEvents } from 'applesauce-relay';
import { getDefaultRelays } from '$lib/utils/env';
import { bountyListFilter, bountyByAuthorFilter } from '$lib/bounty/filters';

/**
 * Create a loader that subscribes to bounty events (Kind 37300) from all
 * configured relays (including local dev relay) and pipes them into the
 * singleton EventStore.
 *
 * Returns a composite unsubscribable — calling unsubscribe() cleans up
 * all relay subscriptions.
 */
export function createBountyListLoader(limit?: number): { unsubscribe(): void } {
	const filter = bountyListFilter(limit);
	const relayUrls = getDefaultRelays();
	const subscriptions: Subscription[] = [];

	for (const url of relayUrls) {
		try {
			const sub = pool
				.relay(url)
				.subscription(filter)
				.pipe(onlyEvents(), ingestEventsFrom('relay'))
				.subscribe();
			subscriptions.push(sub);
		} catch (e) {
			console.warn('[bounty-list-loader] Failed to subscribe to relay:', url, e);
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

/**
 * Create a loader that subscribes to bounty events by a specific author
 * from all default relays and pipes them into the singleton EventStore.
 */
export function createBountyByAuthorLoader(pubkey: string): { unsubscribe(): void } {
	const filter = bountyByAuthorFilter(pubkey);
	const relayUrls = getDefaultRelays();
	const subscriptions: Subscription[] = [];

	for (const url of relayUrls) {
		try {
			const sub = pool
				.relay(url)
				.subscription(filter)
				.pipe(onlyEvents(), ingestEventsFrom('relay'))
				.subscribe();
			subscriptions.push(sub);
		} catch (e) {
			console.warn('[bounty-author-loader] Failed to subscribe to relay:', url, e);
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
