import { getDatabase } from './cache';
import type { NostrIDBDatabase } from 'nostr-idb';
import { getEventsForFilters, deleteEventsByIds } from 'nostr-idb';

/**
 * Configuration for cache eviction policies.
 */
export interface CacheEvictionConfig {
	/** Maximum number of events to keep in cache */
	maxEvents: number;
	/** Maximum age of events in milliseconds */
	maxAgeMs: number;
	/** Target percentage of maxEvents to evict down to (0-1) */
	evictToRatio: number;
	/** Emergency eviction ratio when quota is exceeded (0-1) */
	emergencyEvictRatio: number;
}

const DEFAULT_CONFIG: CacheEvictionConfig = {
	maxEvents: 10_000,
	maxAgeMs: 30 * 24 * 60 * 60 * 1000, // 30 days
	evictToRatio: 0.9, // Evict to 90% (9,000 events)
	emergencyEvictRatio: 0.5 // Emergency: evict to 50% (5,000 events)
};

/**
 * Result of an eviction run.
 */
export interface EvictionResult {
	/** Number of events evicted by age */
	ageEvicted: number;
	/** Number of events evicted by count (LRU) */
	countEvicted: number;
	/** Total events remaining after eviction */
	remaining: number;
}

/**
 * Schedule a non-blocking eviction run using requestIdleCallback (with setTimeout fallback).
 * This ensures eviction doesn't block the main thread during user interactions.
 *
 * @param currentUserPubkey - Pubkey of the current user (their events are never evicted)
 * @param config - Optional eviction configuration overrides
 * @returns Promise that resolves with the eviction result
 */
export function scheduleEviction(
	currentUserPubkey: string | null,
	config: Partial<CacheEvictionConfig> = {}
): Promise<EvictionResult> {
	return new Promise((resolve) => {
		const callback = async () => {
			const result = await runEviction(currentUserPubkey, config);
			resolve(result);
		};

		if (typeof requestIdleCallback === 'function') {
			requestIdleCallback(() => {
				void callback();
			});
		} else {
			setTimeout(() => {
				void callback();
			}, 0);
		}
	});
}

/**
 * Run emergency eviction when a quota error is detected.
 * Aggressively evicts to 50% of max capacity.
 *
 * @param currentUserPubkey - Pubkey of the current user (their events are never evicted)
 * @param config - Optional eviction configuration overrides
 */
export async function emergencyEviction(
	currentUserPubkey: string | null,
	config: Partial<CacheEvictionConfig> = {}
): Promise<EvictionResult> {
	const mergedConfig = { ...DEFAULT_CONFIG, ...config };
	console.warn(
		`[cache-eviction] Emergency eviction triggered — evicting to ${mergedConfig.emergencyEvictRatio * 100}% capacity`
	);

	return runEviction(currentUserPubkey, {
		...config,
		evictToRatio: mergedConfig.emergencyEvictRatio
	});
}

/**
 * Run the eviction process:
 * 1. Age-based eviction: remove events older than maxAgeMs
 * 2. Count-based eviction (LRU): if still over maxEvents, remove oldest events
 *
 * Events by the current user's pubkey are never evicted.
 */
async function runEviction(
	currentUserPubkey: string | null,
	configOverrides: Partial<CacheEvictionConfig> = {}
): Promise<EvictionResult> {
	const config = { ...DEFAULT_CONFIG, ...configOverrides };
	const db = getDatabase();

	if (!db) {
		return { ageEvicted: 0, countEvicted: 0, remaining: 0 };
	}

	let ageEvicted = 0;
	let countEvicted = 0;

	try {
		// Load all events from cache
		const allEvents = await getEventsForFilters(db, [{}]);

		if (allEvents.length === 0) {
			return { ageEvicted: 0, countEvicted: 0, remaining: 0 };
		}

		// Separate user's events (protected) from evictable events
		const protectedEvents = currentUserPubkey
			? allEvents.filter((e) => e.pubkey === currentUserPubkey)
			: [];
		const evictableEvents = currentUserPubkey
			? allEvents.filter((e) => e.pubkey !== currentUserPubkey)
			: [...allEvents];

		// Phase 1: Age-based eviction
		const now = Math.floor(Date.now() / 1000);
		const maxAgeSeconds = Math.floor(config.maxAgeMs / 1000);
		const cutoffTimestamp = now - maxAgeSeconds;

		const expiredIds: string[] = [];
		const nonExpiredEvictable = evictableEvents.filter((e) => {
			if (e.created_at < cutoffTimestamp) {
				expiredIds.push(e.id);
				return false;
			}
			return true;
		});

		if (expiredIds.length > 0) {
			await deleteEventsFromDb(db, expiredIds);
			ageEvicted = expiredIds.length;
		}

		// Phase 2: Count-based LRU eviction
		const totalRemaining = protectedEvents.length + nonExpiredEvictable.length;
		const targetCount = Math.floor(config.maxEvents * config.evictToRatio);

		if (totalRemaining > config.maxEvents) {
			// Sort evictable events by created_at ascending (oldest first = LRU)
			nonExpiredEvictable.sort((a, b) => a.created_at - b.created_at);

			// Calculate how many to evict (accounting for protected events)
			const evictableTarget = Math.max(0, targetCount - protectedEvents.length);
			const toEvictCount = Math.max(0, nonExpiredEvictable.length - evictableTarget);

			if (toEvictCount > 0) {
				const evictIds = nonExpiredEvictable.slice(0, toEvictCount).map((e) => e.id);
				await deleteEventsFromDb(db, evictIds);
				countEvicted = evictIds.length;
			}
		}

		const remaining = totalRemaining - countEvicted;

		if (ageEvicted > 0 || countEvicted > 0) {
			console.info(
				`[cache-eviction] Evicted ${ageEvicted} expired + ${countEvicted} LRU events. ${remaining} remaining.`
			);
		}

		return { ageEvicted, countEvicted, remaining };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`[cache-eviction] Eviction failed: ${message}`);
		return { ageEvicted, countEvicted, remaining: 0 };
	}
}

/**
 * Delete events from the IndexedDB cache by their IDs.
 * Wraps nostr-idb's deleteEvents with error handling.
 */
async function deleteEventsFromDb(db: NostrIDBDatabase, eventIds: string[]): Promise<void> {
	if (eventIds.length === 0) return;

	try {
		await deleteEventsByIds(db, eventIds);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`[cache-eviction] Failed to delete ${eventIds.length} events: ${message}`);
		throw err;
	}
}

/**
 * Get the current count of events in the cache.
 * Useful for monitoring and deciding when to trigger eviction.
 */
export async function getCacheEventCount(): Promise<number> {
	const db = getDatabase();
	if (!db) return 0;

	try {
		const allEvents = await getEventsForFilters(db, [{}]);
		return allEvents.length;
	} catch {
		return 0;
	}
}

/**
 * Estimate the size of the cache in bytes.
 * This is a rough estimate based on JSON serialization of events.
 */
export async function estimateCacheSize(): Promise<number> {
	const db = getDatabase();
	if (!db) return 0;

	try {
		const allEvents = await getEventsForFilters(db, [{}]);
		let totalBytes = 0;
		for (const event of allEvents) {
			// Rough estimate: JSON serialization length * 2 (UTF-16 in JS)
			totalBytes += JSON.stringify(event).length * 2;
		}
		return totalBytes;
	} catch {
		return 0;
	}
}
