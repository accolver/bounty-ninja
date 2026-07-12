import type { ProofState } from '@cashu/cashu-ts';
import type { Pledge } from '$lib/bounty/types';
import type {
	PledgeInvalidReason,
	PledgeVerification,
	ProofIdentity,
	TokenInfo,
	VerificationStatus
} from './types';
import { getCashu } from './lazy';
import { normalizeMintUrl } from './proof-identity';
import { nut11KeyMatchesXOnly } from './p2pk';

export const PLEDGE_VERIFICATION_POLICY_VERSION = 1;

export interface P2PKProofCondition {
	target: string;
	refundKeys: readonly string[];
	locktime: number | null;
	nSigs: number;
	nSigsRefund: number;
	sigFlag: string;
}

export interface PledgeValidationInput {
	pledge: Pledge;
	bountyAddress: string;
	bountyMint: string;
	decoded: TokenInfo | null;
	proofStates: readonly ProofState[] | null;
	proofIdentities: readonly ProofIdentity[];
	duplicateProofs: ReadonlySet<ProofIdentity>;
	conditions: readonly (P2PKProofCondition | null)[];
	checkedAt: number;
	validUntil: number | null;
	mintUnavailable?: boolean;
	nut11Supported?: boolean;
}

function sortedKeys(keys: readonly string[]): string[] {
	return [...keys].map((key) => key.toLowerCase()).sort();
}

function result(
	input: PledgeValidationInput,
	status: VerificationStatus,
	reasons: readonly PledgeInvalidReason[],
	normalizedMint: string | null,
	decodedAmount: number | null
): PledgeVerification {
	return {
		pledgeId: input.pledge.id,
		status,
		policyVersion: PLEDGE_VERIFICATION_POLICY_VERSION,
		checkedAt: input.checkedAt,
		validUntil: input.validUntil,
		normalizedMint,
		decodedAmount,
		proofIdentities: input.proofIdentities,
		reasons
	};
}

/** Pure, fail-closed pledge policy. Mint and token I/O are supplied by the caller. */
export function validatePledge(input: PledgeValidationInput): PledgeVerification {
	const reasons: PledgeInvalidReason[] = [];
	const { decoded, pledge } = input;

	if (pledge.bountyAddress !== input.bountyAddress) reasons.push('wrong_bounty');
	if (!decoded) return result(input, 'invalid', [...reasons, 'decode_failed'], null, null);
	if (decoded.unit !== 'sat') reasons.push('wrong_unit');
	if (decoded.proofs.length === 0) reasons.push('missing_proofs');
	if (!Number.isSafeInteger(pledge.amount) || pledge.amount <= 0) reasons.push('invalid_amount');
	if (!Number.isSafeInteger(decoded.amount) || decoded.amount <= 0) reasons.push('invalid_amount');
	if (decoded.proofs.some((proof) => !Number.isSafeInteger(proof.amount) || proof.amount <= 0)) {
		reasons.push('invalid_amount');
	}
	const proofSum = decoded.proofs.reduce((sum, proof) => sum + proof.amount, 0);
	if (decoded.amount !== pledge.amount || proofSum !== decoded.amount)
		reasons.push('amount_mismatch');

	let normalizedMint: string | null = null;
	try {
		const tokenMint = normalizeMintUrl(decoded.mint);
		const eventMint = normalizeMintUrl(pledge.mintUrl);
		const bountyMint = normalizeMintUrl(input.bountyMint);
		normalizedMint = tokenMint;
		if (tokenMint !== eventMint || eventMint !== bountyMint) reasons.push('mint_mismatch');
	} catch {
		reasons.push('mint_mismatch');
	}

	if (input.mintUnavailable || input.proofStates === null) {
		reasons.push('mint_unavailable');
	} else {
		if (input.proofStates.length !== decoded.proofs.length) reasons.push('proof_state_mismatch');
		if (input.proofStates.some((state) => state.state === 'SPENT')) reasons.push('spent_proof');
		if (input.proofStates.some((state) => state.state === 'PENDING')) {
			reasons.push('pending_proof');
		}
	}
	if (input.nut11Supported === false) reasons.push('nut11_unsupported');

	if (input.proofIdentities.length !== decoded.proofs.length) reasons.push('proof_state_mismatch');
	const identities = new Set(input.proofIdentities);
	if (
		identities.size !== input.proofIdentities.length ||
		input.proofIdentities.some((identity) => input.duplicateProofs.has(identity))
	) {
		reasons.push('duplicate_proof');
	}

	if (input.conditions.length !== decoded.proofs.length) reasons.push('not_p2pk');
	if (input.conditions.some((condition) => condition === null)) reasons.push('not_p2pk');
	const conditions = input.conditions.filter((item): item is P2PKProofCondition => item !== null);
	if (!pledge.paymentPubkey) reasons.push('missing_payment_key');
	for (const condition of conditions) {
		try {
			if (!pledge.paymentPubkey || !nut11KeyMatchesXOnly(condition.target, pledge.paymentPubkey)) {
				reasons.push('p2pk_target_mismatch');
			}
		} catch {
			reasons.push('p2pk_target_mismatch');
		}
		if (condition.locktime !== null) reasons.push('locktime_mismatch');
		if (condition.refundKeys.length > 0) reasons.push('refund_policy_mismatch');
		if (
			!Number.isSafeInteger(condition.nSigs) ||
			condition.nSigs < 1 ||
			condition.sigFlag !== 'SIG_INPUTS'
		) {
			reasons.push('signature_policy_mismatch');
		}
	}
	const fingerprints = new Set(
		conditions.map((condition) =>
			JSON.stringify({
				...condition,
				target: condition.target.toLowerCase(),
				refundKeys: sortedKeys(condition.refundKeys)
			})
		)
	);
	if (fingerprints.size > 1) reasons.push('inconsistent_proof_conditions');

	const uniqueReasons = [...new Set(reasons)];
	const invalidReasons = uniqueReasons.filter(
		(reason) => reason !== 'mint_unavailable' && reason !== 'pending_proof'
	);
	const status: VerificationStatus =
		invalidReasons.length > 0 ? 'invalid' : uniqueReasons.length > 0 ? 'unavailable' : 'valid';
	return result(input, status, uniqueReasons, normalizedMint, decoded.amount);
}

/** Inspect NUT-11 conditions without hand-parsing proof secret JSON. */
export async function inspectP2PKProof(secret: string): Promise<P2PKProofCondition | null> {
	try {
		const {
			getP2PKLocktime,
			getP2PKWitnessRefundkeys,
			getP2PKSigFlag,
			getTagInt,
			getSecretData,
			getSecretKind
		} = await getCashu();
		if (getSecretKind(secret) !== 'P2PK') return null;
		const locktime = getP2PKLocktime(secret);
		return {
			target: getSecretData(secret).data,
			refundKeys: getP2PKWitnessRefundkeys(secret),
			locktime: Number.isFinite(locktime) ? locktime : null,
			nSigs: getTagInt(secret, 'n_sigs') ?? 1,
			nSigsRefund: getTagInt(secret, 'n_sigs_refund') ?? 1,
			sigFlag: getP2PKSigFlag(secret)
		};
	} catch {
		return null;
	}
}
