import type { Filter } from 'nostr-tools';
import { storageKey } from '$lib/config';

const STORAGE_KEY = storageKey('cache-meta');

export interface QueryMeta {
	lastFetched: number;
	eventCount: number;
}

interface CacheMetaStore {
	queries: Record<string, QueryMeta>;
	version: number;
}

/**
 * Deterministic hash of a filter array for cache key purposes.
 * Uses a simple string hash (djb2) of sorted JSON.
 */
export function hashFilters(filters: Filter[]): string {
	const normalized = filters.map((f) => {
		const sorted: Record<string, unknown> = {};
		for (const key of Object.keys(f).sort()) {
			const val = (f as Record<string, unknown>)[key];
			if (Array.isArray(val)) {
				sorted[key] = [...val].sort();
			} else {
				sorted[key] = val;
			}
		}
		return sorted;
	});
	const str = JSON.stringify(normalized);
	// djb2 hash
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
	}
	return (hash >>> 0).toString(16).padStart(8, '0');
}

function load(): CacheMetaStore {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			return JSON.parse(raw) as CacheMetaStore;
		}
	} catch {
		// corrupted
	}
	return { queries: {}, version: 1 };
}

function save(store: CacheMetaStore): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
	} catch {
		// quota exceeded — clear old entries
		store.queries = {};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
	}
}

/**
 * Record that a query was fetched from relays.
 */
export function recordQueryFetch(filterHash: string, eventCount: number): void {
	const store = load();
	store.queries[filterHash] = {
		lastFetched: Date.now(),
		eventCount
	};
	// Prune old entries (keep max 200)
	const keys = Object.keys(store.queries);
	if (keys.length > 200) {
		const sorted = keys.sort(
			(a, b) => store.queries[a].lastFetched - store.queries[b].lastFetched
		);
		for (const key of sorted.slice(0, keys.length - 200)) {
			delete store.queries[key];
		}
	}
	save(store);
}

/**
 * Get metadata for a previously-fetched query.
 */
export function getQueryMeta(filterHash: string): QueryMeta | null {
	const store = load();
	return store.queries[filterHash] ?? null;
}

/**
 * Check if a query is still fresh (doesn't need relay revalidation).
 */
export function isQueryFresh(filterHash: string, maxAgeMs: number): boolean {
	const meta = getQueryMeta(filterHash);
	if (!meta) return false;
	return Date.now() - meta.lastFetched < maxAgeMs;
}

/**
 * Clear all query metadata.
 */
export function clearCacheMeta(): void {
	localStorage.removeItem(STORAGE_KEY);
}

/** Freshness thresholds in milliseconds */
export const FRESHNESS = {
	BOUNTY_LIST: 2 * 60 * 1000, // 2 min
	BOUNTY_DETAIL: 5 * 60 * 1000, // 5 min
	PROFILE: 15 * 60 * 1000, // 15 min
	APPLICATIONS: 1 * 60 * 1000 // 1 min
} as const;
