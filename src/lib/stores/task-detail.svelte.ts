import type { Subscription } from 'rxjs';
import { combineLatest } from 'rxjs';
import type { NostrEvent } from 'nostr-tools';
import type { TaskDetail } from '$lib/task/types';
import { eventStore } from '$lib/nostr/event-store';
import { parseTaskDetail } from '$lib/task/helpers';
import { PLEDGE_KIND, SOLUTION_KIND, VOTE_KIND, PAYOUT_KIND } from '$lib/task/kinds';
import { pool } from '$lib/nostr/relay-pool';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import { getDefaultRelays } from '$lib/utils/env';
import { createPledgeLoader } from '$lib/nostr/loaders/pledge-loader';
import { createSolutionLoader } from '$lib/nostr/loaders/solution-loader';
import { createVoteLoader } from '$lib/nostr/loaders/vote-loader';
import { createProfileLoader } from '$lib/nostr/loaders/profile-loader';

/**
 * Reactive store for a single task's full detail.
 * Subscribes to multiple EventStore timelines and composes them
 * into a single TaskDetail object.
 */
export class TaskDetailStore {
	#task = $state<TaskDetail | null>(null);
	#loading = $state(true);
	#error = $state<string | null>(null);
	#combinedSub: Subscription | null = null;
	#relaySubs: Array<{ unsubscribe(): void }> = [];

	/** The full task detail, or null if not loaded */
	get task(): TaskDetail | null {
		return this.#task;
	}

	/** Whether the initial load is still in progress */
	get loading(): boolean {
		return this.#loading;
	}

	/** Error message if loading failed */
	get error(): string | null {
		return this.#error;
	}

	/**
	 * Load a task and all related events.
	 * Cleans up any previous subscriptions first.
	 */
	load(taskAddress: string, kind: number, pubkey: string, dTag: string) {
		this.destroy();
		this.#loading = true;
		this.#error = null;

		// Subscribe to EventStore timelines for all related event kinds
		const task$ = eventStore.replaceable(kind, pubkey, dTag);
		const pledges$ = eventStore.timeline({ kinds: [PLEDGE_KIND], '#a': [taskAddress] });
		const solutions$ = eventStore.timeline({ kinds: [SOLUTION_KIND], '#a': [taskAddress] });
		const votes$ = eventStore.timeline({ kinds: [VOTE_KIND], '#a': [taskAddress] });
		const payouts$ = eventStore.timeline({ kinds: [PAYOUT_KIND], '#a': [taskAddress] });

		this.#combinedSub = combineLatest([task$, pledges$, solutions$, votes$, payouts$]).subscribe({
			next: ([taskEvent, pledgeEvents, solutionEvents, voteEvents, payoutEvents]: [
				NostrEvent | undefined,
				NostrEvent[],
				NostrEvent[],
				NostrEvent[],
				NostrEvent[]
			]) => {
				if (taskEvent) {
					this.#task = parseTaskDetail(
						taskEvent,
						pledgeEvents,
						solutionEvents,
						voteEvents,
						payoutEvents,
						[] // delete events — not tracked in Phase 2
					);
				}
				this.#loading = false;
			},
			error: (err: unknown) => {
				this.#error = err instanceof Error ? err.message : 'Failed to load task details';
				this.#loading = false;
			}
		});

		// Start relay loaders to feed events into EventStore
		this.#relaySubs.push(createPledgeLoader(taskAddress));
		this.#relaySubs.push(createSolutionLoader(taskAddress));
		this.#relaySubs.push(createVoteLoader(taskAddress));
		this.#relaySubs.push(createProfileLoader([pubkey]));

		// Also load the task event itself from relays via a direct subscription
		this.#loadTaskFromRelays(kind, pubkey, dTag);
	}

	#loadTaskFromRelays(kind: number, pubkey: string, dTag: string) {
		const filter = { kinds: [kind], authors: [pubkey], '#d': [dTag] };
		const relayUrls = getDefaultRelays();

		for (const url of relayUrls) {
			try {
				const sub = pool
					.relay(url)
					.subscription(filter)
					.pipe(onlyEvents(), mapEventsToStore(eventStore))
					.subscribe();
				this.#relaySubs.push(sub);
			} catch {
				// Skip unreachable relays
			}
		}
	}

	/** Clean up all subscriptions */
	destroy() {
		this.#combinedSub?.unsubscribe();
		this.#combinedSub = null;
		for (const sub of this.#relaySubs) {
			sub.unsubscribe();
		}
		this.#relaySubs = [];
	}
}
