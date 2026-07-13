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
import { getDefaultMint, getDefaultRelays } from '$lib/utils/env';
import { createProfileLoader } from '$lib/nostr/loaders/profile-loader';
import { createBountyLoader } from '$lib/nostr/loaders/bounty-loader';
import { mergeRelayHints } from '$lib/nostr/relay-hints';
import { detectSpentUnretractedPledges } from '$lib/cashu/pledge-monitor.svelte';
import { parsePayout, parsePledge } from '$lib/bounty/helpers';
import {
	createGlobalProofOwnershipLoader,
	createRelatedEventsLoader
} from '$lib/nostr/loaders/related-events-loader';
import {
	buildGlobalProofOwnership,
	verifyPayoutsForBounty,
	verifyPledgesForBounty
} from '$lib/cashu/financial-verifier';
import { projectFinancialState } from '$lib/bounty/financial-state';
import { projectionRegistry } from '$lib/stores/projections.svelte';
import { loadCachedEvents } from '$lib/nostr/cache';
import { isConfiguredMint, normalizePublicHttpsUrl } from '$lib/utils/network-policy';

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
	#freshnessTimer: ReturnType<typeof setTimeout> | null = null;
	#relatedEventsComplete = false;
	#globalProofSetComplete = false;
	#rebuildVersion = 0;
	#loadGeneration = 0;
	#stale = $state(false);
	#allowUnknownMint = false;
	#unknownMintNeedsConsent = $state(false);
	#events: {
		bounty?: NostrEvent;
		pledges: NostrEvent[];
		solutions: NostrEvent[];
		votes: NostrEvent[];
		payouts: NostrEvent[];
		retractions: NostrEvent[];
		globalPledges: NostrEvent[];
		globalPayouts: NostrEvent[];
	} = {
		pledges: [],
		solutions: [],
		votes: [],
		payouts: [],
		retractions: [],
		globalPledges: [],
		globalPayouts: []
	};

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

	get unknownMintNeedsConsent(): boolean {
		return this.#unknownMintNeedsConsent;
	}

	grantMintConsent(): void {
		if (!this.#bounty?.mintUrl || !normalizePublicHttpsUrl(this.#bounty.mintUrl)) return;
		this.#allowUnknownMint = true;
		this.#unknownMintNeedsConsent = false;
		void this.#rebuild();
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
		this.#relatedEventsComplete = false;
		this.#globalProofSetComplete = false;
		this.#allowUnknownMint = false;
		this.#unknownMintNeedsConsent = false;
		if (typeof document !== 'undefined')
			document.addEventListener('visibilitychange', this.#onVisibility);

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
		const globalPledges$ = eventStore.timeline({ kinds: [PLEDGE_KIND] });
		const globalPayouts$ = eventStore.timeline({ kinds: [PAYOUT_KIND] });

		this.#combinedSub = combineLatest([
			bounty$,
			pledges$,
			solutions$,
			votes$,
			payouts$,
			retractions$,
			globalPledges$,
			globalPayouts$
		]).subscribe({
			next: ([
				bountyEvent,
				pledgeEvents,
				solutionEvents,
				voteEvents,
				payoutEvents,
				retractionEvents,
				globalPledgeEvents,
				globalPayoutEvents
			]: [
				NostrEvent | undefined,
				NostrEvent[],
				NostrEvent[],
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
					retractions: retractionEvents,
					globalPledges: globalPledgeEvents,
					globalPayouts: globalPayoutEvents
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
		this.#relaySubs.push(
			createGlobalProofOwnershipLoader(relayUrls, () => {
				this.#globalProofSetComplete = true;
				void this.#rebuild();
			})
		);
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
		const globalPledges = events.globalPledges
			.map(parsePledge)
			.filter((item): item is NonNullable<typeof item> => item !== null);
		const globalPayouts = events.globalPayouts
			.map((event) => parsePayout(event))
			.filter((item): item is NonNullable<typeof item> => item !== null);
		const globalProofOwners = await buildGlobalProofOwnership(globalPledges, globalPayouts);
		const configuredMint = isConfiguredMint(detail.mintUrl, getDefaultMint());
		const publicMint = detail.mintUrl ? normalizePublicHttpsUrl(detail.mintUrl) !== null : false;
		const allowMintContact = configuredMint || (publicMint && this.#allowUnknownMint);
		this.#unknownMintNeedsConsent = publicMint && !configuredMint && !this.#allowUnknownMint;
		const [pledgeVerifications, payoutTokenVerifications] = await Promise.all([
			verifyPledgesForBounty(detail, detail.pledges, undefined, allowMintContact),
			verifyPayoutsForBounty(detail, detail.payouts, undefined, allowMintContact)
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
			globalProofOwners,
			globalProofSetComplete: this.#globalProofSetComplete,
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
		this.#scheduleFreshnessRefresh(detail.deadline);
		if (this.#loadingTimer) {
			clearTimeout(this.#loadingTimer);
			this.#loadingTimer = null;
		}
		if (allowMintContact) {
			this.#scheduleSpentCheck(
				events.pledges,
				[...projection.authorizedRetractions],
				detail.mintUrl ?? ''
			);
		}
	}

	#scheduleFreshnessRefresh(deadline: number | null): void {
		if (this.#freshnessTimer) clearTimeout(this.#freshnessTimer);
		const nowMs = Date.now();
		const nextVerification = nowMs + 5 * 60 * 1000;
		const nextDeadline = deadline && deadline * 1000 > nowMs ? deadline * 1000 : nextVerification;
		this.#freshnessTimer = setTimeout(
			() => void this.#rebuild(),
			Math.max(100, Math.min(nextVerification, nextDeadline) - nowMs + 25)
		);
	}

	#onVisibility = () => {
		if (document.visibilityState === 'visible') void this.#rebuild();
	};

	/**
	 * Schedule a spent-pledge check against the Cashu mint.
	 * Debounced to avoid hammering the mint on every EventStore update.
	 * When spent tokens are detected for the current user, auto-publishes
	 * retraction (and reputation) events to keep state in sync.
	 */
	#scheduleSpentCheck(pledgeEvents: NostrEvent[], retractions: Retraction[], allowedMint: string) {
		if (this.#spentCheckTimer) clearTimeout(this.#spentCheckTimer);

		this.#spentCheckTimer = setTimeout(async () => {
			const pledges = pledgeEvents
				.map(parsePledge)
				.filter(
					(p): p is NonNullable<typeof p> =>
						p !== null &&
						normalizePublicHttpsUrl(p.mintUrl) === normalizePublicHttpsUrl(allowedMint)
				);

			const spentIds = await detectSpentUnretractedPledges(pledges, retractions);
			this.#spentPledgeIds = new Set(spentIds);

			// Never infer reclaim from spend state; release consumes the same proofs.
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
		if (this.#freshnessTimer) {
			clearTimeout(this.#freshnessTimer);
			this.#freshnessTimer = null;
		}
		for (const sub of this.#relaySubs) {
			sub.unsubscribe();
		}
		this.#relaySubs = [];
		this.#projection = null;
		this.#bounty = null;
		this.#retractions = [];
		this.#retractedPledgeIds = new Set();
		this.#spentPledgeIds = new Set();
		this.#unknownMintNeedsConsent = false;
		this.#relatedEventsComplete = false;
		this.#globalProofSetComplete = false;
		this.#stale = false;
		this.#events = {
			pledges: [],
			solutions: [],
			votes: [],
			payouts: [],
			retractions: [],
			globalPledges: [],
			globalPayouts: []
		};
		if (typeof document !== 'undefined')
			document.removeEventListener('visibilitychange', this.#onVisibility);
	}
}
