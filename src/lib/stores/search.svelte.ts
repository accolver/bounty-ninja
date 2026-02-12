import type { Subscription } from 'rxjs';
import { catchError, EMPTY } from 'rxjs';
import { take, timeout, toArray } from 'rxjs/operators';
import type { NostrEvent } from 'nostr-tools';
import type { BountySummary } from '$lib/bounty/types';
import { eventStore } from '$lib/nostr/event-store';
import { pool } from '$lib/nostr/relay-pool';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import { parseBountySummary } from '$lib/bounty/helpers';
import { searchBountiesFilter } from '$lib/bounty/filters';
import { getSearchRelay } from '$lib/utils/env';
import { BOUNTY_KIND } from '$lib/bounty/kinds';

/** Timeout in ms for the NIP-50 relay enhancement */
const SEARCH_RELAY_TIMEOUT = 5_000;

/**
 * Reactive search store using Svelte 5 runes.
 *
 * Local-first: immediately searches the in-memory EventStore for instant results,
 * then enhances with NIP-50 relay results when they arrive.
 */
class SearchStore {
	#results = $state<BountySummary[]>([]);
	#loading = $state(false);
	#error = $state<string | null>(null);
	#query = $state('');
	#relaySubscription: Subscription | null = null;

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
	 * 2. Fires off a NIP-50 relay search in parallel
	 * 3. Merges relay results in when they arrive (deduped by event id)
	 */
	search(query: string): void {
		this.#cancelRelaySubscription();
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

		// 2. Async relay enhancement
		this.#relaySearch(trimmed);
	}

	/**
	 * Synchronous client-side search: filter EventStore bounty events by
	 * case-insensitive substring match on title and tags.
	 * Results appear immediately.
	 */
	#localSearch(query: string): void {
		const lowerQuery = query.toLowerCase();

		eventStore
			.timeline({ kinds: [BOUNTY_KIND] })
			.pipe(take(1))
			.subscribe({
				next: (events: NostrEvent[]) => {
					const summaries = events
						.map(parseBountySummary)
						.filter((s): s is BountySummary => s !== null);

					this.#results = summaries.filter((item) => {
						const titleMatch = item.title.toLowerCase().includes(lowerQuery);
						const tagMatch = item.tags.some((tag) =>
							tag.toLowerCase().includes(lowerQuery)
						);
						return titleMatch || tagMatch;
					});
				}
			});
	}

	/**
	 * Async NIP-50 relay search. Merges results into existing local results,
	 * deduplicating by event id. Silently gives up on timeout/error.
	 */
	#relaySearch(query: string): void {
		const filter = searchBountiesFilter(query);
		const searchRelayUrl = getSearchRelay();

		this.#loading = true;

		try {
			const relay = pool.relay(searchRelayUrl);

			this.#relaySubscription = relay
				.subscription(filter)
				.pipe(
					onlyEvents(),
					mapEventsToStore(eventStore),
					timeout(SEARCH_RELAY_TIMEOUT),
					toArray(),
					catchError(() => {
						// Timeout or relay error — local results already shown, just stop
						this.#loading = false;
						return EMPTY;
					})
				)
				.subscribe({
					next: (events: NostrEvent[]) => {
						const relaySummaries = events
							.map(parseBountySummary)
							.filter((s): s is BountySummary => s !== null);

						// Merge relay results with existing local results, deduped by id
						const existingIds = new Set(this.#results.map((r) => r.id));
						const newResults = relaySummaries.filter((s) => !existingIds.has(s.id));

						if (newResults.length > 0) {
							this.#results = [...this.#results, ...newResults];
						}

						this.#loading = false;
					},
					error: () => {
						// Should not reach here due to catchError
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

	/** Cancel any in-flight relay subscription */
	#cancelRelaySubscription(): void {
		this.#relaySubscription?.unsubscribe();
		this.#relaySubscription = null;
	}

	/** Reset all state to initial values */
	clear(): void {
		this.#cancelRelaySubscription();
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
