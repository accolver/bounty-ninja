import type { Proof, Wallet } from '@cashu/cashu-ts';
import { getWallet } from './mint';
import { normalizeMintUrl } from './proof-identity';
import { inspectP2PKProof } from './pledge-verification';
import { isCompressedPubkey } from './p2pk';
import { verifyProofIssuance } from './financial-verifier';
import { assertPaymentWritesEnabled } from '$lib/utils/env';
import { decodeToken } from './token';
import type { TokenInfo } from './types';

export interface ManualTokenVerification {
	valid: boolean;
	error?: string;
	tokenInfo?: TokenInfo;
	paymentPubkey?: string;
}

interface ManualVerificationWallet {
	checkProofsStates(proofs: Proof[]): Promise<Array<{ state: string }>>;
	getMintInfo(): { isSupported(nut: number): { supported: boolean } };
}

type WalletProvider = (mintUrl: string) => Promise<ManualVerificationWallet>;

/** Normalize a Minibits public payment key without ever requesting its private key. */
export function normalizeMinibitsPaymentPubkey(value: string): string {
	const input = value.trim().toLowerCase();
	if (!input) throw new Error('Minibits wallet public key is required');
	if (!isCompressedPubkey(input)) {
		throw new Error('Enter the complete 02/03 compressed Minibits public key');
	}
	return input;
}

function stateError(
	states: ReadonlyArray<{ state: string }>,
	expected: 'UNSPENT' | 'SPENT'
): string | null {
	if (states.some((state) => state.state === 'PENDING')) return 'Mint reports a pending proof';
	if (states.some((state) => state.state !== expected)) {
		return expected === 'UNSPENT'
			? 'Every token proof must be unspent'
			: 'Minibits Revert is not complete; every source proof must be spent';
	}
	return null;
}

/** Strictly verify a manually-created permanent Minibits P2PK token before publication. */
export async function verifyManualP2PKToken(
	token: string,
	expected: { mintUrl: string; amount: number; paymentPubkey: string },
	walletProvider: WalletProvider = getWallet,
	issuanceVerifier: typeof verifyProofIssuance = verifyProofIssuance
): Promise<ManualTokenVerification> {
	try {
		assertPaymentWritesEnabled();
		const paymentPubkey = normalizeMinibitsPaymentPubkey(expected.paymentPubkey);
		const tokenInfo = await decodeToken(token.trim());
		if (!tokenInfo || tokenInfo.proofs.length === 0)
			throw new Error('Invalid or empty Cashu token');
		if (tokenInfo.unit !== 'sat') throw new Error('Token unit must be sat');
		if (
			tokenInfo.proofs.some((proof) => !Number.isSafeInteger(proof.amount) || proof.amount <= 0)
		) {
			throw new Error('Every token proof must have a positive integer amount');
		}
		if (
			new Set(tokenInfo.proofs.map((proof) => `${proof.id}:${proof.secret}:${proof.C}`)).size !==
			tokenInfo.proofs.length
		) {
			throw new Error('Token contains duplicate proofs');
		}
		if (!Number.isSafeInteger(expected.amount) || expected.amount <= 0) {
			throw new Error('Expected amount must be a positive integer');
		}
		if (tokenInfo.amount !== expected.amount) {
			throw new Error(`Token must contain exactly ${expected.amount.toLocaleString()} sats`);
		}
		if (normalizeMintUrl(tokenInfo.mint) !== normalizeMintUrl(expected.mintUrl)) {
			throw new Error('Token mint does not match the bounty mint');
		}

		const wallet = await walletProvider(expected.mintUrl);
		if (!wallet.getMintInfo().isSupported(11).supported) {
			throw new Error('Mint does not advertise NUT-11 support');
		}
		const states = await wallet.checkProofsStates(tokenInfo.proofs);
		if (states.length !== tokenInfo.proofs.length)
			throw new Error('Mint returned incomplete proof states');
		const proofStateError = stateError(states, 'UNSPENT');
		if (proofStateError) throw new Error(proofStateError);
		const issuance = await Promise.all(
			tokenInfo.proofs.map((proof) => issuanceVerifier(proof, wallet as Wallet))
		);
		if (issuance.some((result) => result === 'missing')) {
			throw new Error('Every proof must include verifiable DLEQ issuance evidence');
		}
		if (issuance.some((result) => result !== 'valid')) {
			throw new Error('A proof has invalid mint issuance evidence');
		}

		const conditions = await Promise.all(
			tokenInfo.proofs.map((proof) => inspectP2PKProof(proof.secret))
		);
		if (conditions.some((condition) => condition === null)) {
			throw new Error('Every proof must use a NUT-11 P2PK lock');
		}
		for (const condition of conditions) {
			if (!condition || condition.target.toLowerCase() !== paymentPubkey) {
				throw new Error('Token is not locked to the entered Minibits public key');
			}
			if (condition.locktime !== null || condition.refundKeys.length > 0) {
				throw new Error('Token must have no locktime or refund keys');
			}
			if (
				condition.primaryKeys.length !== 1 ||
				condition.sigFlag !== 'SIG_INPUTS' ||
				condition.nSigs !== 1
			) {
				throw new Error('Token must permanently require one SIG_INPUTS signature');
			}
		}

		return { valid: true, tokenInfo, paymentPubkey };
	} catch (error) {
		return {
			valid: false,
			error: error instanceof Error ? error.message : 'Token verification failed'
		};
	}
}

/** Confirm that an external-wallet release or Revert consumed every source proof. */
export async function verifySourceProofsSpent(
	token: string,
	mintUrl: string,
	walletProvider: WalletProvider = getWallet
): Promise<{ spent: boolean; error?: string }> {
	try {
		assertPaymentWritesEnabled();
		const tokenInfo = await decodeToken(token);
		if (!tokenInfo || tokenInfo.proofs.length === 0) throw new Error('Invalid source token');
		if (normalizeMintUrl(tokenInfo.mint) !== normalizeMintUrl(mintUrl)) {
			throw new Error('Source token mint mismatch');
		}
		const wallet = await walletProvider(mintUrl);
		const states = await wallet.checkProofsStates(tokenInfo.proofs);
		if (states.length !== tokenInfo.proofs.length)
			throw new Error('Mint returned incomplete proof states');
		const error = stateError(states, 'SPENT');
		return error ? { spent: false, error } : { spent: true };
	} catch (error) {
		return { spent: false, error: error instanceof Error ? error.message : 'Source check failed' };
	}
}
