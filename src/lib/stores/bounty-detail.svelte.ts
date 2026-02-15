import type { Subscription } from 'rxjs';
import { combineLatest } from 'rxjs';
import type { NostrEvent } from 'nostr-tools';
import type { BountyDetail } from '$lib/bounty/types';
import { eventStore } from '$lib/nostr/event-store';
import { parseBountyDetail } from '$lib/bounty/helpers';
import { PLEDGE_KIND, SOLUTION_KIND, VOTE_KIND, PAYOUT_KIND, RETRACTION_KIND } from '$lib/bounty/kinds';
import { parseRetraction } from '$lib/bounty/helpers';
import type { Retraction } from '$lib/bounty/types';
import { pool } from '$lib/nostr/relay-pool';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import { getDefaultRelays } from '$lib/utils/env';
import { createPledgeLoader } from '$lib/nostr/loaders/pledge-loader';
import { createSolutionLoader } from '$lib/nostr/loaders/solution-loader';
import { createVoteLoader } from '$lib/nostr/loaders/vote-loader';
import { createProfileLoader } from '$lib/nostr/loaders/profile-loader';
import { detectSpentUnretractedPledges, autoRetractSpentPledge } from '$lib/cashu/pledge-monitor.svelte';
import { parsePledge } from '$lib/bounty/helpers';

/**
 * Reactive store for a single bounty's full detail.
 * Subscribes to multiple EventStore timelines and composes them
 * into a single BountyDetail object.
 */
export class BountyDetailStore {
	#bounty = $state<BountyDetail | null>(null);
	#loading = $state(true);
	#error = $state<string | null>(null);
	#retractions = $state<Retraction[]>([]);
	#retractedPledgeIds = $state<Set<string>>(new Set());
	/** Pledge IDs whose tokens are spent at the mint but have no retraction event yet */
	#spentPledgeIds = $state<Set<string>>(new Set());
	#combinedSub: Subscription | null = null;
	#relaySubs: Array<{ unsubscribe(): void }> = [];
	#spentCheckTimer: ReturnType<typeof setTimeout> | null = null;
	#taskAddress: string | null = null;

	/** The full bounty detail, or null if not loaded */
	get bounty(): BountyDetail | null {
		return this.#bounty;
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
	load(bountyAddress: string, kind: number, pubkey: string, dTag: string) {
		this.destroy();
		this.#loading = true;
		this.#error = null;
		this.#taskAddress = bountyAddress;

		// Subscribe to EventStore timelines for all related event kinds
		const bounty$ = eventStore.replaceable(kind, pubkey, dTag);
		const pledges$ = eventStore.timeline({ kinds: [PLEDGE_KIND], '#a': [bountyAddress] });
		const solutions$ = eventStore.timeline({ kinds: [SOLUTION_KIND], '#a': [bountyAddress] });
		const votes$ = eventStore.timeline({ kinds: [VOTE_KIND], '#a': [bountyAddress] });
		const payouts$ = eventStore.timeline({ kinds: [PAYOUT_KIND], '#a': [bountyAddress] });
		const retractions$ = eventStore.timeline({ kinds: [RETRACTION_KIND], '#a': [bountyAddress] });

		this.#combinedSub = combineLatest([bounty$, pledges$, solutions$, votes$, payouts$, retractions$]).subscribe({
			next: ([bountyEvent, pledgeEvents, solutionEvents, voteEvents, payoutEvents, retractionEvents]: [
				NostrEvent | undefined,
				NostrEvent[],
				NostrEvent[],
				NostrEvent[],
				NostrEvent[],
				NostrEvent[]
			]) => {
				// Parse retractions
				const parsedRetractions = retractionEvents
					.map(parseRetraction)
					.filter((r): r is Retraction => r !== null);
				this.#retractions = parsedRetractions;

				// Track retracted pledge IDs
				const retractedIds = new Set<string>();
				for (const r of parsedRetractions) {
					if (r.type === 'pledge' && r.pledgeEventId) {
						retractedIds.add(r.pledgeEventId);
					}
				}
				this.#retractedPledgeIds = retractedIds;

				// Filter out retracted pledges
				const activePledgeEvents = pledgeEvents.filter(
					(e) => !retractedIds.has(e.id)
				);

				if (bountyEvent) {
					this.#bounty = parseBountyDetail(
						bountyEvent,
						activePledgeEvents,
						solutionEvents,
						voteEvents,
						payoutEvents,
						[] // delete events — legacy fallback
					);

					// Schedule spent-pledge detection (debounced — only after data settles)
					this.#scheduleSpentCheck(activePledgeEvents, parsedRetractions, solutionEvents.length > 0);
				}
				this.#loading = false;
			},
			error: (err: unknown) => {
				this.#error = err instanceof Error ? err.message : 'Failed to load bounty details';
				this.#loading = false;
			}
		});

		// Start relay loaders to feed events into EventStore
		this.#relaySubs.push(createPledgeLoader(bountyAddress));
		this.#relaySubs.push(createSolutionLoader(bountyAddress));
		this.#relaySubs.push(createVoteLoader(bountyAddress));
		this.#relaySubs.push(createProfileLoader([pubkey]));

		// Load retraction events from relays
		this.#loadRetractionsFromRelays(bountyAddress);

		// Also load the bounty event itself from relays via a direct subscription
		this.#loadBountyFromRelays(kind, pubkey, dTag);
	}

	#loadRetractionsFromRelays(bountyAddress: string) {
		const filter = { kinds: [RETRACTION_KIND], '#a': [bountyAddress] };
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

	#loadBountyFromRelays(kind: number, pubkey: string, dTag: string) {
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

	/**
	 * Schedule a spent-pledge check against the Cashu mint.
	 * Debounced to avoid hammering the mint on every EventStore update.
	 * When spent tokens are detected for the current user, auto-publishes
	 * retraction (and reputation) events to keep state in sync.
	 */
	#scheduleSpentCheck(pledgeEvents: NostrEvent[], retractions: Retraction[], hasSolutions: boolean) {
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
		this.#combinedSub?.unsubscribe();
		this.#combinedSub = null;
		if (this.#spentCheckTimer) {
			clearTimeout(this.#spentCheckTimer);
			this.#spentCheckTimer = null;
		}
		for (const sub of this.#relaySubs) {
			sub.unsubscribe();
		}
		this.#relaySubs = [];
	}
}
