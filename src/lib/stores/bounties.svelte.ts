import type { Subscription } from 'rxjs';
import type { NostrEvent } from 'nostr-tools';
import type { BountySummary, BountyStatus } from '$lib/bounty/types';
import { eventStore } from '$lib/nostr/event-store';
import { parseBountySummary, parsePledge, parseSolution, parsePayout } from '$lib/bounty/helpers';
import { BOUNTY_KIND, PLEDGE_KIND, SOLUTION_KIND, PAYOUT_KIND } from '$lib/bounty/kinds';
import { createBountyListLoader } from '$lib/nostr/loaders/bounty-loader';
import {
	createAllPledgesLoader,
	createAllSolutionsLoader,
	createAllPayoutsLoader
} from '$lib/nostr/loaders/pledge-loader';

/**
 * Reactive store for the bounty list.
 * Bridges EventStore timeline Observable to Svelte 5 runes.
 *
 * Subscribes to bounty, pledge, solution, and payout events so that
 * bounty summaries are enriched with real totalPledged, solutionCount,
 * and derived status values.
 */
class BountyListStore {
	#bounties = $state<BountySummary[]>([]);
	/** Pledge totals keyed by bounty address (e.g. "37300:<pubkey>:<d-tag>") */
	#pledgeTotals = $state<Map<string, number>>(new Map());
	/** Solution counts keyed by bounty address */
	#solutionCounts = $state<Map<string, number>>(new Map());
	/** Set of bounty addresses that have payout events */
	#completedBounties = $state<Set<string>>(new Set());
	#loading = $state(true);
	#error = $state<string | null>(null);
	#bountySub: Subscription | null = null;
	#pledgeSub: Subscription | null = null;
	#solutionSub: Subscription | null = null;
	#payoutSub: Subscription | null = null;
	#bountyLoader: { unsubscribe(): void } | null = null;
	#pledgeLoader: { unsubscribe(): void } | null = null;
	#solutionLoader: { unsubscribe(): void } | null = null;
	#payoutLoader: { unsubscribe(): void } | null = null;
	#initialized = false;

	/**
	 * Initialize subscriptions and relay loaders.
	 * Idempotent — safe to call multiple times; only starts once.
	 */
	init() {
		if (this.#initialized) return;
		this.#initialized = true;
		this.#startSubscription();
	}

	#startSubscription() {
		// Subscribe to EventStore timeline for bounty events
		this.#bountySub = eventStore.timeline({ kinds: [BOUNTY_KIND] }).subscribe({
			next: (events: NostrEvent[]) => {
				this.#bounties = events
					.map(parseBountySummary)
					.filter((s): s is BountySummary => s !== null);
				this.#loading = false;
			},
			error: (err: unknown) => {
				this.#error = err instanceof Error ? err.message : 'Failed to load bounties';
				this.#loading = false;
			}
		});

		// Subscribe to EventStore timeline for pledge events
		this.#pledgeSub = eventStore.timeline({ kinds: [PLEDGE_KIND] }).subscribe({
			next: (events: NostrEvent[]) => {
				const totals = new Map<string, number>();
				for (const event of events) {
					const pledge = parsePledge(event);
					if (pledge && pledge.bountyAddress) {
						totals.set(
							pledge.bountyAddress,
							(totals.get(pledge.bountyAddress) ?? 0) + pledge.amount
						);
					}
				}
				this.#pledgeTotals = totals;
			}
		});

		// Subscribe to EventStore timeline for solution events
		this.#solutionSub = eventStore.timeline({ kinds: [SOLUTION_KIND] }).subscribe({
			next: (events: NostrEvent[]) => {
				const counts = new Map<string, number>();
				for (const event of events) {
					const solution = parseSolution(event);
					if (solution && solution.bountyAddress) {
						counts.set(solution.bountyAddress, (counts.get(solution.bountyAddress) ?? 0) + 1);
					}
				}
				this.#solutionCounts = counts;
			}
		});

		// Subscribe to EventStore timeline for payout events
		this.#payoutSub = eventStore.timeline({ kinds: [PAYOUT_KIND] }).subscribe({
			next: (events: NostrEvent[]) => {
				const completed = new Set<string>();
				for (const event of events) {
					const payout = parsePayout(event);
					if (payout && payout.bountyAddress) {
						completed.add(payout.bountyAddress);
					}
				}
				this.#completedBounties = completed;
			}
		});

		// Start relay loaders to feed events into EventStore
		this.#bountyLoader = createBountyListLoader();
		this.#pledgeLoader = createAllPledgesLoader();
		this.#solutionLoader = createAllSolutionsLoader();
		this.#payoutLoader = createAllPayoutsLoader();
	}

	/** Derive status from available lifecycle data */
	#deriveStatus(
		bounty: BountySummary,
		address: string,
		totalPledged: number,
		solutionCount: number
	): BountyStatus {
		const now = Math.floor(Date.now() / 1000);

		// Completed — payout events exist (list view doesn't compute consensus,
		// so we treat any payout as completed for simplicity)
		if (this.#completedBounties.has(address)) return 'completed';

		// Expired — deadline in the past
		if (bounty.deadline !== null && bounty.deadline <= now) return 'expired';

		// In review — solutions exist
		if (solutionCount > 0) return 'in_review';

		// Open — published (with or without pledges)
		return 'open';
	}

	/** Enrich bounty summaries with aggregated pledge totals, solution counts, and derived status */
	#enriched = $derived.by(() => {
		return this.#bounties.map((bounty) => {
			const address = `${BOUNTY_KIND}:${bounty.pubkey}:${bounty.dTag}`;
			const totalPledged = this.#pledgeTotals.get(address) ?? 0;
			const solutionCount = this.#solutionCounts.get(address) ?? 0;
			const status = this.#deriveStatus(bounty, address, totalPledged, solutionCount);

			if (
				totalPledged === bounty.totalPledged &&
				solutionCount === bounty.solutionCount &&
				status === bounty.status
			)
				return bounty;

			return { ...bounty, totalPledged, solutionCount, status };
		});
	});

	/** All bounty summaries, sorted by created_at descending (from timeline) */
	get items(): BountySummary[] {
		return this.#enriched;
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
		return [...this.#enriched].sort((a, b) => b.totalPledged - a.totalPledged);
	}

	/** Clean up all subscriptions */
	destroy() {
		this.#bountySub?.unsubscribe();
		this.#bountySub = null;
		this.#pledgeSub?.unsubscribe();
		this.#pledgeSub = null;
		this.#solutionSub?.unsubscribe();
		this.#solutionSub = null;
		this.#payoutSub?.unsubscribe();
		this.#payoutSub = null;
		this.#bountyLoader?.unsubscribe();
		this.#bountyLoader = null;
		this.#pledgeLoader?.unsubscribe();
		this.#pledgeLoader = null;
		this.#solutionLoader?.unsubscribe();
		this.#solutionLoader = null;
		this.#payoutLoader?.unsubscribe();
		this.#payoutLoader = null;
	}
}

/** Singleton bounty list store */
export const bountyList = new BountyListStore();
