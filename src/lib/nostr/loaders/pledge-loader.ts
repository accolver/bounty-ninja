import type { Subscription } from 'rxjs';
import { pool } from '$lib/nostr/relay-pool';
import { eventStore } from '$lib/nostr/event-store';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import { onlyValidEvents } from '../valid-events';
import { getDefaultRelays } from '$lib/utils/env';
import {
	pledgesForBountyFilter,
	allPledgesFilter,
	allSolutionsFilter,
	allPayoutsFilter,
	allRetractionsFilter
} from '$lib/bounty/filters';

/**
 * Create a loader that subscribes to ALL pledge events (Kind 7302)
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
				.pipe(onlyEvents(), onlyValidEvents(), mapEventsToStore(eventStore))
				.subscribe();
			subscriptions.push(sub);
		} catch (e) {
			console.warn('[all-pledges-loader] Failed to subscribe to relay:', url, e);
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
 * Create a loader that subscribes to ALL solution events (Kind 7301)
 * from all default relays. Used by the home page to derive bounty status.
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
				.pipe(onlyEvents(), onlyValidEvents(), mapEventsToStore(eventStore))
				.subscribe();
			subscriptions.push(sub);
		} catch (e) {
			console.warn('[all-solutions-loader] Failed to subscribe to relay:', url, e);
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
 * Create a loader that subscribes to ALL payout events (Kind 7304)
 * from all default relays. Used by the home page to derive bounty status.
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
				.pipe(onlyEvents(), onlyValidEvents(), mapEventsToStore(eventStore))
				.subscribe();
			subscriptions.push(sub);
		} catch (e) {
			console.warn('[all-payouts-loader] Failed to subscribe to relay:', url, e);
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
 * Create a loader that subscribes to ALL retraction events (Kind 7305)
 * from all default relays. Used by the home page to derive cancelled status.
 */
export function createAllRetractionsLoader(): { unsubscribe(): void } {
	const filter = allRetractionsFilter();
	const relayUrls = getDefaultRelays();
	const subscriptions: Subscription[] = [];

	for (const url of relayUrls) {
		try {
			const sub = pool
				.relay(url)
				.subscription(filter)
				.pipe(onlyEvents(), onlyValidEvents(), mapEventsToStore(eventStore))
				.subscribe();
			subscriptions.push(sub);
		} catch (e) {
			console.warn('[all-retractions-loader] Failed to subscribe to relay:', url, e);
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
 * Create a loader that subscribes to pledge events (Kind 7302)
 * for a specific bounty address from all default relays.
 */
export function createPledgeLoader(bountyAddress: string): { unsubscribe(): void } {
	const filter = pledgesForBountyFilter(bountyAddress);
	const relayUrls = getDefaultRelays();
	const subscriptions: Subscription[] = [];

	for (const url of relayUrls) {
		try {
			const sub = pool
				.relay(url)
				.subscription(filter)
				.pipe(onlyEvents(), onlyValidEvents(), mapEventsToStore(eventStore))
				.subscribe();
			subscriptions.push(sub);
		} catch (e) {
			console.warn('[pledge-loader] Failed to subscribe to relay:', url, e);
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
