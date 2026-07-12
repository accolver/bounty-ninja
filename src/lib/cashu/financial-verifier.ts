import type { ProofState } from '@cashu/cashu-ts';
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
	now: () => number;
}

const defaultDependencies: FinancialVerifierDependencies = {
	decode: decodeToken,
	wallet: getWallet,
	identities: getProofIdentities,
	condition: inspectP2PKProof,
	now: () => Math.floor(Date.now() / 1000)
};

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

async function inspectConditions(
	prepared: PreparedToken,
	dependencies: FinancialVerifierDependencies
): Promise<(P2PKProofCondition | null)[]> {
	if (!prepared.decoded) return [];
	return Promise.all(prepared.decoded.proofs.map((proof) => dependencies.condition(proof.secret)));
}

async function mintState(
	prepared: PreparedToken,
	dependencies: FinancialVerifierDependencies
): Promise<{ states: ProofState[] | null; nut11Supported: boolean | null }> {
	if (!prepared.decoded) return { states: null, nut11Supported: null };
	try {
		const wallet = await dependencies.wallet(prepared.decoded.mint);
		return {
			states: await wallet.checkProofsStates(prepared.decoded.proofs),
			nut11Supported: wallet.getMintInfo().isSupported(11).supported
		};
	} catch {
		return { states: null, nut11Supported: null };
	}
}

export async function verifyPledgesForBounty(
	bounty: Bounty,
	pledges: readonly Pledge[],
	dependencies: FinancialVerifierDependencies = defaultDependencies
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
				mintState(token, dependencies)
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
		p2pkTarget: null,
		reasons: uniqueReasons
	};
}

export async function verifyPayoutsForBounty(
	bounty: Bounty,
	payouts: readonly Payout[],
	dependencies: FinancialVerifierDependencies = defaultDependencies
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
				mintState(token, dependencies)
			]);
			if (mint.states === null) reasons.push('mint_unavailable');
			else {
				if (mint.states.length !== token.decoded.proofs.length)
					reasons.push('proof_state_mismatch');
				if (mint.states.some((state) => state.state === 'SPENT')) reasons.push('spent_proof');
				if (mint.states.some((state) => state.state === 'PENDING')) reasons.push('pending_proof');
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
							condition.nSigs < 1 ||
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
			result.p2pkTarget = targets.size === 1 ? [...targets][0] : null;
			return [payout.id, result];
		})
	);
	return new Map(records);
}
