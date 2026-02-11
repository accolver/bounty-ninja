import type { Subscription } from 'rxjs';
import { pool } from '$lib/nostr/relay-pool';
import { eventStore } from '$lib/nostr/event-store';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import { getDefaultRelays } from '$lib/utils/env';

/**
 * Create a loader that subscribes to profile metadata events (Kind 0)
 * for specific pubkeys from all default relays.
 */
export function createProfileLoader(pubkeys: string[]): { unsubscribe(): void } {
	if (pubkeys.length === 0) {
		return { unsubscribe() {} };
	}

	const filter = { kinds: [0 as number], authors: pubkeys };
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
