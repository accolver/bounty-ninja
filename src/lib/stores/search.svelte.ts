import type { Subscription } from 'rxjs';
import { take, timeout } from 'rxjs/operators';
import type { NostrEvent } from 'nostr-tools';
import type { BountySummary } from '$lib/bounty/types';
import { loadCachedEvents } from '$lib/nostr/cache';
import { eventStore } from '$lib/nostr/event-store';
import { ingestEventsFrom } from '$lib/nostr/event-ingestion';
import { pool } from '$lib/nostr/relay-pool';
import { onlyEvents } from 'applesauce-relay';
import { parseBountySummary } from '$lib/bounty/helpers';
import { searchBountiesFilter } from '$lib/bounty/filters';
import { getSearchRelay } from '$lib/utils/env';
import { BOUNTY_KIND } from '$lib/bounty/kinds';

/** Timeout in ms for the NIP-50 relay enhancement */
const SEARCH_RELAY_TIMEOUT = 5_000;

/**
 * Reactive search store using Svelte 5 runes.
 *
 * Local-first: immediately searches the in-memory EventStore, hydrates verified
 * cached events, then enhances with NIP-50 relay results when they arrive.
 */
class SearchStore {
	#results = $state<BountySummary[]>([]);
	#loading = $state(false);
	#error = $state<string | null>(null);
	#query = $state('');
	#relaySubscription: Subscription | null = null;
	#searchVersion = 0;

	/** Current search results */
	get results(): BountySummary[] {
		return this.#results;
	}

	/** Whether a relay search is in progress (local results already shown) */
	get loading(): boolean {
		return this.#loading;
	}

	/** Error message from the last search, if any */
	get error(): string | null {
		return this.#error;
	}

	/** The current search query */
	get query(): string {
		return this.#query;
	}

	/**
	 * Execute a search query with local-first strategy.
	 *
	 * 1. Immediately searches the local EventStore (instant)
	 * 2. Hydrates and searches verified IndexedDB events
	 * 3. Fires off a NIP-50 relay search in parallel
	 * 4. Merges relay results as they arrive (deduped by event id)
	 */
	search(query: string): void {
		this.#cancelRelaySubscription();
		const version = ++this.#searchVersion;
		this.#query = query;

		const trimmed = query.trim();
		if (!trimmed) {
			this.#results = [];
			this.#loading = false;
			this.#error = null;
			return;
		}

		this.#error = null;

		// 1. Instant local search
		this.#localSearch(trimmed);

		// 2. Hydrate verified IndexedDB events without blocking local or relay results
		void this.#cachedSearch(trimmed, version);

		// 3. Async relay enhancement
		this.#relaySearch(trimmed);
	}

	async #cachedSearch(query: string, version: number): Promise<void> {
		try {
			await loadCachedEvents([{ kinds: [BOUNTY_KIND] }]);
			if (version === this.#searchVersion) this.#localSearch(query, true);
		} catch {
			// IndexedDB may be unavailable; in-memory and relay search remain usable.
		}
	}

	/**
	 * Synchronous client-side search: filter EventStore bounty events by
	 * case-insensitive substring match on title and tags.
	 * Results appear immediately.
	 */
	#localSearch(query: string, merge = false): void {
		const lowerQuery = query.toLowerCase();

		eventStore
			.timeline({ kinds: [BOUNTY_KIND] })
			.pipe(take(1))
			.subscribe({
				next: (events: NostrEvent[]) => {
					const summaries = events
						.map(parseBountySummary)
						.filter((s): s is BountySummary => s !== null);

					const matches = summaries.filter((item) => {
						const titleMatch = item.title.toLowerCase().includes(lowerQuery);
						const tagMatch = item.tags.some((tag) => tag.toLowerCase().includes(lowerQuery));
						return titleMatch || tagMatch;
					});
					this.#results = merge ? this.#mergeResults(this.#results, matches) : matches;
				}
			});
	}

	/**
	 * Async NIP-50 relay search. Merges each result as it arrives so a later
	 * timeout cannot discard events already received.
	 */
	#relaySearch(query: string): void {
		const filter = searchBountiesFilter(query);
		const searchRelayUrl = getSearchRelay();

		this.#loading = true;

		try {
			const relay = pool.relay(searchRelayUrl);

			this.#relaySubscription = relay
				.subscription(filter)
				.pipe(onlyEvents(), ingestEventsFrom('search'), timeout(SEARCH_RELAY_TIMEOUT))
				.subscribe({
					next: (event: NostrEvent) => {
						const summary = parseBountySummary(event);
						if (summary) this.#results = this.#mergeResults(this.#results, [summary]);
					},
					error: () => {
						// Local and any relay results already received remain visible.
						this.#loading = false;
					},
					complete: () => {
						this.#loading = false;
					}
				});
		} catch {
			// pool.relay() can throw if the URL is invalid — local results already shown
			this.#loading = false;
		}
	}

	#mergeResults(current: BountySummary[], incoming: BountySummary[]): BountySummary[] {
		const existingIds = new Set(current.map((result) => result.id));
		const additions = incoming.filter((result) => !existingIds.has(result.id));
		return additions.length > 0 ? [...current, ...additions] : current;
	}

	/** Cancel any in-flight relay subscription */
	#cancelRelaySubscription(): void {
		this.#relaySubscription?.unsubscribe();
		this.#relaySubscription = null;
	}

	/** Reset all state to initial values */
	clear(): void {
		this.#cancelRelaySubscription();
		this.#searchVersion++;
		this.#results = [];
		this.#loading = false;
		this.#error = null;
		this.#query = '';
	}

	/** Clean up subscriptions — call when the store is no longer needed */
	destroy(): void {
		this.clear();
	}
}

/** Singleton search store */
export const searchStore = new SearchStore();
