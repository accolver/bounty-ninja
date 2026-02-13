import type { NostrEvent } from 'nostr-tools';
import { eventStore } from './event-store';
import { loadCachedEvents } from './cache';
import { pool } from './relay-pool';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import { getDefaultRelays } from '$lib/utils/env';
import type { Subscription } from 'rxjs';

/** Parsed Kind 0 content */
export interface ProfileContent {
	name?: string;
	display_name?: string;
	picture?: string;
	nip05?: string;
	about?: string;
	banner?: string;
	lud06?: string;
	lud16?: string;
	[key: string]: unknown;
}

export interface CachedProfile {
	event: NostrEvent;
	parsed: ProfileContent;
	fetchedAt: number;
}

const MAX_PROFILES = 500;
const FRESH_MS = 15 * 60 * 1000; // 15 min
const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

/** LRU map: pubkey → CachedProfile. Oldest entries evicted when over MAX_PROFILES. */
const profileMap = new Map<string, CachedProfile>();

/** Track in-flight revalidation to avoid duplicates */
const revalidating = new Set<string>();

/** Track in-flight batch loads */
let batchTimer: ReturnType<typeof setTimeout> | null = null;
const batchQueue = new Set<string>();

function parseProfileContent(content: string): ProfileContent {
	try {
		return JSON.parse(content) as ProfileContent;
	} catch {
		return {};
	}
}

function addToLRU(pubkey: string, entry: CachedProfile): void {
	// Delete and re-insert to move to end (most recent)
	profileMap.delete(pubkey);
	profileMap.set(pubkey, entry);

	// Evict oldest if over limit
	if (profileMap.size > MAX_PROFILES) {
		const oldest = profileMap.keys().next().value;
		if (oldest) profileMap.delete(oldest);
	}
}

/**
 * Get a cached profile immediately. Returns null if not in cache.
 * Triggers background revalidation if stale (>15 min).
 * Also checks EventStore (L1) before returning null.
 */
export function getCachedProfile(pubkey: string): CachedProfile | null {
	// Check in-memory LRU first
	const cached = profileMap.get(pubkey);
	if (cached) {
		// Move to end (LRU touch)
		profileMap.delete(pubkey);
		profileMap.set(pubkey, cached);

		const age = Date.now() - cached.fetchedAt;
		if (age > FRESH_MS && !revalidating.has(pubkey)) {
			revalidateProfile(pubkey);
		}
		return cached;
	}

	// Check EventStore (L1)
	const event = eventStore.getReplaceable(0, pubkey);
	if (event) {
		const entry: CachedProfile = {
			event,
			parsed: parseProfileContent(event.content),
			fetchedAt: Date.now() - FRESH_MS - 1 // Mark as needing revalidation
		};
		addToLRU(pubkey, entry);
		revalidateProfile(pubkey);
		return entry;
	}

	return null;
}

/**
 * Load a profile with cache-first semantics.
 * 1. Return cached immediately if available
 * 2. Load from IndexedDB (L2) into EventStore
 * 3. Fetch from relays (L3) if stale or missing
 *
 * Returns the cached profile or null. The EventStore subscription
 * in calling code will update reactively when relay data arrives.
 */
export async function loadProfile(pubkey: string): Promise<CachedProfile | null> {
	const cached = getCachedProfile(pubkey);
	if (cached) {
		const age = Date.now() - cached.fetchedAt;
		if (age < FRESH_MS) return cached;
		// Stale — revalidation already triggered by getCachedProfile
		return cached;
	}

	// L2: Try IndexedDB
	await loadCachedEvents([{ kinds: [0], authors: [pubkey] }]);

	// Check EventStore again after IDB load
	const event = eventStore.getReplaceable(0, pubkey);
	if (event) {
		const entry: CachedProfile = {
			event,
			parsed: parseProfileContent(event.content),
			fetchedAt: Date.now() - FRESH_MS - 1 // needs revalidation
		};
		addToLRU(pubkey, entry);
		revalidateProfile(pubkey);
		return entry;
	}

	// L3: Queue for batch relay fetch
	queueBatchLoad(pubkey);
	return null;
}

/**
 * Background revalidation: fetch fresh Kind 0 from relays.
 */
function revalidateProfile(pubkey: string): void {
	if (revalidating.has(pubkey)) return;
	revalidating.add(pubkey);

	const filter = { kinds: [0 as number], authors: [pubkey] };
	const relayUrls = getDefaultRelays();
	const subs: Subscription[] = [];

	for (const url of relayUrls) {
		try {
			const sub = pool
				.relay(url)
				.subscription(filter)
				.pipe(onlyEvents(), mapEventsToStore(eventStore))
				.subscribe({
					next: (event: NostrEvent) => {
						const entry: CachedProfile = {
							event,
							parsed: parseProfileContent(event.content),
							fetchedAt: Date.now()
						};
						addToLRU(pubkey, entry);
					}
				});
			subs.push(sub);
		} catch {
			// skip unreachable relay
		}
	}

	// Clean up after timeout
	setTimeout(() => {
		for (const sub of subs) sub.unsubscribe();
		revalidating.delete(pubkey);
	}, 10_000);
}

/**
 * Queue a pubkey for batch loading. Coalesces multiple calls within 50ms
 * into a single REQ filter.
 */
function queueBatchLoad(pubkey: string): void {
	batchQueue.add(pubkey);
	if (batchTimer) return;
	batchTimer = setTimeout(() => {
		const pubkeys = [...batchQueue];
		batchQueue.clear();
		batchTimer = null;
		if (pubkeys.length > 0) {
			executeBatchLoad(pubkeys);
		}
	}, 50);
}

/**
 * Batch-load profiles efficiently.
 * Groups pubkeys into a single REQ filter instead of N individual subscriptions.
 */
export function batchLoadProfiles(pubkeys: string[]): { unsubscribe(): void } {
	if (pubkeys.length === 0) return { unsubscribe() {} };

	// Filter out already-fresh profiles
	const needed = pubkeys.filter((pk) => {
		const cached = profileMap.get(pk);
		if (!cached) return true;
		return Date.now() - cached.fetchedAt > FRESH_MS;
	});

	if (needed.length === 0) return { unsubscribe() {} };

	return executeBatchLoad(needed);
}

function executeBatchLoad(pubkeys: string[]): { unsubscribe(): void } {
	const filter = { kinds: [0 as number], authors: pubkeys };
	const relayUrls = getDefaultRelays();
	const subs: Subscription[] = [];

	for (const url of relayUrls) {
		try {
			const sub = pool
				.relay(url)
				.subscription(filter)
				.pipe(onlyEvents(), mapEventsToStore(eventStore))
				.subscribe({
					next: (event: NostrEvent) => {
						const entry: CachedProfile = {
							event,
							parsed: parseProfileContent(event.content),
							fetchedAt: Date.now()
						};
						addToLRU(event.pubkey, entry);
					}
				});
			subs.push(sub);
		} catch {
			// skip
		}
	}

	// Auto-cleanup after 15s
	const timer = setTimeout(() => {
		for (const sub of subs) sub.unsubscribe();
	}, 15_000);

	return {
		unsubscribe() {
			clearTimeout(timer);
			for (const sub of subs) sub.unsubscribe();
		}
	};
}

/**
 * Warm the profile cache from IndexedDB for a set of pubkeys.
 * Call early (e.g., on app init) to populate L1 from L2.
 */
export async function warmProfileCache(pubkeys: string[]): Promise<void> {
	if (pubkeys.length === 0) return;
	await loadCachedEvents([{ kinds: [0], authors: pubkeys }]);
	for (const pubkey of pubkeys) {
		const event = eventStore.getReplaceable(0, pubkey);
		if (event) {
			addToLRU(pubkey, {
				event,
				parsed: parseProfileContent(event.content),
				fetchedAt: Date.now()
			});
		}
	}
}

/**
 * Clear the in-memory profile cache.
 */
export function clearProfileCache(): void {
	profileMap.clear();
	revalidating.clear();
	batchQueue.clear();
	if (batchTimer) {
		clearTimeout(batchTimer);
		batchTimer = null;
	}
}

/**
 * Get profile cache stats for monitoring.
 */
export function getProfileCacheStats(): { size: number; maxSize: number } {
	return { size: profileMap.size, maxSize: MAX_PROFILES };
}
