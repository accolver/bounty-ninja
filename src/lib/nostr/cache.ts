import {
	openDB,
	getEventsForFilters,
	addEvents,
	deleteEvent,
	type NostrIDBDatabase
} from 'nostr-idb';
import type { NostrEvent, Filter } from 'nostr-tools';
import { eventStore } from './event-store';
import { validateEvent } from './event-validator';

let db: NostrIDBDatabase | null = null;

/**
 * Initialize the nostr-idb IndexedDB cache.
 * Wires the cache to the EventStore so events are persisted and restored.
 */
export async function initCache(): Promise<void> {
	db = await openDB();

	// Subscribe to new events added to the store and persist them
	eventStore.insert$.subscribe((event: NostrEvent) => {
		if (db) {
			addEvents(db, [event]);
		}
	});
}

/**
 * Load cached events matching the given filters from IndexedDB into the EventStore.
 * Verifies signatures on load; deletes events that fail verification from IndexedDB.
 */
export async function loadCachedEvents(filters: Filter[]): Promise<void> {
	if (!db) return;
	const events = await getEventsForFilters(db, filters);
	for (const event of events) {
		if (validateEvent(event)) {
			eventStore.add(event);
		} else {
			// Remove corrupted/tampered events from cache
			try {
				await deleteEvent(db, event.id);
			} catch {
				console.warn(`[cache] Failed to delete invalid event ${event.id} from IndexedDB`);
			}
		}
	}
}

/**
 * Get the underlying IndexedDB database instance.
 */
export function getDatabase(): NostrIDBDatabase | null {
	return db;
}
