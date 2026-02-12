import type { Vote, VoteTally } from './types';

/** Quorum threshold as a fraction of total pledged sats */
const QUORUM_FRACTION = 0.5;

/**
 * Calculate the voting weight for a given pledge amount.
 * Linear weighting: weight equals the pledge amount in sats.
 * Returns 0 for zero or negative amounts.
 */
export function calculateVoteWeight(pledgeAmountSats: number): number {
	return pledgeAmountSats > 0 ? pledgeAmountSats : 0;
}

/**
 * Tally votes for a specific solution.
 *
 * Rules:
 * - Deduplicate: if a pubkey voted multiple times, only the latest vote counts
 * - Non-pledger votes are ignored (pubkey must exist in pledgesByPubkey)
 * - Linear weighting: vote weight = pledge amount
 * - Quorum = totalPledgedSats * 0.5
 * - isApproved: approveWeight > rejectWeight AND approveWeight >= quorum
 * - isRejected: rejectWeight > approveWeight AND rejectWeight >= quorum
 */
export function tallyVotes(
	votes: Vote[],
	pledgesByPubkey: Map<string, number>,
	totalPledgedSats: number
): VoteTally {
	// Handle edge case: no total pledged
	if (totalPledgedSats <= 0) {
		return {
			approveWeight: 0,
			rejectWeight: 0,
			quorum: 0,
			isApproved: false,
			isRejected: false,
			quorumPercent: 0
		};
	}

	const quorum = totalPledgedSats * QUORUM_FRACTION;

	// Deduplicate: keep only the latest vote per pubkey (highest created_at)
	const latestVoteByPubkey = new Map<string, Vote>();
	for (const vote of votes) {
		const existing = latestVoteByPubkey.get(vote.pubkey);
		if (!existing || vote.createdAt > existing.createdAt) {
			latestVoteByPubkey.set(vote.pubkey, vote);
		}
	}

	let approveWeight = 0;
	let rejectWeight = 0;

	for (const vote of latestVoteByPubkey.values()) {
		// Non-pledger votes are ignored
		const pledgeAmount = pledgesByPubkey.get(vote.pubkey);
		if (pledgeAmount === undefined) continue;

		const weight = calculateVoteWeight(pledgeAmount);
		if (weight === 0) continue;

		if (vote.choice === 'approve') {
			approveWeight += weight;
		} else {
			rejectWeight += weight;
		}
	}

	const totalVoteWeight = approveWeight + rejectWeight;
	const quorumPercent = totalPledgedSats > 0 ? (totalVoteWeight / totalPledgedSats) * 100 : 0;

	return {
		approveWeight,
		rejectWeight,
		quorum,
		isApproved: approveWeight > rejectWeight && approveWeight >= quorum,
		isRejected: rejectWeight > approveWeight && rejectWeight >= quorum,
		quorumPercent
	};
}
