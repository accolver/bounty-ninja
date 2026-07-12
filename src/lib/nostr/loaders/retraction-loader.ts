import type { Subscription } from 'rxjs';
import { onlyEvents } from 'applesauce-relay';
import { retractionFilter } from '$lib/bounty/filters';
import { getDefaultRelays } from '$lib/utils/env';
import { ingestEventsFrom } from '$lib/nostr/event-ingestion';
import { pool } from '$lib/nostr/relay-pool';

export function createRetractionLoader(
	bountyAddress: string,
	relayUrls: readonly string[] = getDefaultRelays()
): { unsubscribe(): void } {
	const filter = retractionFilter(bountyAddress);
	const subscriptions: Subscription[] = [];
	for (const url of relayUrls) {
		try {
			subscriptions.push(
				pool
					.relay(url)
					.subscription(filter)
					.pipe(onlyEvents(), ingestEventsFrom('relay'))
					.subscribe()
			);
		} catch {
			// Skip unreachable relays.
		}
	}
	return { unsubscribe: () => subscriptions.forEach((subscription) => subscription.unsubscribe()) };
}
