import type { CashuTokenVerification, PledgeVerification, ProofIdentity } from '$lib/cashu/types';
import { normalizeMintUrl } from '$lib/cashu/proof-identity';
import { nut11KeyMatchesXOnly } from '$lib/cashu/p2pk';
import type { Payout, PayoutValidation, Pledge, Solution } from './types';

export interface PayoutValidationContext {
	bountyAddress: string;
	bountyMint: string;
	winner: Solution | null;
	activePledgesById: ReadonlyMap<string, Pledge>;
	payoutTokenVerifications: ReadonlyMap<string, CashuTokenVerification>;
	pledgeVerifications: ReadonlyMap<string, PledgeVerification>;
	alreadyReleasedPledgeIds: ReadonlySet<string>;
	globalProofOwners: ReadonlyMap<ProofIdentity, string | null>;
	globalProofSetComplete: boolean;
	now: number;
}

/** Validate one payout without allowing it to select or redirect the winner. */
export function validatePayout(payout: Payout, context: PayoutValidationContext): PayoutValidation {
	const reasons: string[] = [];
	const sourcePledge = payout.sourcePledgeId
		? context.activePledgesById.get(payout.sourcePledgeId)
		: undefined;
	const token = context.payoutTokenVerifications.get(payout.id);
	const sourceVerification = payout.sourcePledgeId
		? context.pledgeVerifications.get(payout.sourcePledgeId)
		: undefined;

	if (!context.winner) reasons.push('consensus_not_unique');
	if (!payout.paymentPubkey) reasons.push('missing_payment_key');
	if (!payout.sourcePledgeId) reasons.push('missing_source_pledge');
	else if (!sourcePledge) reasons.push('unknown_or_inactive_source_pledge');
	if (payout.bountyAddress !== context.bountyAddress) reasons.push('wrong_bounty');
	if (sourcePledge) {
		if (sourcePledge.bountyAddress !== context.bountyAddress) reasons.push('wrong_bounty');
		if (payout.pubkey !== sourcePledge.pubkey) reasons.push('unauthorized_source_owner');
		if (payout.amount !== sourcePledge.amount) reasons.push('source_amount_mismatch');
	}
	if (!sourceVerification || !sourceVerification.issuanceAuthentic) {
		reasons.push('source_issuance_unverified');
	} else if (sourceVerification.proofState !== 'spent') {
		reasons.push('source_not_spent');
	}
	if (context.winner) {
		if (payout.solutionId !== context.winner.id) reasons.push('wrong_solution');
		if (payout.solverPubkey !== context.winner.pubkey) reasons.push('wrong_recipient');
		if (!context.winner.paymentPubkey) reasons.push('winner_missing_payment_key');
		if (payout.paymentPubkey && payout.paymentPubkey !== context.winner.paymentPubkey) {
			reasons.push('payment_key_mismatch');
		}
	}
	if (!Number.isSafeInteger(payout.amount) || payout.amount <= 0) reasons.push('invalid_amount');
	if (payout.sourcePledgeId && context.alreadyReleasedPledgeIds.has(payout.sourcePledgeId)) {
		reasons.push('duplicate_source_payout');
	}

	try {
		const payoutMint = payout.mintUrl ? normalizeMintUrl(payout.mintUrl) : null;
		const sourceMint = sourcePledge ? normalizeMintUrl(sourcePledge.mintUrl) : null;
		const bountyMint = normalizeMintUrl(context.bountyMint);
		if (!payoutMint || !sourceMint || payoutMint !== sourceMint || sourceMint !== bountyMint) {
			reasons.push('mint_mismatch');
		}
		if (token && token.normalizedMint !== payoutMint) reasons.push('token_mint_mismatch');
	} catch {
		reasons.push('mint_mismatch');
	}

	if (!token) {
		reasons.push('missing_token_verification');
	} else {
		if (!token.issuanceAuthentic) reasons.push('token_issuance_unverified');
		if (token.decodedAmount !== payout.amount) reasons.push('token_amount_mismatch');
		if (context.winner?.paymentPubkey) {
			try {
				if (
					!token.p2pkTarget ||
					!nut11KeyMatchesXOnly(token.p2pkTarget, context.winner.paymentPubkey)
				) {
					reasons.push('token_target_mismatch');
				}
			} catch {
				reasons.push('token_target_mismatch');
			}
		}
		if (
			!context.globalProofSetComplete ||
			token.proofIdentities.some(
				(identity) => context.globalProofOwners.get(identity) !== payout.id
			)
		) {
			reasons.push('globally_replayed_proof');
		}
		if (
			sourceVerification &&
			token.proofIdentities.some((identity) =>
				sourceVerification.proofIdentities.includes(identity)
			)
		) {
			reasons.push('source_output_proof_overlap');
		}
	}

	const unavailable =
		!token ||
		token.status === 'pending' ||
		token.status === 'unavailable' ||
		token.validUntil === null ||
		token.validUntil <= context.now;
	const structuralReasons = reasons.filter((reason) => reason !== 'missing_token_verification');
	const status =
		structuralReasons.length > 0 ? 'invalid' : unavailable ? 'unavailable' : token.status;

	return {
		payout,
		status: status === 'valid' ? 'valid' : status === 'unavailable' ? 'unavailable' : 'invalid',
		sourcePledgeId: payout.sourcePledgeId,
		reasons: [...new Set(reasons)]
	};
}
