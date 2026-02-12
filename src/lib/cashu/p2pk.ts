/**
 * P2PK (Pay-to-Public-Key) locking/unlocking helpers per NUT-11.
 *
 * Enables locking Cashu proofs to a specific Nostr pubkey so that
 * only the holder of the corresponding private key can spend them.
 * This is the foundation of the task escrow mechanism.
 *
 * In @cashu/cashu-ts v3.x, P2PK is supported via:
 * - `OutputType` with `type: 'p2pk'` and `P2PKOptions`
 * - `wallet.send()` with `OutputConfig` for P2PK-locked outputs
 * - `createP2PKsecret()` for low-level secret construction
 */

import type { Proof, P2PKOptions, Wallet } from '@cashu/cashu-ts';
import type { P2PKLockParams, SwapResult } from './types';

/**
 * Create P2PK spending condition options for @cashu/cashu-ts.
 *
 * Translates our domain P2PKLockParams into the library's P2PKOptions format.
 * The resulting options can be used with `wallet.send()` or `OutputType`.
 *
 * @param pubkeyHex - Hex-encoded public key to lock to (x-only 32-byte or compressed 33-byte).
 * @param refundLocktimeUnix - Optional Unix timestamp after which refund keys can spend.
 * @param refundKeys - Optional refund public keys (defaults to empty — anyone can spend after locktime).
 * @returns P2PKOptions suitable for @cashu/cashu-ts operations.
 */
export function createP2PKLock(
	pubkeyHex: string,
	refundLocktimeUnix?: number,
	refundKeys?: string[]
): P2PKOptions {
	const options: P2PKOptions = {
		pubkey: pubkeyHex
	};

	if (refundLocktimeUnix !== undefined) {
		options.locktime = refundLocktimeUnix;
	}

	if (refundKeys && refundKeys.length > 0) {
		options.refundKeys = refundKeys;
	}

	return options;
}

/**
 * Create P2PKOptions from our domain lock params.
 *
 * Convenience wrapper that accepts a P2PKLockParams object.
 *
 * @param params - The P2PK lock parameters.
 * @returns P2PKOptions for @cashu/cashu-ts.
 */
export function createP2PKLockFromParams(params: P2PKLockParams): P2PKOptions {
	return createP2PKLock(params.pubkeyHex, params.refundLocktimeUnix, params.refundKeys);
}

/**
 * Swap proofs for new P2PK-locked proofs at the mint.
 *
 * This performs a swap operation where the input proofs are exchanged
 * for new proofs that are locked to the specified public key.
 * The mint validates the input proofs and returns new ones with
 * P2PK spending conditions embedded in their secrets.
 *
 * @param proofs - Input proofs to swap (must be spendable by the caller).
 * @param pubkeyHex - Hex-encoded public key to lock the new proofs to.
 * @param wallet - Initialized Wallet instance for the proofs' mint.
 * @param refundLocktimeUnix - Optional locktime for refund path.
 * @returns SwapResult with the new P2PK-locked proofs.
 */
export async function lockProofsToKey(
	proofs: Proof[],
	pubkeyHex: string,
	wallet: Wallet,
	refundLocktimeUnix?: number
): Promise<SwapResult> {
	const amount = proofs.reduce((sum, p) => sum + p.amount, 0);

	if (amount <= 0) {
		return {
			success: false,
			sendProofs: [],
			keepProofs: [],
			fees: 0,
			error: 'No proofs to lock (zero amount)'
		};
	}

	const p2pkOptions = createP2PKLock(pubkeyHex, refundLocktimeUnix);

	try {
		const fees = wallet.getFeesForProofs(proofs);
		const sendAmount = amount - fees;

		if (sendAmount <= 0) {
			return {
				success: false,
				sendProofs: [],
				keepProofs: [],
				fees,
				error: `Insufficient amount after fees: ${amount} sats - ${fees} fee = ${sendAmount} sats`
			};
		}

		const { keep, send } = await wallet.send(sendAmount, proofs, undefined, {
			send: {
				type: 'p2pk',
				options: p2pkOptions
			}
		});

		return {
			success: true,
			sendProofs: send,
			keepProofs: keep,
			fees
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);

		// Detect double-spend errors from the mint
		const isDoubleSpend =
			message.toLowerCase().includes('already spent') ||
			message.toLowerCase().includes('token already spent');

		return {
			success: false,
			sendProofs: [],
			keepProofs: [],
			fees: 0,
			error: isDoubleSpend
				? 'Token proofs have already been spent (double-spend)'
				: `P2PK lock failed: ${message}`
		};
	}
}
