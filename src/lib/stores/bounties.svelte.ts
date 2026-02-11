import type { Subscription } from 'rxjs';
import type { NostrEvent } from 'nostr-tools';
import type { BountySummary } from '$lib/bounty/types';
import { eventStore } from '$lib/nostr/event-store';
import { parseBountySummary } from '$lib/bounty/helpers';
import { BOUNTY_KIND } from '$lib/bounty/kinds';
import { createBountyListLoader } from '$lib/nostr/loaders/bounty-loader';

/**
 * Reactive store for the bounty list.
 * Bridges EventStore timeline Observable to Svelte 5 runes.
 */
class BountyListStore {
	#items = $state<BountySummary[]>([]);
	#loading = $state(true);
	#error = $state<string | null>(null);
	#timelineSub: Subscription | null = null;
	#relayLoader: { unsubscribe(): void } | null = null;

	constructor() {
		this.#startSubscription();
	}

	#startSubscription() {
		// Subscribe to EventStore timeline for bounty events
		this.#timelineSub = eventStore.timeline({ kinds: [BOUNTY_KIND] }).subscribe({
			next: (events: NostrEvent[]) => {
				this.#items = events.map(parseBountySummary).filter((s): s is BountySummary => s !== null);
				this.#loading = false;
			},
			error: (err: unknown) => {
				this.#error = err instanceof Error ? err.message : 'Failed to load bounties';
				this.#loading = false;
			}
		});

		// Start relay loader to feed events into EventStore
		this.#relayLoader = createBountyListLoader();
	}

	/** All bounty summaries, sorted by created_at descending (from timeline) */
	get items(): BountySummary[] {
		return this.#items;
	}

	/** Whether the initial load is still in progress */
	get loading(): boolean {
		return this.#loading;
	}

	/** Error message if loading failed */
	get error(): string | null {
		return this.#error;
	}

	/** Items sorted by totalPledged descending */
	get popular(): BountySummary[] {
		return [...this.#items].sort((a, b) => b.totalPledged - a.totalPledged);
	}

	/** Clean up all subscriptions */
	destroy() {
		this.#timelineSub?.unsubscribe();
		this.#timelineSub = null;
		this.#relayLoader?.unsubscribe();
		this.#relayLoader = null;
	}
}

/** Singleton bounty list store */
export const bountyList = new BountyListStore();
