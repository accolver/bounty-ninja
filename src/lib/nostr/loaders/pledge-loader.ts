import type { Subscription } from 'rxjs';
import { pool } from '$lib/nostr/relay-pool';
import { eventStore } from '$lib/nostr/event-store';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import { getDefaultRelays } from '$lib/utils/env';
import {
	pledgesForTaskFilter,
	allPledgesFilter,
	allSolutionsFilter,
	allPayoutsFilter
} from '$lib/task/filters';

/**
 * Create a loader that subscribes to ALL pledge events (Kind 73002)
 * from all default relays. Used by the home page to aggregate
 * funding totals across all tasks.
 */
export function createAllPledgesLoader(): { unsubscribe(): void } {
	const filter = allPledgesFilter();
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
 * Create a loader that subscribes to ALL solution events (Kind 73001)
 * from all default relays. Used by the home page to derive task status.
 */
export function createAllSolutionsLoader(): { unsubscribe(): void } {
	const filter = allSolutionsFilter();
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
 * Create a loader that subscribes to ALL payout events (Kind 73004)
 * from all default relays. Used by the home page to derive task status.
 */
export function createAllPayoutsLoader(): { unsubscribe(): void } {
	const filter = allPayoutsFilter();
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
 * Create a loader that subscribes to pledge events (Kind 73002)
 * for a specific task address from all default relays.
 */
export function createPledgeLoader(taskAddress: string): { unsubscribe(): void } {
	const filter = pledgesForTaskFilter(taskAddress);
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
