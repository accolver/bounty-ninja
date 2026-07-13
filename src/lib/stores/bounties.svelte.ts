import type { Subscription } from 'rxjs';
import { combineLatest } from 'rxjs';
import type { NostrEvent } from 'nostr-tools';
import type { BountySummary, Retraction } from '$lib/bounty/types';
import { eventStore } from '$lib/nostr/event-store';
import {
	parseBountyDetail,
	parseBountySummary,
	parsePayout,
	parsePledge,
	parseRetraction
} from '$lib/bounty/helpers';
import {
	BOUNTY_KIND,
	PAYOUT_KIND,
	PLEDGE_KIND,
	RETRACTION_KIND,
	SOLUTION_KIND,
	VOTE_KIND
} from '$lib/bounty/kinds';
import { createBountyListLoader } from '$lib/nostr/loaders/bounty-loader';
import {
	createGlobalProofOwnershipLoader,
	createRelatedEventsLoader
} from '$lib/nostr/loaders/related-events-loader';
import { projectFinancialState } from '$lib/bounty/financial-state';
import { projectionRegistry } from '$lib/stores/projections.svelte';
import { loadCachedEvents } from '$lib/nostr/cache';
import { bountyListFilter } from '$lib/bounty/filters';
import { getDefaultMint, getDefaultRelays } from '$lib/utils/env';
import { isConfiguredMint } from '$lib/utils/network-policy';

/** Reactive home-feed projection. Financial values never come from raw relay declarations. */
class BountyListStore {
	#bounties = $state<BountySummary[]>([]);
	#loading = $state(true);
	#error = $state<string | null>(null);
	#eventSub: Subscription | null = null;
	#bountyLoader: { unsubscribe(): void } | null = null;
	#globalProofLoader: { unsubscribe(): void } | null = null;
	#relatedLoaders = new Map<string, { unsubscribe(): void }>();
	#loadingTimer: ReturnType<typeof setTimeout> | null = null;
	#rebuildTimer: ReturnType<typeof setTimeout> | null = null;
	#freshnessTimer: ReturnType<typeof setTimeout> | null = null;
	#rebuildVersion = 0;
	#relatedEventsComplete = false;
	#globalProofSetComplete = false;
	#completeAddresses = new Set<string>();
	#relaysStarted = false;
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
		if (typeof document !== 'undefined')
			document.addEventListener('visibilitychange', this.#onVisibility);
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
				this.#syncRelatedLoaders();
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
			await loadCachedEvents([bountyListFilter()]);
			const addresses = this.#bountyAddresses();
			if (addresses.length > 0) {
				await loadCachedEvents(
					addresses.map((address) => ({
						kinds: [PLEDGE_KIND, SOLUTION_KIND, VOTE_KIND, PAYOUT_KIND, RETRACTION_KIND],
						'#a': [address]
					}))
				);
			}
			if (!this.#initialized) return;
			this.#stale = this.#events.bounties.length > 0;
		} catch {
			// Relay loading remains available when IndexedDB is unavailable.
		}
		if (!this.#initialized) return;
		this.#bountyLoader = createBountyListLoader();
		this.#globalProofLoader = createGlobalProofOwnershipLoader(getDefaultRelays(), () => {
			this.#globalProofSetComplete = true;
			this.#stale = !this.#relatedEventsComplete;
			this.#scheduleRebuild();
		});
		this.#relaysStarted = true;
		this.#syncRelatedLoaders();
	}

	#bountyAddresses(): string[] {
		return this.#events.bounties.flatMap((event) => {
			const summary = parseBountySummary(event);
			return summary ? [`${BOUNTY_KIND}:${summary.pubkey}:${summary.dTag}`] : [];
		});
	}

	#syncRelatedLoaders(): void {
		if (!this.#relaysStarted) return;
		const current = new Set(this.#bountyAddresses());
		for (const address of current) {
			if (this.#relatedLoaders.has(address)) continue;
			const loader = createRelatedEventsLoader(address, getDefaultRelays(), () => {
				this.#completeAddresses.add(address);
				this.#relatedEventsComplete = this.#bountyAddresses().every((item) =>
					this.#completeAddresses.has(item)
				);
				this.#stale = !(this.#relatedEventsComplete && this.#globalProofSetComplete);
				this.#scheduleRebuild();
			});
			this.#relatedLoaders.set(address, loader);
		}
		for (const [address, loader] of this.#relatedLoaders) {
			if (current.has(address)) continue;
			loader.unsubscribe();
			this.#relatedLoaders.delete(address);
			this.#completeAddresses.delete(address);
		}
		this.#relatedEventsComplete =
			current.size > 0 && [...current].every((address) => this.#completeAddresses.has(address));
	}

	#onVisibility = () => {
		if (document.visibilityState === 'visible') this.#scheduleRebuild();
	};

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
		const { buildGlobalProofOwnership, verifyPayoutsForBounty, verifyPledgesForBounty } =
			await import('$lib/cashu/financial-verifier');
		if (version !== this.#rebuildVersion) return;
		const globalPledges = events.pledges.map(parsePledge).filter((item) => item !== null);
		const globalPayouts = events.payouts
			.map((event) => parsePayout(event))
			.filter((item) => item !== null);
		const globalProofOwners = await buildGlobalProofOwnership(globalPledges, globalPayouts);
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
					verifyPledgesForBounty(
						detail,
						detail.pledges,
						undefined,
						isConfiguredMint(detail.mintUrl, getDefaultMint())
					),
					verifyPayoutsForBounty(
						detail,
						detail.payouts,
						undefined,
						isConfiguredMint(detail.mintUrl, getDefaultMint())
					)
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
					globalProofOwners,
					globalProofSetComplete: this.#globalProofSetComplete,
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
		this.#scheduleFreshnessRefresh(items.map((item) => item.summary));
		if (this.#loadingTimer) {
			clearTimeout(this.#loadingTimer);
			this.#loadingTimer = null;
		}
	}

	#scheduleFreshnessRefresh(items: readonly BountySummary[]): void {
		if (this.#freshnessTimer) clearTimeout(this.#freshnessTimer);
		const nowMs = Date.now();
		const transitions = items.flatMap((item) =>
			item.deadline && item.deadline * 1000 > nowMs ? [item.deadline * 1000] : []
		);
		transitions.push(nowMs + 5 * 60 * 1000);
		const delay = Math.max(100, Math.min(...transitions) - nowMs + 25);
		this.#freshnessTimer = setTimeout(() => this.#scheduleRebuild(), delay);
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
		this.#globalProofLoader?.unsubscribe();
		this.#globalProofLoader = null;
		for (const loader of this.#relatedLoaders.values()) loader.unsubscribe();
		this.#relatedLoaders.clear();
		if (this.#loadingTimer) clearTimeout(this.#loadingTimer);
		if (this.#rebuildTimer) clearTimeout(this.#rebuildTimer);
		if (this.#freshnessTimer) clearTimeout(this.#freshnessTimer);
		this.#loadingTimer = null;
		this.#rebuildTimer = null;
		this.#freshnessTimer = null;
		this.#initialized = false;
		this.#relatedEventsComplete = false;
		this.#globalProofSetComplete = false;
		this.#completeAddresses.clear();
		this.#relaysStarted = false;
		this.#stale = false;
		if (typeof document !== 'undefined')
			document.removeEventListener('visibilitychange', this.#onVisibility);
		projectionRegistry.remove('home');
	}
}

export const bountyList = new BountyListStore();
