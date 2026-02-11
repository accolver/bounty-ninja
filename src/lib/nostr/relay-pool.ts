import { RelayPool } from 'applesauce-relay';
import { getDefaultRelays } from '$lib/utils/env';
import { validateEvent } from './event-validator';
import { eventStore } from './event-store';
import type { NostrEvent } from 'nostr-tools';

/** Singleton RelayPool — manages all relay WebSocket connections */
export const pool = new RelayPool();

/**
 * Process an incoming relay event: validate signature then add to EventStore.
 * Invalid events are silently discarded with a console warning.
 */
export function processRelayEvent(event: NostrEvent): void {
	if (!validateEvent(event)) return;
	eventStore.add(event);
}

/**
 * Connect to all default relays from environment configuration.
 * Reads PUBLIC_DEFAULT_RELAYS, splits by comma, and opens connections.
 */
export function connectDefaultRelays(): void {
	const relayUrls = getDefaultRelays();
	for (const url of relayUrls) {
		pool.relay(url);
	}
}
