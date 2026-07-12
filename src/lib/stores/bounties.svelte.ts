import type { Subscription } from 'rxjs';
import { combineLatest } from 'rxjs';
import type { NostrEvent } from 'nostr-tools';
import type { BountySummary, Retraction } from '$lib/bounty/types';
import { eventStore } from '$lib/nostr/event-store';
import { parseBountyDetail, parseBountySummary, parseRetraction } from '$lib/bounty/helpers';
import {
	BOUNTY_KIND,
	PAYOUT_KIND,
	PLEDGE_KIND,
	RETRACTION_KIND,
	SOLUTION_KIND,
	VOTE_KIND
} from '$lib/bounty/kinds';
import { createBountyListLoader } from '$lib/nostr/loaders/bounty-loader';
import { createAllRelatedEventsLoader } from '$lib/nostr/loaders/related-events-loader';
import { verifyPayoutsForBounty, verifyPledgesForBounty } from '$lib/cashu/financial-verifier';
import { projectFinancialState } from '$lib/bounty/financial-state';
import { projectionRegistry } from '$lib/stores/projections.svelte';
import { loadCachedEvents } from '$lib/nostr/cache';
import { bountyListFilter } from '$lib/bounty/filters';

/** Reactive home-feed projection. Financial values never come from raw relay declarations. */
class BountyListStore {
	#bounties = $state<BountySummary[]>([]);
	#loading = $state(true);
	#error = $state<string | null>(null);
	#eventSub: Subscription | null = null;
	#bountyLoader: { unsubscribe(): void } | null = null;
	#relatedLoader: { unsubscribe(): void } | null = null;
	#loadingTimer: ReturnType<typeof setTimeout> | null = null;
	#rebuildTimer: ReturnType<typeof setTimeout> | null = null;
	#rebuildVersion = 0;
	#relatedEventsComplete = false;
	#stale = $state(false);
	#initialized = false;
	#events: {
		bounties: NostrEvent[];
		pledges: NostrEvent[];
		solutions: NostrEvent[];
		votes: NostrEvent[];
		payouts: NostrEvent[];
		retractions: NostrEvent[];
	} = { bounties: [], pledges: [], solutions: [], votes: [], payouts: [], retractions: [] };

	init() {
		if (this.#initialized) return;
		this.#initialized = true;
		this.#startSubscription();
	}

	#startSubscription() {
		this.#loadingTimer = setTimeout(() => {
			this.#loading = false;
		}, 8000);

		this.#eventSub = combineLatest([
			eventStore.timeline({ kinds: [BOUNTY_KIND] }),
			eventStore.timeline({ kinds: [PLEDGE_KIND] }),
			eventStore.timeline({ kinds: [SOLUTION_KIND] }),
			eventStore.timeline({ kinds: [VOTE_KIND] }),
			eventStore.timeline({ kinds: [PAYOUT_KIND] }),
			eventStore.timeline({ kinds: [RETRACTION_KIND] })
		]).subscribe({
			next: ([bounties, pledges, solutions, votes, payouts, retractions]) => {
				this.#events = { bounties, pledges, solutions, votes, payouts, retractions };
				this.#scheduleRebuild();
			},
			error: (error: unknown) => {
				this.#error = error instanceof Error ? error.message : 'Failed to load bounties';
				this.#loading = false;
			}
		});

		void this.#hydrateAndStartRelays();
	}

	async #hydrateAndStartRelays() {
		try {
			await loadCachedEvents([
				bountyListFilter(),
				{
					kinds: [PLEDGE_KIND, SOLUTION_KIND, VOTE_KIND, PAYOUT_KIND, RETRACTION_KIND],
					limit: 500
				}
			]);
			if (!this.#initialized) return;
			this.#stale = this.#events.bounties.length > 0;
		} catch {
			// Relay loading remains available when IndexedDB is unavailable.
		}
		if (!this.#initialized) return;
		this.#bountyLoader = createBountyListLoader();
		this.#relatedLoader = createAllRelatedEventsLoader(() => {
			this.#relatedEventsComplete = true;
			this.#stale = false;
			this.#scheduleRebuild();
		});
	}

	#scheduleRebuild() {
		if (this.#rebuildTimer) clearTimeout(this.#rebuildTimer);
		this.#rebuildTimer = setTimeout(() => {
			this.#rebuildTimer = null;
			void this.#rebuild();
		}, 100);
	}

	async #rebuild() {
		const version = ++this.#rebuildVersion;
		const events = this.#events;
		const projected = await Promise.all(
			events.bounties.map(async (event) => {
				const summary = parseBountySummary(event);
				if (!summary) return null;
				const address = `${BOUNTY_KIND}:${summary.pubkey}:${summary.dTag}`;
				const forAddress = (item: NostrEvent) =>
					item.tags.some((tag) => tag[0] === 'a' && tag[1] === address);
				const detail = parseBountyDetail(
					event,
					events.pledges.filter(forAddress),
					events.solutions.filter(forAddress),
					events.votes.filter(forAddress),
					events.payouts.filter(forAddress),
					[],
					events.retractions.filter(forAddress)
				);
				if (!detail) return null;
				const retractions = events.retractions
					.filter(forAddress)
					.map(parseRetraction)
					.filter((item): item is Retraction => item !== null);
				const [pledgeVerifications, payoutTokenVerifications] = await Promise.all([
					verifyPledgesForBounty(detail, detail.pledges),
					verifyPayoutsForBounty(detail, detail.payouts)
				]);
				const projection = projectFinancialState({
					bounty: detail,
					pledges: detail.pledges,
					pledgeVerifications,
					solutions: detail.solutions,
					votes: [...detail.votesBySolution.values()].flat(),
					payouts: detail.payouts,
					payoutTokenVerifications,
					retractions,
					relatedEventsComplete: this.#relatedEventsComplete,
					now: Math.floor(Date.now() / 1000)
				});
				return {
					summary: {
						...summary,
						totalPledged: projection.validatedFunding,
						solutionCount: projection.solutions.length,
						status: projection.status
					} satisfies BountySummary,
					projection
				};
			})
		);
		if (version !== this.#rebuildVersion) return;
		const items = projected.filter((item): item is NonNullable<typeof item> => item !== null);
		this.#bounties = items.map((item) => item.summary);
		projectionRegistry.replace(
			'home',
			items.map((item) => item.projection)
		);
		this.#loading = false;
		if (this.#loadingTimer) {
			clearTimeout(this.#loadingTimer);
			this.#loadingTimer = null;
		}
	}

	get items(): BountySummary[] {
		return this.#bounties;
	}

	get loading(): boolean {
		return this.#loading;
	}

	get error(): string | null {
		return this.#error;
	}

	get stale(): boolean {
		return this.#stale;
	}

	get popular(): BountySummary[] {
		return [...this.#bounties].sort((left, right) => right.totalPledged - left.totalPledged);
	}

	destroy() {
		this.#rebuildVersion++;
		this.#eventSub?.unsubscribe();
		this.#eventSub = null;
		this.#bountyLoader?.unsubscribe();
		this.#bountyLoader = null;
		this.#relatedLoader?.unsubscribe();
		this.#relatedLoader = null;
		if (this.#loadingTimer) clearTimeout(this.#loadingTimer);
		if (this.#rebuildTimer) clearTimeout(this.#rebuildTimer);
		this.#loadingTimer = null;
		this.#rebuildTimer = null;
		this.#initialized = false;
		this.#relatedEventsComplete = false;
		this.#stale = false;
		projectionRegistry.remove('home');
	}
}

export const bountyList = new BountyListStore();
