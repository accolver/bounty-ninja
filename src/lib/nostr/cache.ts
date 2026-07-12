import {
	openDB,
	getEventsForFilters,
	addEvents,
	deleteEvent,
	deleteAllEvents,
	type NostrIDBDatabase
} from 'nostr-idb';
import type { NostrEvent, Filter } from 'nostr-tools';
import type { Subscription } from 'rxjs';
import { eventStore } from './event-store';
import { ingestEvent, validateIncomingEvent } from './event-ingestion';
import { clearCacheMeta } from './cache-meta';

let db: NostrIDBDatabase | null = null;
let initPromise: Promise<void> | null = null;
let insertSubscription: Subscription | null = null;

const CACHE_VERSION = 1;
import { storageKey } from '$lib/config';

const CACHE_VERSION_KEY = storageKey('cache-version');
export const EVENT_CACHE_DATABASE_NAME = 'nostr-idb';
const APP_OWNED_CACHE_DATABASES = [EVENT_CACHE_DATABASE_NAME] as const;

/**
 * Initialize the nostr-idb IndexedDB cache.
 * Checks cache version and clears on mismatch.
 * Wires the cache to the EventStore so events are persisted and restored.
 */
async function initializeCache(): Promise<void> {
	// Check cache version — clear on mismatch
	const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
	if (storedVersion && parseInt(storedVersion, 10) !== CACHE_VERSION) {
		console.info('[cache] Version mismatch — clearing all caches');
		await clearAllCaches();
	}
	localStorage.setItem(CACHE_VERSION_KEY, String(CACHE_VERSION));

	db = await openDB();

	// Subscribe to new events added to the store and persist them
	insertSubscription ??= eventStore.insert$.subscribe((event: NostrEvent) => {
		if (db && validateIncomingEvent(event).valid) {
			addEvents(db, [event]);
		}
	});
}

export function initCache(): Promise<void> {
	initPromise ??= initializeCache().catch((error) => {
		initPromise = null;
		throw error;
	});
	return initPromise;
}

/**
 * Load cached events matching the given filters from IndexedDB into the EventStore.
 * Verifies signatures on load; deletes events that fail verification from IndexedDB.
 */
export async function loadCachedEvents(filters: Filter[]): Promise<void> {
	if (!db) await initCache();
	if (!db) return;
	const events = await getEventsForFilters(db, filters);
	for (const event of events) {
		if (ingestEvent(event, 'cache')) {
			continue;
		}
		// Remove corrupted, unsupported, or oversized events from cache.
		try {
			await deleteEvent(db, event.id);
		} catch {
			console.warn(`[cache] Failed to delete invalid event ${event.id} from IndexedDB`);
		}
	}
}

/**
 * Get the underlying IndexedDB database instance.
 */
export function getDatabase(): NostrIDBDatabase | null {
	return db;
}

/** Clear public relay events without touching other application databases. */
export async function clearEventCache(): Promise<void> {
	if (!db) throw new Error('Cache database not initialized');
	await deleteAllEvents(db);
	clearCacheMeta();
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
	for (const databaseName of APP_OWNED_CACHE_DATABASES) {
		try {
			indexedDB.deleteDatabase(databaseName);
		} catch {
			// best effort
		}
	}

	// Clear cache metadata
	clearCacheMeta();

	// Clear cache version so it gets re-set
	localStorage.removeItem(CACHE_VERSION_KEY);
	insertSubscription?.unsubscribe();
	insertSubscription = null;
	initPromise = null;
}
