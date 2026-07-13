import type { ProofState } from '@cashu/cashu-ts';
import type { Pledge } from '$lib/bounty/types';
import type {
	PledgeInvalidReason,
	PledgeVerification,
	ProofIdentity,
	TokenInfo,
	VerificationStatus
} from './types';
import { normalizeMintUrl } from './proof-identity';
import { nut11KeyMatchesXOnly } from './p2pk';

export const PLEDGE_VERIFICATION_POLICY_VERSION = 1;

export interface P2PKProofCondition {
	target: string;
	primaryKeys: readonly string[];
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
	issuanceEvidence: readonly ('valid' | 'missing' | 'invalid')[];
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
		issuanceAuthentic:
			input.issuanceEvidence.length > 0 && input.issuanceEvidence.every((item) => item === 'valid'),
		proofState: deriveProofState(input.proofStates),
		reasons
	};
}

function deriveProofState(states: readonly ProofState[] | null): PledgeVerification['proofState'] {
	if (!states) return 'unavailable';
	const values = new Set(states.map((state) => state.state));
	if (values.size !== 1) return 'mixed';
	const state = states[0]?.state;
	return state === 'UNSPENT' ? 'unspent' : state === 'SPENT' ? 'spent' : 'pending';
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
		if (input.proofStates.some((state) => state.state === 'PENDING')) {
			reasons.push('pending_proof');
		}
	}
	if (input.nut11Supported === false) reasons.push('nut11_unsupported');
	if (input.issuanceEvidence.length !== decoded.proofs.length)
		reasons.push('issuance_evidence_missing');
	if (input.issuanceEvidence.some((evidence) => evidence === 'missing'))
		reasons.push('issuance_evidence_missing');
	if (input.issuanceEvidence.some((evidence) => evidence === 'invalid'))
		reasons.push('issuance_evidence_invalid');

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
		if (condition.primaryKeys.length !== 1) reasons.push('signature_policy_mismatch');
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
			condition.nSigs !== 1 ||
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

function parsePositiveInteger(value: string): number | null {
	if (!/^[1-9]\d*$/.test(value)) return null;
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) ? parsed : null;
}

/** Inspect the exact raw NUT-11 syntax without lossy accessor normalization. */
export async function inspectP2PKProof(secret: string): Promise<P2PKProofCondition | null> {
	try {
		const parsed: unknown = JSON.parse(secret);
		if (!Array.isArray(parsed) || parsed.length !== 2 || parsed[0] !== 'P2PK') return null;
		const payload = parsed[1];
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
		const record = payload as Record<string, unknown>;
		if (typeof record.data !== 'string' || record.data.length === 0) return null;
		if (record.tags !== undefined && !Array.isArray(record.tags)) return null;

		const tags = (record.tags ?? []) as unknown[];
		const values = new Map<string, string[]>();
		const knownTags = new Set([
			'pubkeys',
			'refund',
			'locktime',
			'n_sigs',
			'n_sigs_refund',
			'sigflag'
		]);
		for (const rawTag of tags) {
			if (
				!Array.isArray(rawTag) ||
				rawTag.length < 2 ||
				rawTag.some((value) => typeof value !== 'string')
			) {
				return null;
			}
			const [name, ...tagValues] = rawTag as string[];
			if (!name || !knownTags.has(name) || values.has(name)) return null;
			values.set(name, tagValues);
		}

		const singleValue = (name: string): string | null | undefined => {
			const tagValues = values.get(name);
			if (!tagValues) return undefined;
			return tagValues.length === 1 ? tagValues[0] : null;
		};
		const additionalKeys = values.get('pubkeys') ?? [];
		const refundKeys = values.get('refund') ?? [];
		if (
			(values.has('pubkeys') && additionalKeys.length === 0) ||
			(values.has('refund') && refundKeys.length === 0) ||
			new Set(additionalKeys).size !== additionalKeys.length ||
			new Set(refundKeys).size !== refundKeys.length ||
			additionalKeys.includes(record.data)
		) {
			return null;
		}

		const locktimeRaw = singleValue('locktime');
		const nSigsRaw = singleValue('n_sigs');
		const nSigsRefundRaw = singleValue('n_sigs_refund');
		const sigFlagRaw = singleValue('sigflag');
		if (
			locktimeRaw === null ||
			nSigsRaw === null ||
			nSigsRefundRaw === null ||
			sigFlagRaw === null
		) {
			return null;
		}
		const locktime = locktimeRaw === undefined ? null : parsePositiveInteger(locktimeRaw);
		const nSigs = nSigsRaw === undefined ? 1 : parsePositiveInteger(nSigsRaw);
		const nSigsRefund = nSigsRefundRaw === undefined ? 1 : parsePositiveInteger(nSigsRefundRaw);
		const sigFlag = sigFlagRaw ?? 'SIG_INPUTS';
		if (
			(locktimeRaw !== undefined && locktime === null) ||
			nSigs === null ||
			nSigsRefund === null ||
			(sigFlag !== 'SIG_INPUTS' && sigFlag !== 'SIG_ALL') ||
			(values.has('n_sigs_refund') && !values.has('refund')) ||
			values.has('refund') !== values.has('locktime')
		) {
			return null;
		}
		return {
			target: record.data,
			primaryKeys: [record.data, ...additionalKeys],
			refundKeys,
			locktime,
			nSigs,
			nSigsRefund,
			sigFlag
		};
	} catch {
		return null;
	}
}
