import type { Subscription } from 'rxjs';
import { combineLatest } from 'rxjs';
import type { NostrEvent } from 'nostr-tools';
import type { BountyDetail, FinancialProjection, Retraction } from '$lib/bounty/types';
import { eventStore } from '$lib/nostr/event-store';
import { parseBountyDetail } from '$lib/bounty/helpers';
import {
	PLEDGE_KIND,
	SOLUTION_KIND,
	VOTE_KIND,
	PAYOUT_KIND,
	RETRACTION_KIND
} from '$lib/bounty/kinds';
import { parseRetraction } from '$lib/bounty/helpers';
import { getDefaultRelays } from '$lib/utils/env';
import { createProfileLoader } from '$lib/nostr/loaders/profile-loader';
import { createBountyLoader } from '$lib/nostr/loaders/bounty-loader';
import { mergeRelayHints } from '$lib/nostr/relay-hints';
import {
	detectSpentUnretractedPledges,
	autoRetractSpentPledge
} from '$lib/cashu/pledge-monitor.svelte';
import { parsePledge } from '$lib/bounty/helpers';
import { createRelatedEventsLoader } from '$lib/nostr/loaders/related-events-loader';
import { verifyPayoutsForBounty, verifyPledgesForBounty } from '$lib/cashu/financial-verifier';
import { projectFinancialState } from '$lib/bounty/financial-state';
import { projectionRegistry } from '$lib/stores/projections.svelte';
import { loadCachedEvents } from '$lib/nostr/cache';

/**
 * Reactive store for a single bounty's full detail.
 * Subscribes to multiple EventStore timelines and composes them
 * into a single BountyDetail object.
 */
export class BountyDetailStore {
	#bounty = $state<BountyDetail | null>(null);
	#projection = $state<FinancialProjection | null>(null);
	#loading = $state(true);
	#error = $state<string | null>(null);
	#retractions = $state<Retraction[]>([]);
	#retractedPledgeIds = $state<Set<string>>(new Set());
	/** Pledge IDs whose tokens are spent at the mint but have no retraction event yet */
	#spentPledgeIds = $state<Set<string>>(new Set());
	#combinedSub: Subscription | null = null;
	#relaySubs: Array<{ unsubscribe(): void }> = [];
	#spentCheckTimer: ReturnType<typeof setTimeout> | null = null;
	#loadingTimer: ReturnType<typeof setTimeout> | null = null;
	#taskAddress: string | null = null;
	#relatedEventsComplete = false;
	#rebuildVersion = 0;
	#loadGeneration = 0;
	#stale = $state(false);
	#events: {
		bounty?: NostrEvent;
		pledges: NostrEvent[];
		solutions: NostrEvent[];
		votes: NostrEvent[];
		payouts: NostrEvent[];
		retractions: NostrEvent[];
	} = { pledges: [], solutions: [], votes: [], payouts: [], retractions: [] };

	/** The full bounty detail, or null if not loaded */
	get bounty(): BountyDetail | null {
		return this.#bounty;
	}

	get projection(): FinancialProjection | null {
		return this.#projection;
	}

	get relatedEventsComplete(): boolean {
		return this.#relatedEventsComplete;
	}

	get stale(): boolean {
		return this.#stale;
	}

	/** Whether the initial load is still in progress */
	get loading(): boolean {
		return this.#loading;
	}

	/** Error message if loading failed */
	get error(): string | null {
		return this.#error;
	}

	/** Parsed retraction events for this bounty */
	get retractions(): Retraction[] {
		return this.#retractions;
	}

	/** Set of pledge event IDs that have been retracted */
	get retractedPledgeIds(): Set<string> {
		return this.#retractedPledgeIds;
	}

	/** Set of pledge IDs whose tokens are spent but no retraction exists */
	get spentPledgeIds(): Set<string> {
		return this.#spentPledgeIds;
	}

	/**
	 * Load a bounty and all related events.
	 * Cleans up any previous subscriptions first.
	 */
	load(
		bountyAddress: string,
		kind: number,
		pubkey: string,
		dTag: string,
		relayHints: readonly string[] = []
	) {
		this.destroy();
		this.#loading = true;
		this.#error = null;
		this.#taskAddress = bountyAddress;
		this.#relatedEventsComplete = false;

		// Safety timeout: stop showing spinner after 8s even if no data arrives.
		// This gives relays ample time to respond while avoiding infinite loading.
		this.#loadingTimer = setTimeout(() => {
			this.#loading = false;
		}, 8000);

		// Subscribe to EventStore timelines for all related event kinds
		const bounty$ = eventStore.replaceable(kind, pubkey, dTag);
		const pledges$ = eventStore.timeline({ kinds: [PLEDGE_KIND], '#a': [bountyAddress] });
		const solutions$ = eventStore.timeline({ kinds: [SOLUTION_KIND], '#a': [bountyAddress] });
		const votes$ = eventStore.timeline({ kinds: [VOTE_KIND], '#a': [bountyAddress] });
		const payouts$ = eventStore.timeline({ kinds: [PAYOUT_KIND], '#a': [bountyAddress] });
		const retractions$ = eventStore.timeline({ kinds: [RETRACTION_KIND], '#a': [bountyAddress] });

		this.#combinedSub = combineLatest([
			bounty$,
			pledges$,
			solutions$,
			votes$,
			payouts$,
			retractions$
		]).subscribe({
			next: ([
				bountyEvent,
				pledgeEvents,
				solutionEvents,
				voteEvents,
				payoutEvents,
				retractionEvents
			]: [
				NostrEvent | undefined,
				NostrEvent[],
				NostrEvent[],
				NostrEvent[],
				NostrEvent[],
				NostrEvent[]
			]) => {
				this.#events = {
					bounty: bountyEvent,
					pledges: pledgeEvents,
					solutions: solutionEvents,
					votes: voteEvents,
					payouts: payoutEvents,
					retractions: retractionEvents
				};
				void this.#rebuild();
				// Don't set loading=false here — wait for bountyEvent or timeout
			},
			error: (err: unknown) => {
				this.#error = err instanceof Error ? err.message : 'Failed to load bounty details';
				this.#loading = false;
			}
		});

		const relayUrls = mergeRelayHints(getDefaultRelays(), relayHints);
		const generation = this.#loadGeneration;
		void this.#hydrateAndStartRelays(generation, bountyAddress, kind, pubkey, dTag, relayUrls);
	}

	async #hydrateAndStartRelays(
		generation: number,
		bountyAddress: string,
		kind: number,
		pubkey: string,
		dTag: string,
		relayUrls: readonly string[]
	) {
		try {
			await loadCachedEvents([
				{ kinds: [kind], authors: [pubkey], '#d': [dTag] },
				{
					kinds: [PLEDGE_KIND, SOLUTION_KIND, VOTE_KIND, PAYOUT_KIND, RETRACTION_KIND],
					'#a': [bountyAddress]
				}
			]);
			if (generation !== this.#loadGeneration) return;
			this.#stale = this.#events.bounty !== undefined;
		} catch {
			// Relay loading remains available when IndexedDB is unavailable.
		}
		if (generation !== this.#loadGeneration) return;
		this.#relaySubs.push(
			createRelatedEventsLoader(bountyAddress, relayUrls, () => {
				this.#relatedEventsComplete = true;
				this.#stale = false;
				void this.#rebuild();
			})
		);
		this.#relaySubs.push(createBountyLoader(kind, pubkey, dTag, relayUrls));
		this.#relaySubs.push(createProfileLoader([pubkey]));
	}

	async #rebuild() {
		const version = ++this.#rebuildVersion;
		const events = this.#events;
		if (!events.bounty) return;
		const detail = parseBountyDetail(
			events.bounty,
			events.pledges,
			events.solutions,
			events.votes,
			events.payouts,
			[],
			events.retractions
		);
		if (!detail) return;
		const retractions = events.retractions
			.map(parseRetraction)
			.filter((item): item is Retraction => item !== null);
		const votes = [...detail.votesBySolution.values()].flat();
		const [pledgeVerifications, payoutTokenVerifications] = await Promise.all([
			verifyPledgesForBounty(detail, detail.pledges),
			verifyPayoutsForBounty(detail, detail.payouts)
		]);
		if (version !== this.#rebuildVersion) return;
		const now = Math.floor(Date.now() / 1000);
		const projection = projectFinancialState({
			bounty: detail,
			pledges: detail.pledges,
			pledgeVerifications,
			solutions: detail.solutions,
			votes,
			payouts: detail.payouts,
			payoutTokenVerifications,
			retractions,
			relatedEventsComplete: this.#relatedEventsComplete,
			now
		});
		this.#projection = projection;
		projectionRegistry.replace(`detail:${projection.bountyAddress}`, [projection]);
		this.#retractions = [...projection.authorizedRetractions];
		this.#retractedPledgeIds = new Set(
			projection.authorizedRetractions
				.filter((item) => item.type === 'pledge' && item.pledgeEventId)
				.map((item) => item.pledgeEventId as string)
		);
		this.#bounty = {
			...detail,
			status: projection.status,
			totalPledged: projection.validatedFunding,
			solutionCount: projection.solutions.length,
			payouts: [...projection.validPayouts]
		};
		this.#loading = false;
		if (this.#loadingTimer) {
			clearTimeout(this.#loadingTimer);
			this.#loadingTimer = null;
		}
		this.#scheduleSpentCheck(
			events.pledges,
			[...projection.authorizedRetractions],
			events.solutions.length > 0
		);
	}

	/**
	 * Schedule a spent-pledge check against the Cashu mint.
	 * Debounced to avoid hammering the mint on every EventStore update.
	 * When spent tokens are detected for the current user, auto-publishes
	 * retraction (and reputation) events to keep state in sync.
	 */
	#scheduleSpentCheck(
		pledgeEvents: NostrEvent[],
		retractions: Retraction[],
		hasSolutions: boolean
	) {
		if (this.#spentCheckTimer) clearTimeout(this.#spentCheckTimer);

		this.#spentCheckTimer = setTimeout(async () => {
			const pledges = pledgeEvents
				.map(parsePledge)
				.filter((p): p is NonNullable<typeof p> => p !== null);

			const spentIds = await detectSpentUnretractedPledges(pledges, retractions);
			this.#spentPledgeIds = new Set(spentIds);

			// Auto-retract if the current user is the pledger
			if (this.#taskAddress) {
				for (const pledgeId of spentIds) {
					const pledge = pledges.find((p) => p.id === pledgeId);
					if (pledge) {
						await autoRetractSpentPledge(pledge, this.#taskAddress, hasSolutions);
					}
				}
			}
		}, 3000); // 3s debounce after data settles
	}

	/** Clean up all subscriptions */
	destroy() {
		this.#loadGeneration++;
		this.#rebuildVersion++;
		if (this.#projection) projectionRegistry.remove(`detail:${this.#projection.bountyAddress}`);
		this.#combinedSub?.unsubscribe();
		this.#combinedSub = null;
		if (this.#spentCheckTimer) {
			clearTimeout(this.#spentCheckTimer);
			this.#spentCheckTimer = null;
		}
		if (this.#loadingTimer) {
			clearTimeout(this.#loadingTimer);
			this.#loadingTimer = null;
		}
		for (const sub of this.#relaySubs) {
			sub.unsubscribe();
		}
		this.#relaySubs = [];
		this.#projection = null;
		this.#relatedEventsComplete = false;
		this.#stale = false;
		this.#events = { pledges: [], solutions: [], votes: [], payouts: [], retractions: [] };
	}
}
