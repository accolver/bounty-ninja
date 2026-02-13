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

const SETTINGS_KEY = 'bounty.ninja:settings';

/**
 * Get the user's configured relay list.
 * Checks localStorage first (user may have customized in settings),
 * falls back to environment defaults.
 */
export function getConfiguredRelays(): string[] {
	try {
		const raw = localStorage.getItem(SETTINGS_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed.relays) && parsed.relays.length > 0) {
				return parsed.relays;
			}
		}
	} catch {
		/* ignore parse errors */
	}
	return getDefaultRelays();
}

/**
 * Connect to all configured relays.
 * Reads from localStorage settings first, falls back to env defaults.
 */
export function connectDefaultRelays(): void {
	const relayUrls = getConfiguredRelays();
	for (const url of relayUrls) {
		pool.relay(url);
	}
}
