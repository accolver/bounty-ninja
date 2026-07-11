import type { ProofIdentity } from '$lib/cashu/types';
import { compareEventOrder } from './event-order';
import { deriveConsensus } from './voting';
import { validatePayout } from './payout-validation';
import {
	getBountyAddress,
	validateBountyRetraction,
	validatePledgeRetraction
} from './retraction-validation';
import type {
	BountyStatus,
	FinancialProjection,
	FinancialProjectionInput,
	Pledge,
	Retraction
} from './types';

export const FINANCIAL_PROJECTION_POLICY_VERSION = 1;

function deriveProjectedStatus(
	input: FinancialProjectionInput,
	cancelled: boolean,
	validatedFunding: number,
	solutionCount: number,
	consensusState: FinancialProjection['consensus']['state'],
	releasedCount: number,
	releaseComplete: boolean
): BountyStatus {
	if (cancelled) return 'cancelled';
	if (releaseComplete) return 'completed';
	if (input.bounty.deadline !== null && input.bounty.deadline <= input.now) return 'expired';
	if (validatedFunding === 0) return 'draft';
	if (releasedCount > 0) return 'releasing';
	if (consensusState === 'unique') return 'consensus_reached';
	if (solutionCount > 0) return 'in_review';
	return 'open';
}

function isCurrentVerification(
	verification: FinancialProjectionInput['pledgeVerifications'] extends ReadonlyMap<string, infer V>
		? V
		: never,
	now: number
): boolean {
	return (
		verification.status === 'valid' &&
		verification.validUntil !== null &&
		verification.validUntil > now
	);
}

/** Project one bounty from structurally parsed events plus explicit verification records. */
export function projectFinancialState(input: FinancialProjectionInput): FinancialProjection {
	const bountyAddress = getBountyAddress(input.bounty);
	const pendingPledges: Pledge[] = [];
	const unavailablePledges: Pledge[] = [];
	const invalidPledges: Pledge[] = [];
	const validatedPledges: Pledge[] = [];
	const proofOwners = new Map<ProofIdentity, string>();

	const sameBountyPledges = input.pledges
		.filter((pledge) => pledge.bountyAddress === bountyAddress)
		.sort(compareEventOrder);
	for (const pledge of sameBountyPledges) {
		const verification = input.pledgeVerifications.get(pledge.id);
		if (!verification || verification.status === 'pending') {
			pendingPledges.push(pledge);
			continue;
		}
		if (verification.status === 'invalid' || verification.pledgeId !== pledge.id) {
			invalidPledges.push(pledge);
			continue;
		}
		if (verification.status === 'unavailable' || !isCurrentVerification(verification, input.now)) {
			unavailablePledges.push(pledge);
			continue;
		}
		if (verification.proofIdentities.some((identity) => proofOwners.has(identity))) {
			invalidPledges.push(pledge);
			continue;
		}
		validatedPledges.push(pledge);
		for (const identity of verification.proofIdentities) proofOwners.set(identity, pledge.id);
	}

	const pledgesById = new Map(sameBountyPledges.map((pledge) => [pledge.id, pledge]));
	const authorizedRetractions: Retraction[] = [];
	const retractedPledgeIds = new Set<string>();
	let cancelled = false;
	for (const retraction of [...input.retractions].sort(compareEventOrder)) {
		if (retraction.type === 'bounty') {
			if (validateBountyRetraction(retraction, input.bounty).valid) {
				authorizedRetractions.push(retraction);
				cancelled = true;
			}
			continue;
		}
		const pledge = retraction.pledgeEventId ? pledgesById.get(retraction.pledgeEventId) : undefined;
		if (pledge && validatePledgeRetraction(retraction, pledge, bountyAddress).valid) {
			authorizedRetractions.push(retraction);
			retractedPledgeIds.add(pledge.id);
		}
	}

	const activePledges = validatedPledges.filter((pledge) => !retractedPledgeIds.has(pledge.id));
	const validatedFunding = activePledges.reduce((sum, pledge) => sum + pledge.amount, 0);
	const votingPowerByPubkey = new Map<string, number>();
	for (const pledge of activePledges) {
		votingPowerByPubkey.set(
			pledge.pubkey,
			(votingPowerByPubkey.get(pledge.pubkey) ?? 0) + pledge.amount
		);
	}

	const solutions = input.solutions
		.filter((solution) => solution.bountyAddress === bountyAddress)
		.sort(compareEventOrder);
	const solutionIds = new Set(solutions.map((solution) => solution.id));
	const votes = input.votes.filter(
		(vote) => vote.bountyAddress === bountyAddress && solutionIds.has(vote.solutionId)
	);
	const consensus = deriveConsensus(
		solutions,
		votes,
		votingPowerByPubkey,
		validatedFunding,
		input.relatedEventsComplete
	);
	const requiredPledgeIds = new Set(activePledges.map((pledge) => pledge.id));
	const activePledgesById = new Map(activePledges.map((pledge) => [pledge.id, pledge]));
	const validPayouts = [];
	const payoutValidations = [];
	const releasedPledgeIds = new Set<string>();
	const winner = consensus.state === 'unique' ? consensus.winner : null;
	for (const payout of [...input.payouts].sort(compareEventOrder)) {
		const validation = validatePayout(payout, {
			bountyAddress,
			bountyMint: input.bounty.mintUrl ?? '',
			winner,
			activePledgesById,
			payoutTokenVerifications: input.payoutTokenVerifications,
			alreadyReleasedPledgeIds: releasedPledgeIds,
			now: input.now
		});
		payoutValidations.push(validation);
		if (validation.status === 'valid' && validation.sourcePledgeId) {
			validPayouts.push(payout);
			releasedPledgeIds.add(validation.sourcePledgeId);
		}
	}
	const releasedAmount = validPayouts.reduce((sum, payout) => sum + payout.amount, 0);
	const releaseComplete =
		requiredPledgeIds.size > 0 && releasedPledgeIds.size === requiredPledgeIds.size;
	const releaseProgress = {
		requiredPledgeIds,
		releasedPledgeIds,
		releasedAmount,
		totalAmount: validatedFunding,
		complete: releaseComplete
	};

	return {
		policyVersion: FINANCIAL_PROJECTION_POLICY_VERSION,
		projectedAt: input.now,
		bountyAddress,
		validatedPledges,
		activePledges,
		pendingPledges,
		unavailablePledges,
		invalidPledges,
		proofOwners,
		validatedFunding,
		votingPowerByPubkey,
		solutions,
		consensus,
		authorizedRetractions,
		validPayouts,
		payoutValidations,
		releaseProgress,
		cancelled,
		status: deriveProjectedStatus(
			input,
			cancelled,
			validatedFunding,
			solutions.length,
			consensus.state,
			releasedPledgeIds.size,
			releaseComplete
		)
	};
}
