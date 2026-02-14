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
 * 1. cancelled — if any delete events reference this bounty
 * 2. completed — if any payout events exist
 * 3. expired   — if the expiration tag is in the past
 * 4. in_review — if any solution events exist
 * 5. open      — published bounty (default for any bounty on relays)
 */
export function deriveBountyStatus(
	bountyEvent: NostrEvent,
	pledges: NostrEvent[],
	solutions: NostrEvent[],
	payouts: NostrEvent[],
	deleteEvents: NostrEvent[],
	now?: number
): BountyStatus {
	const currentTime = now ?? Math.floor(Date.now() / 1000);

	// 1. Cancelled — delete events exist
	if (deleteEvents.length > 0) {
		return 'cancelled';
	}

	// 2. Completed — payout events exist
	if (payouts.length > 0) {
		return 'completed';
	}

	// 3. Expired — expiration tag is in the past
	const expiration = getExpiration(bountyEvent);
	if (expiration !== null && expiration <= currentTime) {
		return 'expired';
	}

	// 4. In review — solution events exist
	if (solutions.length > 0) {
		return 'in_review';
	}

	// 5. Open — published bounty (with or without pledges)
	return 'open';
}
