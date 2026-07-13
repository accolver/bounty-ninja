import type { FinancialProjection } from '$lib/bounty/types';

export type ReputationTier = 'new' | 'emerging' | 'established' | 'trusted' | 'flagged';

export interface ReputationScore {
	bountiesCompleted: number;
	pledgesReleased: number;
	totalPledges: number;
	releaseRate: number;
	solutionsAccepted: number;
	bountyRetractions: number;
	pledgeRetractions: number;
	satsEarned: number;
	satsReleased: number;
	recentActivityAt: number | null;
	tier: ReputationTier;
}

export type ReputationProjection = Pick<
	FinancialProjection,
	| 'bountyAddress'
	| 'projectedAt'
	| 'validatedPledges'
	| 'consensus'
	| 'authorizedRetractions'
	| 'validPayouts'
	| 'releaseProgress'
>;

function creatorFromAddress(address: string): string | null {
	const parts = address.split(':');
	return parts.length >= 3 && parts[0] === '37300' ? parts[1] : null;
}

/** Derive reputation exclusively from trusted, source-bound financial projections. */
export function deriveReputation(
	pubkey: string,
	projections: readonly ReputationProjection[]
): ReputationScore {
	const latestByBounty = new Map<string, ReputationProjection>();
	for (const projection of projections) {
		const existing = latestByBounty.get(projection.bountyAddress);
		if (!existing || projection.projectedAt > existing.projectedAt) {
			latestByBounty.set(projection.bountyAddress, projection);
		}
	}

	const pledgeIds = new Set<string>();
	const releasedPledgeIds = new Set<string>();
	const bountyRetractionIds = new Set<string>();
	const pledgeRetractionIds = new Set<string>();
	let bountiesCompleted = 0;
	let solutionsAccepted = 0;
	let satsEarned = 0;
	let satsReleased = 0;
	let recentActivityAt: number | null = null;

	for (const projection of latestByBounty.values()) {
		for (const pledge of projection.validatedPledges) {
			if (pledge.pubkey !== pubkey) continue;
			pledgeIds.add(pledge.id);
			if (Number.isFinite(pledge.createdAt)) {
				recentActivityAt = Math.max(recentActivityAt ?? 0, pledge.createdAt);
			}
		}
		for (const payout of projection.validPayouts) {
			if (payout.pubkey === pubkey && payout.sourcePledgeId) {
				releasedPledgeIds.add(payout.sourcePledgeId);
				satsReleased += payout.amount;
			}
			if (payout.solverPubkey === pubkey) satsEarned += payout.amount;
			if (
				(payout.pubkey === pubkey || payout.solverPubkey === pubkey) &&
				Number.isFinite(payout.createdAt)
			) {
				recentActivityAt = Math.max(recentActivityAt ?? 0, payout.createdAt);
			}
		}
		if (projection.releaseProgress.complete) {
			if (creatorFromAddress(projection.bountyAddress) === pubkey) bountiesCompleted++;
			if (
				projection.consensus.state === 'unique' &&
				projection.consensus.winner.pubkey === pubkey
			) {
				solutionsAccepted++;
			}
		}
		for (const retraction of projection.authorizedRetractions) {
			if (retraction.pubkey !== pubkey) continue;
			if (retraction.type === 'bounty') bountyRetractionIds.add(retraction.id);
			else pledgeRetractionIds.add(retraction.id);
			if (Number.isFinite(retraction.createdAt)) {
				recentActivityAt = Math.max(recentActivityAt ?? 0, retraction.createdAt);
			}
		}
	}

	const totalPledges = pledgeIds.size;
	const pledgesReleased = [...releasedPledgeIds].filter((id) => pledgeIds.has(id)).length;
	const releaseRate = totalPledges > 0 ? pledgesReleased / totalPledges : 1;
	const bountyRetractions = bountyRetractionIds.size;
	const pledgeRetractions = pledgeRetractionIds.size;
	const totalRetractions = bountyRetractions + pledgeRetractions;
	const totalCompletions = bountiesCompleted + pledgesReleased + solutionsAccepted;
	const totalInteractions = totalCompletions + totalRetractions;

	let tier: ReputationTier = 'new';
	if (totalRetractions > totalCompletions) tier = 'flagged';
	else if (totalInteractions >= 25 && releaseRate > 0.95 && bountyRetractions === 0)
		tier = 'trusted';
	else if (totalInteractions >= 10 && releaseRate > 0.9) tier = 'established';
	else if (totalInteractions >= 3 && totalRetractions === 0) tier = 'emerging';

	return {
		bountiesCompleted,
		pledgesReleased,
		totalPledges,
		releaseRate,
		solutionsAccepted,
		bountyRetractions,
		pledgeRetractions,
		satsEarned,
		satsReleased,
		recentActivityAt,
		tier
	};
}
