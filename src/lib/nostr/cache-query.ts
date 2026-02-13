import type { NostrEvent, Filter } from 'nostr-tools';
import type { Subscription } from 'rxjs';
import { eventStore } from './event-store';
import { loadCachedEvents } from './cache';
import { pool } from './relay-pool';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import { getDefaultRelays } from '$lib/utils/env';
import { hashFilters, isQueryFresh, recordQueryFetch } from './cache-meta';

export interface CachedQueryOptions {
	filters: Filter[];
	/** Max age in ms before relay revalidation. Default: 5 min */
	maxAgeMs?: number;
	/** If true, never fetch from relays */
	cacheOnly?: boolean;
}

export interface CachedQueryState {
	events: NostrEvent[];
	loading: boolean;
	fromCache: boolean;
}

/**
 * Reactive cached query class using Svelte 5 runes.
 *
 * Cache-first with stale-while-revalidate:
 * 1. Check EventStore (L1) — return immediately if populated
 * 2. Check IndexedDB (L2) — load and render cached events
 * 3. Subscribe to relays (L3) — merge updates as they arrive
 */
export class CachedQuery {
	events = $state<NostrEvent[]>([]);
	loading = $state(true);
	fromCache = $state(false);

	#filters: Filter[];
	#maxAgeMs: number;
	#cacheOnly: boolean;
	#filterHash: string;
	#relaySubs: Subscription[] = [];
	#relayTimer: ReturnType<typeof setTimeout> | null = null;
	#destroyed = false;

	constructor(options: CachedQueryOptions) {
		this.#filters = options.filters;
		this.#maxAgeMs = options.maxAgeMs ?? 5 * 60 * 1000;
		this.#cacheOnly = options.cacheOnly ?? false;
		this.#filterHash = hashFilters(options.filters);

		void this.#initialize();
	}

	async #initialize(): Promise<void> {
		if (this.#destroyed) return;

		// L1: Check EventStore
		const l1Events = eventStore.getByFilters(this.#filters);
		if (l1Events.length > 0) {
			this.events = l1Events;
			this.fromCache = true;
			this.loading = false;

			// Check freshness — if fresh, skip relay fetch
			if (isQueryFresh(this.#filterHash, this.#maxAgeMs) || this.#cacheOnly) {
				return;
			}
			// Stale — revalidate from relays
			this.#subscribeRelays();
			return;
		}

		// L2: Check IndexedDB
		await loadCachedEvents(this.#filters);

		if (this.#destroyed) return;

		const l2Events = eventStore.getByFilters(this.#filters);
		if (l2Events.length > 0) {
			this.events = l2Events;
			this.fromCache = true;
			this.loading = false;
		}

		if (this.#cacheOnly) {
			this.loading = false;
			return;
		}

		// L3: Subscribe to relays
		if (isQueryFresh(this.#filterHash, this.#maxAgeMs) && l2Events.length > 0) {
			this.loading = false;
			return;
		}
		this.#subscribeRelays();
	}

	#subscribeRelays(): void {
		if (this.#destroyed) return;

		const relayUrls = getDefaultRelays();
		let receivedCount = 0;

		for (const url of relayUrls) {
			try {
				const sub = pool
					.relay(url)
					.subscription(this.#filters)
					.pipe(onlyEvents(), mapEventsToStore(eventStore))
					.subscribe({
						next: () => {
							receivedCount++;
							if (!this.#destroyed) {
								this.events = eventStore.getByFilters(this.#filters);
								this.fromCache = false;
							}
						}
					});
				this.#relaySubs.push(sub);
			} catch {
				// skip unreachable relay
			}
		}

		// Auto-complete after timeout
		this.#relayTimer = setTimeout(() => {
			this.#cleanupRelays();
			if (!this.#destroyed) {
				this.loading = false;
				recordQueryFetch(this.#filterHash, this.events.length);
			}
		}, 10_000);

		// Also mark as not loading after first batch of events (500ms debounce)
		setTimeout(() => {
			if (!this.#destroyed && this.events.length > 0) {
				this.loading = false;
				recordQueryFetch(this.#filterHash, this.events.length);
			}
		}, 500);
	}

	/**
	 * Force refresh from relays, ignoring cache freshness.
	 */
	refresh(): void {
		this.loading = true;
		this.#cleanupRelays();
		this.#subscribeRelays();
	}

	#cleanupRelays(): void {
		for (const sub of this.#relaySubs) {
			sub.unsubscribe();
		}
		this.#relaySubs = [];
		if (this.#relayTimer) {
			clearTimeout(this.#relayTimer);
			this.#relayTimer = null;
		}
	}

	destroy(): void {
		this.#destroyed = true;
		this.#cleanupRelays();
	}
}

/**
 * Create a cached query with stale-while-revalidate semantics.
 * Returns a reactive CachedQuery instance (use with Svelte 5 runes).
 *
 * @example
 * ```ts
 * const query = cachedQuery({ filters: [{ kinds: [37300], limit: 50 }], maxAgeMs: 120_000 });
 * // In template: {#each query.events as event}
 * // On cleanup: query.destroy();
 * ```
 */
export function cachedQuery(options: CachedQueryOptions): CachedQuery {
	return new CachedQuery(options);
}
