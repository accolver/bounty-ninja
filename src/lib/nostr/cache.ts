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
const CACHE_READ_TIMEOUT_MS = 2_000;
import { storageKey } from '$lib/config';

const CACHE_VERSION_KEY = storageKey('cache-version');
export const EVENT_CACHE_DATABASE_NAME = 'nostr-idb';
const APP_OWNED_CACHE_DATABASES = [EVENT_CACHE_DATABASE_NAME] as const;

function withinCacheReadTimeout<T>(operation: Promise<T>): Promise<T | null> {
	return new Promise((resolve, reject) => {
		let settled = false;
		const timer = setTimeout(() => {
			settled = true;
			resolve(null);
		}, CACHE_READ_TIMEOUT_MS);
		operation.then(
			(value) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				resolve(value);
			},
			(error: unknown) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				reject(error);
			}
		);
	});
}

function isQuotaError(error: unknown): boolean {
	return (
		(error instanceof DOMException && error.name === 'QuotaExceededError') ||
		(error instanceof Error && /quota|storage full/i.test(error.message))
	);
}

async function persistEvent(event: NostrEvent): Promise<void> {
	if (!db) return;
	try {
		await addEvents(db, [event]);
	} catch (error) {
		if (!isQuotaError(error) || !db) {
			console.warn('[cache] Failed to persist event', error);
			return;
		}
		try {
			const { emergencyEviction } = await import('./cache-eviction');
			await emergencyEviction(null);
			if (db) await addEvents(db, [event]);
		} catch (retryError) {
			console.warn('[cache] Persistence retry failed after emergency eviction', retryError);
		}
	}
}

function deleteDatabase(databaseName: string): Promise<void> {
	return new Promise((resolve, reject) => {
		let request: IDBOpenDBRequest;
		try {
			request = indexedDB.deleteDatabase(databaseName);
		} catch (error) {
			reject(error);
			return;
		}
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error ?? new Error(`Failed to delete ${databaseName}`));
		request.onblocked = () => reject(new Error(`Deletion of ${databaseName} was blocked`));
	});
}

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
			void persistEvent(event);
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
	if (!db && (await withinCacheReadTimeout(initCache())) === null) return;
	if (!db) return;
	const events = await withinCacheReadTimeout(getEventsForFilters(db, filters));
	if (!events) return;
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
	eventStore.removeByFilters([{}]);
	const { clearProfileCache } = await import('./profile-cache');
	clearProfileCache();
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
		await deleteDatabase(databaseName);
	}

	// Clear cache metadata
	clearCacheMeta();
	eventStore.removeByFilters([{}]);
	const { clearProfileCache } = await import('./profile-cache');
	clearProfileCache();

	// Clear cache version so it gets re-set
	localStorage.removeItem(CACHE_VERSION_KEY);
	insertSubscription?.unsubscribe();
	insertSubscription = null;
	initPromise = null;
}
