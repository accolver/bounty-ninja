import type { NostrEvent } from 'nostr-tools';
import type { BountyStatus } from './types';

/**
 * Extract the expiration timestamp from a bounty event's 'expiration' tag.
 * Returns null if the tag is missing or malformed.
 */
function getExpiration(event: NostrEvent): number | null {
	const tag = event.tags.find((t) => t[0] === 'expiration');
	if (!tag?.[1]) return null;
	const value = parseInt(tag[1], 10);
	return Number.isNaN(value) ? null : value;
}

/**
 * Derive the current status of a bounty from its event and related events.
 *
 * Priority order (highest to lowest):
 * 1. cancelled          — if any delete events reference this bounty
 * 2. completed          — if payout events exist AND (NOT hasConsensus OR deadline passed)
 * 3. expired            — if the expiration tag is in the past AND no payouts
 * 4. releasing          — if payout events exist AND hasConsensus is true
 * 5. consensus_reached  — if hasConsensus is true AND no payouts AND not expired
 * 6. in_review          — if any solution events exist
 * 7. open               — published bounty (default for any bounty on relays)
 *
 * @param hasConsensus - Whether vote quorum (66%) has been reached for any solution.
 */
export function deriveBountyStatus(
	bountyEvent: NostrEvent,
	pledges: NostrEvent[],
	solutions: NostrEvent[],
	payouts: NostrEvent[],
	deleteEvents: NostrEvent[],
	now?: number,
	hasConsensus: boolean = false
): BountyStatus {
	const currentTime = now ?? Math.floor(Date.now() / 1000);

	// 1. Cancelled — delete events exist
	if (deleteEvents.length > 0) {
		return 'cancelled';
	}

	// 2. Completed — payouts exist AND consensus not active (final state)
	if (payouts.length > 0 && !hasConsensus) {
		return 'completed';
	}

	// 3. Expired — expiration tag is in the past AND no payouts
	const expiration = getExpiration(bountyEvent);
	if (expiration !== null && expiration <= currentTime && payouts.length === 0) {
		return 'expired';
	}

	// 4. Releasing — payouts exist AND consensus is active (not all pledgers released yet)
	if (payouts.length > 0 && hasConsensus) {
		return 'releasing';
	}

	// 5. Consensus reached — vote quorum met, no payouts yet
	if (hasConsensus && payouts.length === 0) {
		return 'consensus_reached';
	}

	// 6. In review — solution events exist
	if (solutions.length > 0) {
		return 'in_review';
	}

	// 7. Open — published bounty (with or without pledges)
	return 'open';
}
