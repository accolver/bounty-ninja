import type { Subscription } from 'rxjs';
import { pool } from '$lib/nostr/relay-pool';
import { eventStore } from '$lib/nostr/event-store';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import { getDefaultRelays } from '$lib/utils/env';
import { taskListFilter, taskByAuthorFilter } from '$lib/task/filters';

/**
 * Create a loader that subscribes to task events (Kind 37300) from all
 * configured relays (including local dev relay) and pipes them into the
 * singleton EventStore.
 *
 * Returns a composite unsubscribable — calling unsubscribe() cleans up
 * all relay subscriptions.
 */
export function createTaskListLoader(limit?: number): { unsubscribe(): void } {
	const filter = taskListFilter(limit);
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
		} catch {
			// Skip unreachable relays
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
 * Create a loader that subscribes to task events by a specific author
 * from all default relays and pipes them into the singleton EventStore.
 */
export function createTaskByAuthorLoader(pubkey: string): { unsubscribe(): void } {
	const filter = taskByAuthorFilter(pubkey);
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
		} catch {
			// Skip unreachable relays
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
