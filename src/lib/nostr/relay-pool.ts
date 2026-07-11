import { RelayPool } from 'applesauce-relay';
import { getDefaultRelays } from '$lib/utils/env';
import { ingestEvent } from './event-ingestion';
import type { NostrEvent } from 'nostr-tools';

/** Singleton RelayPool — manages all relay WebSocket connections */
export const pool = new RelayPool();

/**
 * Process an incoming relay event: validate signature then add to EventStore.
 * Invalid events are silently discarded with a console warning.
 */
export function processRelayEvent(event: NostrEvent): void {
	ingestEvent(event, 'relay');
}

/**
 * Connect to all configured relays.
 * getDefaultRelays() checks localStorage settings first, then env defaults.
 */
export function connectDefaultRelays(): void {
	const relayUrls = getDefaultRelays();
	for (const url of relayUrls) {
		pool.relay(url);
	}
}
