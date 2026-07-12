import type { Filter, NostrEvent } from 'nostr-tools';
import type { Subscription } from 'rxjs';
import { pool } from '$lib/nostr/relay-pool';
import { ingestEvent } from '$lib/nostr/event-ingestion';
import {
	PAYOUT_KIND,
	PLEDGE_KIND,
	RETRACTION_KIND,
	SOLUTION_KIND,
	VOTE_KIND
} from '$lib/bounty/kinds';
import { getDefaultRelays } from '$lib/utils/env';

function createLoader(
	filter: Filter,
	relayUrls: readonly string[],
	onSettled: () => void
): { unsubscribe(): void } {
	const subscriptions: Subscription[] = [];
	const pending = new Set(relayUrls);
	let active = true;

	const settle = (url: string) => {
		if (!active || !pending.delete(url)) return;
		if (pending.size === 0) onSettled();
	};

	if (pending.size === 0) queueMicrotask(onSettled);
	for (const url of relayUrls) {
		try {
			const subscription = pool
				.relay(url)
				.subscription(filter)
				.subscribe({
					next(response: NostrEvent | 'EOSE') {
						if (response === 'EOSE') settle(url);
						else ingestEvent(response, 'relay');
					},
					error() {
						settle(url);
					}
				});
			subscriptions.push(subscription);
		} catch {
			settle(url);
		}
	}

	return {
		unsubscribe() {
			active = false;
			for (const subscription of subscriptions) subscription.unsubscribe();
		}
	};
}

/** Load one bounty's projection inputs and report bounded EOSE completeness. */
export function createRelatedEventsLoader(
	bountyAddress: string,
	relayUrls: readonly string[],
	onSettled: () => void
): { unsubscribe(): void } {
	return createLoader(
		{
			kinds: [PLEDGE_KIND, SOLUTION_KIND, VOTE_KIND, PAYOUT_KIND, RETRACTION_KIND],
			'#a': [bountyAddress]
		},
		relayUrls,
		onSettled
	);
}

/** Load projection inputs for the bounded home feed in one subscription per relay. */
export function createAllRelatedEventsLoader(
	onSettled: () => void,
	relayUrls: readonly string[] = getDefaultRelays()
): { unsubscribe(): void } {
	return createLoader(
		{
			kinds: [PLEDGE_KIND, SOLUTION_KIND, VOTE_KIND, PAYOUT_KIND, RETRACTION_KIND],
			limit: 500
		},
		relayUrls,
		onSettled
	);
}
