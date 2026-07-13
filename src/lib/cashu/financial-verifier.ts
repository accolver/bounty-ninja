import type { Proof, ProofState, Wallet } from '@cashu/cashu-ts';
import type { Bounty, Payout, Pledge } from '$lib/bounty/types';
import { decodeToken } from './token';
import { getWallet } from './mint';
import { getProofIdentities, normalizeMintUrl } from './proof-identity';
import { inspectP2PKProof, validatePledge, type P2PKProofCondition } from './pledge-verification';
import { nut11KeyMatchesXOnly } from './p2pk';
import type {
	CashuTokenInvalidReason,
	CashuTokenVerification,
	PledgeVerification,
	ProofIdentity,
	TokenInfo
} from './types';
import { normalizePublicHttpsUrl } from '$lib/utils/network-policy';
import { getCashu } from './lazy';
import { compareEventOrder } from '$lib/bounty/event-order';

const VERIFICATION_FRESHNESS_SECONDS = 5 * 60;
export const CASHU_TOKEN_VERIFICATION_POLICY_VERSION = 1;

interface PreparedToken {
	decoded: TokenInfo | null;
	identities: readonly ProofIdentity[];
}

export interface FinancialVerifierDependencies {
	decode: typeof decodeToken;
	wallet: typeof getWallet;
	identities: typeof getProofIdentities;
	condition: typeof inspectP2PKProof;
	issuance: (proof: Proof, wallet: Wallet) => Promise<'valid' | 'missing' | 'invalid'>;
	now: () => number;
}

const defaultDependencies: FinancialVerifierDependencies = {
	decode: decodeToken,
	wallet: getWallet,
	identities: getProofIdentities,
	condition: inspectP2PKProof,
	issuance: verifyProofIssuance,
	now: () => Math.floor(Date.now() / 1000)
};

/** Verify NUT-12 issuance evidence against the exact mint keyset for this proof. */
export async function verifyProofIssuance(
	proof: Proof,
	wallet: Wallet
): Promise<'valid' | 'missing' | 'invalid'> {
	if (!proof.dleq?.e || !proof.dleq.s || !proof.dleq.r) return 'missing';
	try {
		const { hasValidDleq } = await getCashu();
		const keyset = await wallet.keyChain.ensureKeysetKeys(proof.id);
		return hasValidDleq(proof, keyset) ? 'valid' : 'invalid';
	} catch {
		return 'invalid';
	}
}

function duplicateIdentities(prepared: Iterable<PreparedToken>): Set<ProofIdentity> {
	const counts = new Map<ProofIdentity, number>();
	for (const token of prepared) {
		for (const identity of token.identities) counts.set(identity, (counts.get(identity) ?? 0) + 1);
	}
	return new Set([...counts].filter(([, count]) => count > 1).map(([identity]) => identity));
}

async function prepare(
	token: string,
	dependencies: FinancialVerifierDependencies
): Promise<PreparedToken> {
	const decoded = await dependencies.decode(token);
	if (!decoded) return { decoded: null, identities: [] };
	try {
		return {
			decoded,
			identities: await dependencies.identities(decoded.mint, decoded.proofs)
		};
	} catch {
		return { decoded, identities: [] };
	}
}

/** Build a complete mint-scoped ownership index. Any replay poisons every claimant. */
export async function buildGlobalProofOwnership(
	pledges: readonly Pledge[],
	payouts: readonly Payout[],
	dependencies: Pick<FinancialVerifierDependencies, 'decode' | 'identities'> = defaultDependencies
): Promise<Map<ProofIdentity, string | null>> {
	const owners = new Map<ProofIdentity, string | null>();
	const claims = [...pledges, ...payouts].sort(compareEventOrder);
	for (const claim of claims) {
		const token = await prepare(claim.cashuToken, dependencies as FinancialVerifierDependencies);
		for (const identity of token.identities) {
			owners.set(identity, owners.has(identity) ? null : claim.id);
		}
	}
	return owners;
}

async function inspectConditions(
	prepared: PreparedToken,
	dependencies: FinancialVerifierDependencies
): Promise<(P2PKProofCondition | null)[]> {
	if (!prepared.decoded) return [];
	return Promise.all(prepared.decoded.proofs.map((proof) => dependencies.condition(proof.secret)));
}

async function mintState(
	prepared: PreparedToken,
	dependencies: FinancialVerifierDependencies,
	expectedMint: string,
	allowMintContact: boolean
): Promise<{
	states: ProofState[] | null;
	nut11Supported: boolean | null;
	issuanceEvidence: ('valid' | 'missing' | 'invalid')[];
}> {
	if (!prepared.decoded) return { states: null, nut11Supported: null, issuanceEvidence: [] };
	try {
		const tokenMint = normalizePublicHttpsUrl(prepared.decoded.mint);
		const bountyMint = normalizePublicHttpsUrl(expectedMint);
		if (!allowMintContact || !tokenMint || tokenMint !== bountyMint) {
			return { states: null, nut11Supported: null, issuanceEvidence: [] };
		}
		const wallet = await dependencies.wallet(prepared.decoded.mint);
		const issuanceEvidence = await Promise.all(
			prepared.decoded.proofs.map((proof) => dependencies.issuance(proof, wallet))
		);
		let states: ProofState[] | null = null;
		try {
			states = await wallet.checkProofsStates(prepared.decoded.proofs);
		} catch {
			// Issuance authenticity remains independently established when NUT-07 is unavailable.
		}
		return {
			states,
			nut11Supported: wallet.getMintInfo().isSupported(11).supported,
			issuanceEvidence
		};
	} catch {
		return { states: null, nut11Supported: null, issuanceEvidence: [] };
	}
}

export async function verifyPledgesForBounty(
	bounty: Bounty,
	pledges: readonly Pledge[],
	dependencies: FinancialVerifierDependencies = defaultDependencies,
	allowMintContact = true
): Promise<Map<string, PledgeVerification>> {
	const prepared = new Map<string, PreparedToken>();
	await Promise.all(
		pledges.map(async (pledge) =>
			prepared.set(pledge.id, await prepare(pledge.cashuToken, dependencies))
		)
	);
	const duplicates = duplicateIdentities(prepared.values());
	const checkedAt = dependencies.now();
	const records = await Promise.all(
		pledges.map(async (pledge): Promise<[string, PledgeVerification]> => {
			const token = prepared.get(pledge.id) ?? { decoded: null, identities: [] };
			const [conditions, mint] = await Promise.all([
				inspectConditions(token, dependencies),
				mintState(token, dependencies, bounty.mintUrl ?? '', allowMintContact)
			]);
			return [
				pledge.id,
				validatePledge({
					pledge,
					bountyAddress: `${bounty.event.kind}:${bounty.pubkey}:${bounty.dTag}`,
					bountyMint: bounty.mintUrl ?? '',
					decoded: token.decoded,
					proofStates: mint.states,
					proofIdentities: token.identities,
					duplicateProofs: duplicates,
					conditions,
					issuanceEvidence: mint.issuanceEvidence,
					checkedAt,
					validUntil: mint.states ? checkedAt + VERIFICATION_FRESHNESS_SECONDS : null,
					mintUnavailable: mint.states === null,
					nut11Supported: mint.nut11Supported ?? undefined
				})
			];
		})
	);
	return new Map(records);
}

function payoutResult(
	checkedAt: number,
	prepared: PreparedToken,
	reasons: readonly CashuTokenInvalidReason[],
	mintAvailable: boolean
): CashuTokenVerification {
	const uniqueReasons = [...new Set(reasons)];
	const unavailable = uniqueReasons.some(
		(reason) => reason === 'mint_unavailable' || reason === 'pending_proof'
	);
	const invalidReasons = uniqueReasons.filter(
		(reason) => reason !== 'mint_unavailable' && reason !== 'pending_proof'
	);
	let normalizedMint: string | null = null;
	try {
		normalizedMint = prepared.decoded ? normalizeMintUrl(prepared.decoded.mint) : null;
	} catch {
		// A malformed mint is represented by mint_mismatch.
	}
	return {
		status: invalidReasons.length > 0 ? 'invalid' : unavailable ? 'unavailable' : 'valid',
		policyVersion: CASHU_TOKEN_VERIFICATION_POLICY_VERSION,
		checkedAt,
		validUntil: mintAvailable ? checkedAt + VERIFICATION_FRESHNESS_SECONDS : null,
		normalizedMint,
		decodedAmount: prepared.decoded?.amount ?? null,
		proofIdentities: prepared.identities,
		issuanceAuthentic:
			prepared.decoded !== null &&
			prepared.decoded.proofs.length > 0 &&
			!uniqueReasons.some((reason) =>
				['issuance_evidence_missing', 'issuance_evidence_invalid'].includes(reason)
			),
		proofState: 'unavailable',
		p2pkTarget: null,
		reasons: uniqueReasons
	};
}

export async function verifyPayoutsForBounty(
	bounty: Bounty,
	payouts: readonly Payout[],
	dependencies: FinancialVerifierDependencies = defaultDependencies,
	allowMintContact = true
): Promise<Map<string, CashuTokenVerification>> {
	const prepared = new Map<string, PreparedToken>();
	await Promise.all(
		payouts.map(async (payout) =>
			prepared.set(payout.id, await prepare(payout.cashuToken, dependencies))
		)
	);
	const duplicates = duplicateIdentities(prepared.values());
	const checkedAt = dependencies.now();
	const records = await Promise.all(
		payouts.map(async (payout): Promise<[string, CashuTokenVerification]> => {
			const token = prepared.get(payout.id) ?? { decoded: null, identities: [] };
			const reasons: CashuTokenInvalidReason[] = [];
			if (!token.decoded) {
				return [payout.id, payoutResult(checkedAt, token, ['decode_failed'], false)];
			}
			if (token.decoded.unit !== 'sat') reasons.push('wrong_unit');
			if (token.decoded.proofs.length === 0) reasons.push('missing_proofs');
			if (
				!Number.isSafeInteger(token.decoded.amount) ||
				token.decoded.amount <= 0 ||
				token.decoded.proofs.some(
					(proof) => !Number.isSafeInteger(proof.amount) || proof.amount <= 0
				)
			) {
				reasons.push('invalid_amount');
			}
			if (token.decoded.amount !== payout.amount) reasons.push('amount_mismatch');
			try {
				const tokenMint = normalizeMintUrl(token.decoded.mint);
				const payoutMint = normalizeMintUrl(payout.mintUrl ?? '');
				const bountyMint = normalizeMintUrl(bounty.mintUrl ?? '');
				if (tokenMint !== payoutMint || payoutMint !== bountyMint) reasons.push('mint_mismatch');
			} catch {
				reasons.push('mint_mismatch');
			}
			if (
				token.identities.length !== token.decoded.proofs.length ||
				new Set(token.identities).size !== token.identities.length ||
				token.identities.some((identity) => duplicates.has(identity))
			) {
				reasons.push('duplicate_proof');
			}

			const [conditions, mint] = await Promise.all([
				inspectConditions(token, dependencies),
				mintState(token, dependencies, bounty.mintUrl ?? '', allowMintContact)
			]);
			if (mint.states === null) reasons.push('mint_unavailable');
			else {
				if (mint.states.length !== token.decoded.proofs.length)
					reasons.push('proof_state_mismatch');
				if (mint.states.some((state) => state.state === 'PENDING')) reasons.push('pending_proof');
			}
			if (mint.issuanceEvidence.length !== token.decoded.proofs.length) {
				reasons.push('issuance_evidence_missing');
			}
			if (mint.issuanceEvidence.some((evidence) => evidence === 'missing')) {
				reasons.push('issuance_evidence_missing');
			}
			if (mint.issuanceEvidence.some((evidence) => evidence === 'invalid')) {
				reasons.push('issuance_evidence_invalid');
			}
			if (mint.nut11Supported === false) reasons.push('nut11_unsupported');
			if (conditions.length !== token.decoded.proofs.length || conditions.some((item) => !item)) {
				reasons.push('not_p2pk');
			}
			const validConditions = conditions.filter(
				(item): item is P2PKProofCondition => item !== null
			);
			if (!payout.paymentPubkey) reasons.push('missing_payment_key');
			if (
				validConditions.some((condition) => {
					try {
						return (
							!payout.paymentPubkey ||
							!nut11KeyMatchesXOnly(condition.target, payout.paymentPubkey) ||
							condition.locktime !== null ||
							condition.refundKeys.length > 0 ||
							condition.primaryKeys.length !== 1 ||
							condition.nSigs !== 1 ||
							condition.sigFlag !== 'SIG_INPUTS'
						);
					} catch {
						return true;
					}
				})
			) {
				reasons.push('p2pk_target_mismatch');
			}
			const targets = new Set(validConditions.map((condition) => condition.target.toLowerCase()));
			if (targets.size > 1) reasons.push('inconsistent_proof_conditions');

			const result = payoutResult(checkedAt, token, reasons, mint.states !== null);
			if (mint.states) {
				const states = new Set(mint.states.map((state) => state.state));
				result.proofState =
					states.size !== 1
						? 'mixed'
						: mint.states[0]?.state === 'UNSPENT'
							? 'unspent'
							: mint.states[0]?.state === 'SPENT'
								? 'spent'
								: 'pending';
			}
			result.p2pkTarget = targets.size === 1 ? [...targets][0] : null;
			return [payout.id, result];
		})
	);
	return new Map(records);
}
