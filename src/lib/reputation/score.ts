import type { NostrEvent } from 'nostr-tools';
import { PAYOUT_KIND, PLEDGE_KIND, REPUTATION_KIND } from '$lib/bounty/kinds';

export type ReputationTier = 'new' | 'emerging' | 'established' | 'trusted' | 'flagged';

export interface ReputationScore {
	bountiesCompleted: number;
	pledgesReleased: number;
	totalPledges: number;
	releaseRate: number;
	solutionsAccepted: number;
	bountyRetractions: number;
	pledgeRetractions: number;
	tier: ReputationTier;
}

/**
 * Extract the first value for a given tag name from a Nostr event.
 */
function getTagValue(event: NostrEvent, tagName: string): string | undefined {
	const tag = event.tags.find((t) => t[0] === tagName);
	return tag?.[1];
}

/**
 * Derive a reputation score for a pubkey from on-chain events.
 *
 * @param pubkey - The pubkey to compute reputation for
 * @param payoutEvents - Kind 73004 payout events (all relevant)
 * @param reputationEvents - Kind 73006 reputation events targeting this pubkey
 * @param pledgeEvents - Kind 73002 pledge events by this pubkey
 */
export function deriveReputation(
	pubkey: string,
	payoutEvents: NostrEvent[],
	reputationEvents: NostrEvent[],
	pledgeEvents: NostrEvent[]
): ReputationScore {
	// Bounties completed: payouts where this pubkey created the bounty
	// (pubkey is the bounty creator, payout references their bounty)
	const bountiesCompleted = payoutEvents.filter((e) => {
		const aTag = getTagValue(e, 'a');
		return aTag?.includes(`:${pubkey}:`);
	}).length;

	// Pledges released: payouts where this pubkey is the payout publisher (pledger)
	const pledgesReleased = payoutEvents.filter((e) => e.pubkey === pubkey).length;

	// Total pledges by this pubkey
	const totalPledges = pledgeEvents.filter((e) => e.pubkey === pubkey).length;

	// Release rate
	const releaseRate = totalPledges > 0 ? pledgesReleased / totalPledges : 1;

	// Solutions accepted: payouts where this pubkey is the solver (p tag)
	const solutionsAccepted = payoutEvents.filter(
		(e) => getTagValue(e, 'p') === pubkey
	).length;

	// Count retractions from Kind 73006 events targeting this pubkey
	const targetingEvents = reputationEvents.filter(
		(e) => e.kind === REPUTATION_KIND && getTagValue(e, 'p') === pubkey
	);
	const bountyRetractions = targetingEvents.filter(
		(e) => getTagValue(e, 'type') === 'bounty_retraction'
	).length;
	const pledgeRetractions = targetingEvents.filter(
		(e) => getTagValue(e, 'type') === 'pledge_retraction'
	).length;

	const totalRetractions = bountyRetractions + pledgeRetractions;
	const totalCompletions = bountiesCompleted + pledgesReleased + solutionsAccepted;
	const totalInteractions = totalCompletions + totalRetractions;

	// Derive tier
	let tier: ReputationTier = 'new';

	if (totalRetractions > 0 && totalRetractions > totalCompletions) {
		tier = 'flagged';
	} else if (
		totalInteractions >= 25 &&
		releaseRate > 0.95 &&
		bountyRetractions === 0
	) {
		tier = 'trusted';
	} else if (totalInteractions >= 10 && releaseRate > 0.9) {
		tier = 'established';
	} else if (totalInteractions >= 3 && totalRetractions === 0) {
		tier = 'emerging';
	}

	return {
		bountiesCompleted,
		pledgesReleased,
		totalPledges,
		releaseRate,
		solutionsAccepted,
		bountyRetractions,
		pledgeRetractions,
		tier
	};
}
