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
	onComplete: () => void,
	minimumEose = relayUrls.length
): { unsubscribe(): void } {
	const subscriptions: Subscription[] = [];
	const eoseRelays = new Set<string>();
	let active = true;

	const recordEose = (url: string) => {
		if (!active || eoseRelays.has(url)) return;
		eoseRelays.add(url);
		if (eoseRelays.size === minimumEose) onComplete();
	};

	for (const url of relayUrls) {
		try {
			const subscription = pool
				.relay(url)
				.subscription(filter)
				.subscribe({
					next(response: NostrEvent | 'EOSE') {
						if (response === 'EOSE') recordEose(url);
						else ingestEvent(response, 'relay');
					},
					error() {}
				});
			subscriptions.push(subscription);
		} catch {
			// Connection failures are incomplete, never equivalent to EOSE.
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

/** Load projection inputs for the bounded home feed. */
export function createAllRelatedEventsLoader(
	onComplete: () => void,
	relayUrls: readonly string[] = getDefaultRelays()
): { unsubscribe(): void } {
	return createLoader(
		{ kinds: [PLEDGE_KIND, SOLUTION_KIND, VOTE_KIND, PAYOUT_KIND, RETRACTION_KIND] },
		relayUrls,
		onComplete
	);
}

/** Load every financial proof claim needed for cross-bounty replay exclusion. */
export function createGlobalProofOwnershipLoader(
	relayUrls: readonly string[],
	onComplete: () => void
): { unsubscribe(): void } {
	return createLoader({ kinds: [PLEDGE_KIND, PAYOUT_KIND] }, relayUrls, onComplete);
}
