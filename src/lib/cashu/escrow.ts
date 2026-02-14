/**
 * Escrow operations for the Bounty.ninja bounty lifecycle.
 *
 * Pledger-controlled escrow model:
 * 1. Pledger creates P2PK-locked tokens to their OWN pubkey (self-custody)
 * 2. After vote consensus (66%), each pledger releases their portion
 *    by swapping self-locked proofs for solver-locked proofs
 * 3. Each pledger publishes a Kind 73004 payout event with solver-locked tokens
 * 4. Pledger can reclaim at any time (they hold the primary P2PK key)
 *
 * The bounty creator NEVER controls pledge funds.
 * All operations interact with the Cashu mint via @cashu/cashu-ts Wallet.
 */

import { config } from '$lib/config';
import type { Proof, Token } from '@cashu/cashu-ts';
import type { NostrEvent } from 'nostr-tools';
import type { DecodedPledge, MintResult, SwapResult } from './types';
import { DoubleSpendError } from './types';
import { decodeToken, encodeToken, getProofsAmount } from './token';
import { createP2PKLock } from './p2pk';
import { getWallet } from './mint';

/**
 * Create a P2PK-locked pledge token for a bounty.
 *
 * The pledger locks tokens to their OWN pubkey (self-custody). Only the
 * pledger can spend these tokens at the mint. The bounty creator has no
 * control over the funds.
 *
 * @param proofs - The pledger's spendable proofs to lock.
 * @param pledgerPubkey - Hex-encoded public key of the pledger (lock target).
 * @param mintUrl - Optional mint URL override. Uses default mint if omitted.
 * @param locktime - Optional Unix timestamp (bounty deadline) as a social signal.
 * @returns MintResult with the P2PK-locked proofs on success.
 */
export async function createPledgeToken(
	proofs: Proof[],
	pledgerPubkey: string,
	mintUrl?: string,
	locktime?: number
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
		const p2pkOptions = createP2PKLock(pledgerPubkey, locktime);
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
export async function collectPledgeTokens(pledgeEvents: NostrEvent[]): Promise<DecodedPledge[]> {
	const decoded: DecodedPledge[] = [];

	for (const event of pledgeEvents) {
		const cashuTag = event.tags.find((t) => t[0] === 'cashu');
		const tokenStr = cashuTag?.[1];

		if (!tokenStr) {
			console.warn(`[cashu/escrow] Pledge event ${event.id} has no cashu tag, skipping`);
			continue;
		}

		const tokenInfo = await decodeToken(tokenStr);
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
 * Release a pledger's self-locked tokens to the winning solver.
 *
 * Called by a pledger after vote consensus is reached. The pledger signs
 * their P2PK-locked proofs with their private key, swaps them at the mint
 * for fresh proofs, then re-locks the fresh proofs to the solver's pubkey.
 *
 * @param pledge - The decoded pledge to release.
 * @param pledgerPrivkey - The pledger's private key (hex) for signing P2PK proofs.
 * @param solverPubkey - Hex-encoded public key of the winning solver.
 * @returns MintResult with solver-locked proofs on success.
 */
export async function releasePledgeToSolver(
	pledge: DecodedPledge,
	pledgerPrivkey: string,
	solverPubkey: string
): Promise<MintResult> {
	if (pledge.proofs.length === 0) {
		return { success: false, proofs: [], error: 'No proofs to release' };
	}

	const totalAmount = getProofsAmount(pledge.proofs);
	if (totalAmount <= 0) {
		return { success: false, proofs: [], error: 'Pledge proofs have zero total amount' };
	}

	try {
		const wallet = await getWallet(pledge.mint);

		// Step 1: Sign P2PK-locked proofs with pledger's private key and swap for unlocked proofs
		const signedProofs = wallet.signP2PKProofs(pledge.proofs, pledgerPrivkey);
		const swapFees = wallet.getFeesForProofs(signedProofs);
		const swapAmount = totalAmount - swapFees;

		if (swapAmount <= 0) {
			return {
				success: false,
				proofs: [],
				error: `Insufficient amount after swap fees: ${totalAmount} sats - ${swapFees} fee`
			};
		}

		const { send: unlockedProofs } = await wallet.send(swapAmount, signedProofs, {
			privkey: pledgerPrivkey
		});

		// Step 2: Re-lock fresh proofs to solver pubkey via P2PK
		const p2pkOptions = createP2PKLock(solverPubkey);
		const lockFees = wallet.getFeesForProofs(unlockedProofs);
		const lockAmount = getProofsAmount(unlockedProofs) - lockFees;

		if (lockAmount <= 0) {
			return {
				success: false,
				proofs: [],
				error: `Insufficient amount after lock fees: ${getProofsAmount(unlockedProofs)} sats - ${lockFees} fee`
			};
		}

		const { send: solverProofs } = await wallet.send(lockAmount, unlockedProofs, undefined, {
			send: {
				type: 'p2pk',
				options: p2pkOptions
			}
		});

		return { success: true, proofs: solverProofs };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);

		// Detect double-spend from the mint
		if (
			message.toLowerCase().includes('already spent') ||
			message.toLowerCase().includes('token already spent')
		) {
			throw new DoubleSpendError(`Pledge tokens already spent: ${message}`);
		}

		console.error(`[cashu/escrow] releasePledgeToSolver failed: ${message}`);
		return { success: false, proofs: [], error: message };
	}
}

/**
 * Reclaim a pledger's self-locked tokens.
 *
 * Since the pledger holds the primary P2PK key, reclaim is a simple swap:
 * sign proofs with the pledger's private key and swap at the mint for
 * unlocked proofs. No refund path is needed.
 *
 * This can be called at any time — the locktime is a social signal only,
 * not a spending restriction for the primary key holder.
 *
 * @param pledge - The decoded pledge to reclaim.
 * @param pledgerPrivkey - The pledger's private key (hex) for signing.
 * @returns SwapResult with the reclaimed (unlocked) proofs.
 */
export async function reclaimPledge(
	pledge: DecodedPledge,
	pledgerPrivkey: string
): Promise<SwapResult> {
	if (pledge.proofs.length === 0) {
		return {
			success: false,
			sendProofs: [],
			keepProofs: [],
			fees: 0,
			error: 'No proofs to reclaim'
		};
	}

	const totalAmount = getProofsAmount(pledge.proofs);
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
		const wallet = await getWallet(pledge.mint);
		const fees = wallet.getFeesForProofs(pledge.proofs);
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

		// Sign with pledger's primary key — always valid (no locktime restriction)
		const signedProofs = wallet.signP2PKProofs(pledge.proofs, pledgerPrivkey);
		const { keep, send } = await wallet.send(receiveAmount, signedProofs, {
			privkey: pledgerPrivkey
		});

		return {
			success: true,
			sendProofs: send,
			keepProofs: keep,
			fees
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);

		if (
			message.toLowerCase().includes('already spent') ||
			message.toLowerCase().includes('token already spent')
		) {
			throw new DoubleSpendError(`Pledge tokens already spent — cannot reclaim: ${message}`);
		}

		console.error(`[cashu/escrow] reclaimPledge failed: ${message}`);
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
 * Encode payout proofs as a Cashu token string for inclusion in a
 * Kind 73004 payout Nostr event.
 *
 * @param proofs - The P2PK-locked payout proofs.
 * @param mintUrl - The mint URL these proofs belong to.
 * @returns Encoded Cashu token string.
 */
export async function encodePayoutToken(proofs: Proof[], mintUrl: string): Promise<string> {
	return encodeToken(proofs, mintUrl, `${config.app.nameCaps} bounty payout`);
}
