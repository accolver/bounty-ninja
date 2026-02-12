/**
 * Escrow operations for the Bounty.ninja bounty lifecycle.
 *
 * Handles the full flow of Cashu token escrow:
 * 1. Pledger creates P2PK-locked tokens for the bounty creator
 * 2. Creator collects pledge tokens from Kind 73002 events
 * 3. Creator swaps locked tokens (proves ownership via private key)
 * 4. Creator creates new P2PK-locked tokens for the winning solver
 *
 * All operations interact with the Cashu mint via @cashu/cashu-ts Wallet.
 */

import type { Proof, Wallet, Token } from '@cashu/cashu-ts';
import type { NostrEvent } from 'nostr-tools';
import type { DecodedPledge, MintResult, SwapResult } from './types';
import { DoubleSpendError } from './types';
import { decodeToken, encodeToken, getProofsAmount } from './token';
import { createP2PKLock } from './p2pk';
import { getWallet } from './mint';

/**
 * Create a P2PK-locked pledge token for a bounty.
 *
 * This is called by a pledger who already has Cashu proofs (from their wallet).
 * The proofs are swapped at the mint for new proofs locked to the bounty
 * creator's public key, ensuring only the creator can claim them.
 *
 * When locktime and refundPubkey are provided, the pledge includes a refund
 * path: if the creator doesn't pay out before the bounty deadline, the pledger
 * can reclaim the tokens using their own key.
 *
 * @param proofs - The pledger's spendable proofs to lock.
 * @param creatorPubkey - Hex-encoded public key of the bounty creator.
 * @param mintUrl - Optional mint URL override. Uses default mint if omitted.
 * @param locktime - Optional Unix timestamp (bounty deadline) after which refund keys can spend.
 * @param refundPubkey - Optional pledger's hex pubkey for refund after locktime.
 * @returns MintResult with the P2PK-locked proofs on success.
 */
export async function createPledgeToken(
	proofs: Proof[],
	creatorPubkey: string,
	mintUrl?: string,
	locktime?: number,
	refundPubkey?: string
): Promise<MintResult> {
	if (proofs.length === 0) {
		return { success: false, proofs: [], error: 'No proofs provided' };
	}

	const amount = getProofsAmount(proofs);
	if (amount <= 0) {
		return { success: false, proofs: [], error: 'Proofs have zero total amount' };
	}

	try {
		const wallet = await getWallet(mintUrl);
		const p2pkOptions = createP2PKLock(
			creatorPubkey,
			locktime,
			refundPubkey ? [refundPubkey] : undefined
		);
		const fees = wallet.getFeesForProofs(proofs);
		const sendAmount = amount - fees;

		if (sendAmount <= 0) {
			return {
				success: false,
				proofs: [],
				error: `Insufficient amount after fees: ${amount} sats - ${fees} fee = ${sendAmount} sats`
			};
		}

		const { send } = await wallet.send(sendAmount, proofs, undefined, {
			send: {
				type: 'p2pk',
				options: p2pkOptions
			}
		});

		return { success: true, proofs: send };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`[cashu/escrow] createPledgeToken failed: ${message}`);
		return { success: false, proofs: [], error: message };
	}
}

/**
 * Extract and decode Cashu tokens from Kind 73002 pledge events.
 *
 * Parses the `cashu` tag from each pledge event, decodes the token,
 * and returns structured DecodedPledge objects. Invalid tokens are
 * skipped with a warning.
 *
 * @param pledgeEvents - Array of Kind 73002 Nostr events.
 * @returns Array of successfully decoded pledges.
 */
export function collectPledgeTokens(pledgeEvents: NostrEvent[]): DecodedPledge[] {
	const decoded: DecodedPledge[] = [];

	for (const event of pledgeEvents) {
		const cashuTag = event.tags.find((t) => t[0] === 'cashu');
		const tokenStr = cashuTag?.[1];

		if (!tokenStr) {
			console.warn(`[cashu/escrow] Pledge event ${event.id} has no cashu tag, skipping`);
			continue;
		}

		const tokenInfo = decodeToken(tokenStr);
		if (!tokenInfo) {
			console.warn(`[cashu/escrow] Pledge event ${event.id} has invalid cashu token, skipping`);
			continue;
		}

		const token: Token = {
			mint: tokenInfo.mint,
			proofs: tokenInfo.proofs,
			unit: tokenInfo.unit,
			memo: tokenInfo.memo
		};

		decoded.push({
			token,
			mint: tokenInfo.mint,
			amount: tokenInfo.amount,
			proofs: tokenInfo.proofs,
			eventId: event.id,
			pledgerPubkey: event.pubkey
		});
	}

	return decoded;
}

/**
 * Swap P2PK-locked pledge tokens at the mint.
 *
 * Called by the bounty creator to claim pledged tokens. The creator
 * must hold the private key corresponding to the P2PK lock. The
 * wallet's NIP-07 signer or provided private key is used to prove
 * ownership during the swap.
 *
 * @param pledges - Decoded pledges to swap.
 * @param wallet - Initialized Wallet instance (creator's wallet).
 * @param privkey - Creator's private key (hex) for signing P2PK proofs.
 * @returns SwapResult with the newly received (unlocked) proofs.
 */
export async function swapPledgeTokens(
	pledges: DecodedPledge[],
	wallet: Wallet,
	privkey: string
): Promise<SwapResult> {
	if (pledges.length === 0) {
		return {
			success: false,
			sendProofs: [],
			keepProofs: [],
			fees: 0,
			error: 'No pledges to swap'
		};
	}

	// Collect all proofs from all pledges
	const allProofs: Proof[] = [];
	for (const pledge of pledges) {
		allProofs.push(...pledge.proofs);
	}

	const totalAmount = getProofsAmount(allProofs);
	if (totalAmount <= 0) {
		return {
			success: false,
			sendProofs: [],
			keepProofs: [],
			fees: 0,
			error: 'Pledge proofs have zero total amount'
		};
	}

	try {
		const fees = wallet.getFeesForProofs(allProofs);
		const receiveAmount = totalAmount - fees;

		if (receiveAmount <= 0) {
			return {
				success: false,
				sendProofs: [],
				keepProofs: [],
				fees,
				error: `Insufficient amount after fees: ${totalAmount} sats - ${fees} fee`
			};
		}

		// Sign the P2PK-locked proofs with the creator's private key,
		// then swap them for new unlocked proofs.
		const signedProofs = wallet.signP2PKProofs(allProofs, privkey);
		const { keep, send } = await wallet.send(receiveAmount, signedProofs, {
			privkey
		});

		return {
			success: true,
			sendProofs: send,
			keepProofs: keep,
			fees
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);

		// Detect double-spend from the mint
		if (
			message.toLowerCase().includes('already spent') ||
			message.toLowerCase().includes('token already spent')
		) {
			throw new DoubleSpendError(`Pledge tokens already spent: ${message}`);
		}

		console.error(`[cashu/escrow] swapPledgeTokens failed: ${message}`);
		return {
			success: false,
			sendProofs: [],
			keepProofs: [],
			fees: 0,
			error: message
		};
	}
}

/**
 * Create new P2PK-locked tokens for the winning solver.
 *
 * Called by the bounty creator after consensus voting determines a winner.
 * The creator's unlocked proofs are swapped for new proofs locked to
 * the solver's public key.
 *
 * @param proofs - Creator's spendable proofs (from swapPledgeTokens).
 * @param solverPubkey - Hex-encoded public key of the winning solver.
 * @param wallet - Initialized Wallet instance.
 * @returns MintResult with the P2PK-locked payout proofs.
 */
export async function createPayoutToken(
	proofs: Proof[],
	solverPubkey: string,
	wallet: Wallet
): Promise<MintResult> {
	if (proofs.length === 0) {
		return { success: false, proofs: [], error: 'No proofs for payout' };
	}

	const amount = getProofsAmount(proofs);
	if (amount <= 0) {
		return { success: false, proofs: [], error: 'Proofs have zero total amount' };
	}

	try {
		const p2pkOptions = createP2PKLock(solverPubkey);
		const fees = wallet.getFeesForProofs(proofs);
		const sendAmount = amount - fees;

		if (sendAmount <= 0) {
			return {
				success: false,
				proofs: [],
				error: `Insufficient amount after fees: ${amount} sats - ${fees} fee = ${sendAmount} sats`
			};
		}

		const { send } = await wallet.send(sendAmount, proofs, undefined, {
			send: {
				type: 'p2pk',
				options: p2pkOptions
			}
		});

		return { success: true, proofs: send };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);

		if (
			message.toLowerCase().includes('already spent') ||
			message.toLowerCase().includes('token already spent')
		) {
			throw new DoubleSpendError(`Payout proofs already spent: ${message}`);
		}

		console.error(`[cashu/escrow] createPayoutToken failed: ${message}`);
		return { success: false, proofs: [], error: message };
	}
}

/**
 * Encode payout proofs as a Cashu token string for inclusion in a
 * Kind 73004 payout Nostr event.
 *
 * @param proofs - The P2PK-locked payout proofs.
 * @param mintUrl - The mint URL these proofs belong to.
 * @returns Encoded Cashu token string.
 */
export function encodePayoutToken(proofs: Proof[], mintUrl: string): string {
	return encodeToken(proofs, mintUrl, 'Bounty.ninja bounty payout');
}

/**
 * Check if pledge proofs are still spendable at the mint.
 *
 * Useful for verifying that pledged tokens haven't been double-spent
 * before attempting a swap.
 *
 * @param pledges - Decoded pledges to check.
 * @param wallet - Initialized Wallet instance.
 * @returns Map of event ID to boolean (true = all proofs still spendable).
 */
export async function checkPledgeProofsSpendable(
	pledges: DecodedPledge[],
	wallet: Wallet
): Promise<Map<string, boolean>> {
	const results = new Map<string, boolean>();

	for (const pledge of pledges) {
		try {
			const states = await wallet.checkProofsStates(pledge.proofs);
			const allSpendable = states.every((s) => s.state === 'UNSPENT');
			results.set(pledge.eventId, allSpendable);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.warn(
				`[cashu/escrow] Failed to check proofs for pledge ${pledge.eventId}: ${message}`
			);
			// Assume not spendable on error to be safe
			results.set(pledge.eventId, false);
		}
	}

	return results;
}
