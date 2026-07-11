import type { Proof } from '@cashu/cashu-ts';
import type { ProofIdentity } from './types';
import { getCashu } from './lazy';

/** Normalize a mint URL for financial identity and equality checks. */
export function normalizeMintUrl(value: string): string {
	const url = new URL(value.trim());
	if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
		throw new Error(
			'Mint URL must be an HTTPS origin/path without credentials, query, or fragment'
		);
	}
	const path = url.pathname.replace(/\/+$/, '');
	return `${url.origin}${path}`;
}

/** Derive the mint-scoped NUT-00 proof identity from hash_to_curve(secret). */
export async function getProofIdentity(
	mint: string,
	proof: Pick<Proof, 'secret'>
): Promise<ProofIdentity> {
	const { hashToCurve } = await getCashu();
	const y = hashToCurve(new TextEncoder().encode(proof.secret)).toHex(true);
	return `${normalizeMintUrl(mint)}#${y}` as ProofIdentity;
}

export async function getProofIdentities(
	mint: string,
	proofs: readonly Pick<Proof, 'secret'>[]
): Promise<readonly ProofIdentity[]> {
	return Promise.all(proofs.map((proof) => getProofIdentity(mint, proof)));
}
