import type { Subscription } from 'rxjs';
import { catchError, EMPTY } from 'rxjs';
import { timeout, toArray } from 'rxjs/operators';
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

/** Timeout in ms before falling back to client-side search */
const SEARCH_RELAY_TIMEOUT = 5_000;

/**
 * Reactive search store using Svelte 5 runes.
 *
 * Attempts NIP-50 full-text search via a dedicated search relay.
 * Falls back to client-side substring matching on EventStore events
 * when the relay is unreachable or times out.
 */
class SearchStore {
	#results = $state<BountySummary[]>([]);
	#loading = $state(false);
	#error = $state<string | null>(null);
	#query = $state('');
	#subscription: Subscription | null = null;

	/** Current search results */
	get results(): BountySummary[] {
		return this.#results;
	}

	/** Whether a search is in progress */
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
	 * Execute a search query.
	 *
	 * 1. Cancels any in-flight subscription
	 * 2. Tries NIP-50 relay search with a 5s timeout
	 * 3. Falls back to client-side EventStore filtering on timeout/error
	 */
	search(query: string): void {
		this.#cancelSubscription();
		this.#query = query;

		const trimmed = query.trim();
		if (!trimmed) {
			this.#results = [];
			this.#loading = false;
			this.#error = null;
			return;
		}

		this.#loading = true;
		this.#error = null;

		const filter = searchBountiesFilter(trimmed);
		const searchRelayUrl = getSearchRelay();

		try {
			const relay = pool.relay(searchRelayUrl);

			this.#subscription = relay
				.subscription(filter)
				.pipe(
					onlyEvents(),
					mapEventsToStore(eventStore),
					// Collect all events until the relay closes the subscription (EOSE),
					// but bail out after SEARCH_RELAY_TIMEOUT ms if nothing completes.
					timeout(SEARCH_RELAY_TIMEOUT),
					toArray(),
					catchError(() => {
						// Timeout or relay error — fall back to client-side filtering
						this.#fallbackSearch(trimmed);
						return EMPTY;
					})
				)
				.subscribe({
					next: (events: NostrEvent[]) => {
						this.#results = events
							.map(parseBountySummary)
							.filter((s): s is BountySummary => s !== null);
						this.#loading = false;
					},
					error: () => {
						// Should not reach here due to catchError, but handle defensively
						this.#fallbackSearch(trimmed);
					},
					complete: () => {
						this.#loading = false;
					}
				});
		} catch {
			// pool.relay() can throw if the URL is invalid
			this.#fallbackSearch(trimmed);
		}
	}

	/**
	 * Client-side fallback: filter EventStore bounty events by
	 * case-insensitive substring match on title and tags.
	 */
	#fallbackSearch(query: string): void {
		const lowerQuery = query.toLowerCase();

		// Get current bounty events from EventStore via a one-shot timeline subscription
		this.#cancelSubscription();

		this.#subscription = eventStore.timeline({ kinds: [BOUNTY_KIND] }).subscribe({
			next: (events: NostrEvent[]) => {
				const summaries = events
					.map(parseBountySummary)
					.filter((s): s is BountySummary => s !== null);

				this.#results = summaries.filter((bounty) => {
					const titleMatch = bounty.title.toLowerCase().includes(lowerQuery);
					const tagMatch = bounty.tags.some((tag) => tag.toLowerCase().includes(lowerQuery));
					return titleMatch || tagMatch;
				});

				this.#loading = false;
				this.#error = null;

				// Unsubscribe after first emission — we only need a snapshot
				this.#cancelSubscription();
			},
			error: (err: unknown) => {
				this.#error = err instanceof Error ? err.message : 'Search failed';
				this.#loading = false;
				this.#results = [];
			}
		});
	}

	/** Cancel any in-flight relay or EventStore subscription */
	#cancelSubscription(): void {
		this.#subscription?.unsubscribe();
		this.#subscription = null;
	}

	/** Reset all state to initial values */
	clear(): void {
		this.#cancelSubscription();
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
