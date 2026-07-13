/**
 * Pledge token spendability monitor.
 *
 * Detects when pledge tokens have been spent at the mint without a corresponding
 * Kind 7305 retraction event.
 * Spend state is informational only. It never implies reclaim or authorizes a
 * retraction because a legitimate release consumes the same source proofs.
 */

import { decodeToken } from './token';
import { getWallet } from './mint';
import type { Pledge, Retraction } from '$lib/bounty/types';

/** Pledges whose tokens have been spent but no retraction event exists */
type SpentPledgeId = string;

/**
 * Check if a pledge's tokens have been spent at the mint.
 *
 * This is a direct mint query — more authoritative than the cached
 * token validator status. Returns true if ALL proofs are spent.
 */
async function areTokensSpent(cashuToken: string, mintUrl: string): Promise<boolean> {
	try {
		const tokenInfo = await decodeToken(cashuToken);
		if (!tokenInfo || tokenInfo.proofs.length === 0) return false;

		const wallet = await getWallet(mintUrl);
		const states = await wallet.checkProofsStates(tokenInfo.proofs);
		return states.every((s) => s.state === 'SPENT');
	} catch {
		// Can't reach mint — assume not spent (fail-safe)
		return false;
	}
}

/**
 * Detect pledges whose tokens are spent but have no retraction event.
 *
 * @param pledges - Active pledges for a bounty
 * @param retractions - Known retraction events for this bounty
 * @returns Array of pledge IDs that are spent but unretracted
 */
export async function detectSpentUnretractedPledges(
	pledges: Pledge[],
	retractions: Retraction[]
): Promise<SpentPledgeId[]> {
	const retractedIds = new Set(
		retractions.filter((r) => r.type === 'pledge' && r.pledgeEventId).map((r) => r.pledgeEventId!)
	);

	const spentUnretracted: SpentPledgeId[] = [];

	for (const pledge of pledges) {
		// Skip already-retracted pledges
		if (retractedIds.has(pledge.id)) continue;

		// Check if tokens are spent at the mint
		const spent = await areTokensSpent(pledge.cashuToken, pledge.mintUrl);
		if (spent) {
			spentUnretracted.push(pledge.id);
		}
	}

	return spentUnretracted;
}
