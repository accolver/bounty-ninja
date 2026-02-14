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

import { config } from '$lib/config';
import type { Proof, Wallet, Token } from '@cashu/cashu-ts';
import type { NostrEvent } from 'nostr-tools';
import type {
	DecodedPledge,
	MintResult,
	SwapResult,
	MintPayoutEntry,
	MultiMintPayoutResult
} from './types';
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
export async function encodePayoutToken(proofs: Proof[], mintUrl: string): Promise<string> {
	return encodeToken(proofs, mintUrl, `${config.app.nameCaps} bounty payout`);
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

/**
 * Reclaim an expired P2PK-locked pledge token.
 *
 * After the locktime passes, the pledger's refund key becomes valid.
 * This function signs the proofs with the pledger's private key and
 * swaps them at the mint for new unlocked proofs the pledger can keep.
 *
 * @param pledge - The decoded pledge to reclaim.
 * @param pledgerPrivkey - The pledger's private key (hex) for signing the refund.
 * @returns SwapResult with the reclaimed (unlocked) proofs.
 */
export async function reclaimExpiredPledge(
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

		// Sign with the refund key (pledger's private key) — valid after locktime
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

		console.error(`[cashu/escrow] reclaimExpiredPledge failed: ${message}`);
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
 * Group decoded pledges by their mint URL.
 *
 * Returns a Map keyed by mint URL, where each value is the array of
 * pledges that belong to that mint. This is essential for multi-mint
 * payout processing, since proofs from different mints must be swapped
 * independently at their respective mints.
 *
 * @param pledges - Array of decoded pledges to group.
 * @returns Map of mint URL to array of pledges from that mint.
 */
export function groupPledgesByMint(pledges: DecodedPledge[]): Map<string, DecodedPledge[]> {
	const groups = new Map<string, DecodedPledge[]>();

	for (const pledge of pledges) {
		const normalized = pledge.mint.replace(/\/+$/, '');
		const existing = groups.get(normalized);
		if (existing) {
			existing.push(pledge);
		} else {
			groups.set(normalized, [pledge]);
		}
	}

	return groups;
}

/**
 * Process a multi-mint payout: swap and create solver-locked tokens
 * independently at each mint.
 *
 * For each mint group:
 * 1. Get a wallet connection for that mint
 * 2. Swap P2PK-locked pledge proofs (unlock with creator's privkey)
 * 3. Create new P2PK-locked payout proofs for the solver
 *
 * If all pledges are from the same mint, this behaves identically to
 * the single-mint flow. If pledges span multiple mints, each mint is
 * processed independently and the results are aggregated.
 *
 * @param pledges - All decoded pledges for this bounty.
 * @param privkey - Creator's private key (hex) for signing P2PK proofs.
 * @param solverPubkey - Hex-encoded public key of the winning solver.
 * @param onStatus - Optional callback for progress updates.
 * @returns MultiMintPayoutResult with per-mint payout entries.
 */
export async function processMultiMintPayout(
	pledges: DecodedPledge[],
	privkey: string,
	solverPubkey: string,
	onStatus?: (message: string) => void
): Promise<MultiMintPayoutResult> {
	if (pledges.length === 0) {
		return { success: false, entries: [], totalAmount: 0, error: 'No pledges to process' };
	}

	const mintGroups = groupPledgesByMint(pledges);
	const entries: MintPayoutEntry[] = [];
	const errors: string[] = [];

	const mintUrls = Array.from(mintGroups.keys());

	for (const mintUrl of mintUrls) {
		const group = mintGroups.get(mintUrl)!;
		const mintLabel = mintUrls.length > 1 ? ` (${mintUrl.replace(/^https?:\/\//, '')})` : '';

		try {
			// Step 1: Connect to this mint
			onStatus?.(`Connecting to mint${mintLabel}...`);
			const wallet = await getWallet(mintUrl);

			// Step 2: Swap P2PK-locked proofs at this mint
			onStatus?.(`Unlocking pledge tokens${mintLabel}...`);
			const swapResult = await swapPledgeTokens(group, wallet, privkey);

			if (!swapResult.success) {
				errors.push(`Mint ${mintUrl}: ${swapResult.error ?? 'Swap failed'}`);
				continue;
			}

			// Step 3: Create solver-locked payout token at this mint
			onStatus?.(`Creating payout token${mintLabel}...`);
			const payoutResult = await createPayoutToken(swapResult.sendProofs, solverPubkey, wallet);

			if (!payoutResult.success) {
				errors.push(`Mint ${mintUrl}: ${payoutResult.error ?? 'Payout creation failed'}`);
				continue;
			}

			const amount = getProofsAmount(payoutResult.proofs);
			entries.push({ mintUrl, proofs: payoutResult.proofs, amount });
		} catch (err) {
			// Re-throw DoubleSpendError immediately — this is not recoverable
			if (err instanceof DoubleSpendError) {
				throw err;
			}

			const message = err instanceof Error ? err.message : String(err);
			errors.push(`Mint ${mintUrl}: ${message}`);
		}
	}

	if (entries.length === 0) {
		return {
			success: false,
			entries: [],
			totalAmount: 0,
			error: errors.join('; ')
		};
	}

	const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);

	if (errors.length > 0) {
		// Partial success — some mints failed
		return {
			success: false,
			entries: [],
			totalAmount: 0,
			error: `Some mints failed: ${errors.join('; ')}`,
			partialEntries: entries
		};
	}

	return { success: true, entries, totalAmount };
}

/**
 * Encode multi-mint payout entries into a single Cashu token string.
 *
 * When all entries are from the same mint, this produces a standard single-mint
 * token. When entries span multiple mints, each mint's proofs are encoded as
 * a separate token and joined with a newline delimiter for inclusion in the
 * payout event's cashu tag.
 *
 * @param entries - Per-mint payout entries with proofs.
 * @returns Encoded token string(s) suitable for the cashu tag.
 */
export async function encodeMultiMintPayoutTokens(entries: MintPayoutEntry[]): Promise<string> {
	if (entries.length === 0) return '';
	if (entries.length === 1) {
		return encodePayoutToken(entries[0].proofs, entries[0].mintUrl);
	}

	// Multiple mints: encode each separately, join with newline
	const encoded = await Promise.all(
		entries.map((entry) => encodePayoutToken(entry.proofs, entry.mintUrl))
	);
	return encoded.join('\n');
}
