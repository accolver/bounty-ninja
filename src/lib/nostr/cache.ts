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
import { clearCacheMeta } from './cache-meta';

let db: NostrIDBDatabase | null = null;

const CACHE_VERSION = 1;
const CACHE_VERSION_KEY = 'bounty.ninja:cache-version';

/**
 * Initialize the nostr-idb IndexedDB cache.
 * Checks cache version and clears on mismatch.
 * Wires the cache to the EventStore so events are persisted and restored.
 */
export async function initCache(): Promise<void> {
	// Check cache version — clear on mismatch
	const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
	if (storedVersion && parseInt(storedVersion, 10) !== CACHE_VERSION) {
		console.info('[cache] Version mismatch — clearing all caches');
		await clearAllCaches();
	}
	localStorage.setItem(CACHE_VERSION_KEY, String(CACHE_VERSION));

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

/**
 * Clear all caches: IndexedDB, cache metadata, profile cache.
 * Used on cache version mismatch.
 */
export async function clearAllCaches(): Promise<void> {
	// Clear IndexedDB by deleting the database
	if (db) {
		db.close();
		db = null;
	}
	try {
		const databases = await indexedDB.databases();
		for (const dbInfo of databases) {
			if (dbInfo.name) {
				indexedDB.deleteDatabase(dbInfo.name);
			}
		}
	} catch {
		// indexedDB.databases() not supported in all browsers
		// Try deleting the known database name
		try {
			indexedDB.deleteDatabase('nostr-idb');
		} catch {
			// best effort
		}
	}

	// Clear cache metadata
	clearCacheMeta();

	// Clear cache version so it gets re-set
	localStorage.removeItem(CACHE_VERSION_KEY);
}
