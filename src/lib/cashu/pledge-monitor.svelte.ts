/**
 * Pledge token spendability monitor.
 *
 * Detects when pledge tokens have been spent at the mint (reclaimed by the
 * pledger outside the app) without a corresponding Kind 73005 retraction event.
 * When detected:
 *   - If the current user is the pledger → auto-publish retraction + reputation events
 *   - For any user → mark the pledge as "reclaimed" in the UI
 *
 * This ensures retraction state and token custody are always in sync,
 * regardless of whether the pledger used our UI or their Cashu wallet directly.
 */

import { tokenValidator } from './token-validator.svelte';
import { decodeToken } from './token';
import { getWallet } from './mint';
import { accountState } from '$lib/nostr/account.svelte';
import { publishEvent } from '$lib/nostr/signer.svelte';
import { retractionBlueprint, reputationBlueprint } from '$lib/bounty/blueprints';
import type { Pledge, Retraction } from '$lib/bounty/types';

/** Pledges whose tokens have been spent but no retraction event exists */
type SpentPledgeId = string;

/** Check interval for token spendability (30 seconds) */
const CHECK_INTERVAL_MS = 30_000;

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
		retractions
			.filter((r) => r.type === 'pledge' && r.pledgeEventId)
			.map((r) => r.pledgeEventId!)
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

/**
 * Auto-publish retraction (and reputation) events for a pledge the current
 * user reclaimed out-of-band.
 *
 * Only publishes if:
 * - The current user is the pledger
 * - No retraction event already exists for this pledge
 *
 * @returns true if events were published, false otherwise
 */
export async function autoRetractSpentPledge(
	pledge: Pledge,
	taskAddress: string,
	hasSolutions: boolean
): Promise<boolean> {
	const currentPubkey = accountState.pubkey;
	if (!currentPubkey || currentPubkey !== pledge.pubkey) return false;

	try {
		// Publish retraction event
		const template = retractionBlueprint({
			taskAddress,
			type: 'pledge',
			pledgeEventId: pledge.id,
			creatorPubkey: currentPubkey,
			reason: 'Tokens reclaimed — automatic retraction'
		});

		const { event: signed } = await publishEvent(template);

		// If solutions exist, publish reputation event
		if (hasSolutions) {
			const repTemplate = reputationBlueprint({
				offenderPubkey: currentPubkey,
				taskAddress,
				type: 'pledge_retraction',
				retractionEventId: signed.id,
				description: 'Retracted pledge after solutions were submitted (auto-detected from token reclaim)'
			});
			await publishEvent(repTemplate);
		}

		return true;
	} catch (err) {
		console.error('[pledge-monitor] Auto-retraction failed:', err);
		return false;
	}
}
