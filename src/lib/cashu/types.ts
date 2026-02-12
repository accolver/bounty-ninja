/**
 * Cashu payment layer types for Bounty.ninja.
 *
 * These types complement @cashu/cashu-ts types (Proof, Token, etc.)
 * with domain-specific structures for the bounty escrow workflow.
 */

import type { Proof, Token } from '@cashu/cashu-ts';

// ── Token Info ──────────────────────────────────────────────────────────────

/** Decoded token information extracted from a Cashu token string. */
export interface TokenInfo {
	/** The mint URL this token belongs to. */
	mint: string;
	/** Total amount in satoshis across all proofs. */
	amount: number;
	/** The individual proofs that make up this token. */
	proofs: Proof[];
	/** Optional memo attached to the token. */
	memo?: string;
	/** Unit of the token (e.g. 'sat'). */
	unit?: string;
}

// ── P2PK Lock Parameters ────────────────────────────────────────────────────

/**
 * Parameters for creating a P2PK (Pay-to-Public-Key) spending condition.
 * Used to lock Cashu proofs so only the holder of the corresponding
 * private key can spend them.
 */
export interface P2PKLockParams {
	/** Hex-encoded public key to lock proofs to (x-only or compressed). */
	pubkeyHex: string;
	/**
	 * Optional Unix timestamp (seconds) after which the lock expires
	 * and refund keys can spend the proofs.
	 */
	refundLocktimeUnix?: number;
	/**
	 * Optional hex-encoded public keys that can spend after locktime expires.
	 * If omitted, proofs become spendable by anyone after locktime.
	 */
	refundKeys?: string[];
}

// ── Escrow State ────────────────────────────────────────────────────────────

/**
 * Lifecycle state of escrowed Cashu tokens within a bounty.
 *
 * - `locked`   — Tokens are P2PK-locked to the bounty creator; not yet claimed.
 * - `claimed`  — Creator has swapped the locked tokens (proved ownership).
 * - `refunded` — Tokens were returned to the original funder (locktime expired).
 * - `expired`  — The lock's refund window has passed without action.
 */
export type EscrowState = 'locked' | 'claimed' | 'refunded' | 'expired';

// ── Mint Operation Result ───────────────────────────────────────────────────

/**
 * Result of a mint operation (minting new proofs, receiving tokens, etc.).
 * Wraps success/failure so callers can handle errors without try/catch.
 */
export interface MintResult {
	/** Whether the operation succeeded. */
	success: boolean;
	/** The resulting proofs on success. */
	proofs: Proof[];
	/** Error message on failure. */
	error?: string;
}

// ── Swap Result ─────────────────────────────────────────────────────────────

/**
 * Result of a token swap operation at the mint.
 * Swaps exchange existing proofs for new ones, potentially with
 * different spending conditions (e.g. P2PK lock) or denominations.
 */
export interface SwapResult {
	/** Whether the swap succeeded. */
	success: boolean;
	/** New proofs received from the mint (the "send" portion). */
	sendProofs: Proof[];
	/** Change proofs kept by the swapper. */
	keepProofs: Proof[];
	/** Fees paid for the swap (in sats). */
	fees: number;
	/** Error message on failure. */
	error?: string;
}

// ── Decoded Pledge ──────────────────────────────────────────────────────────

/**
 * A decoded pledge extracted from a Kind 73002 Nostr event.
 * Contains the parsed Cashu token and metadata needed for escrow operations.
 */
export interface DecodedPledge {
	/** The decoded Cashu token object. */
	token: Token;
	/** The mint URL from the token. */
	mint: string;
	/** Total amount in satoshis. */
	amount: number;
	/** The proofs from the token. */
	proofs: Proof[];
	/** Nostr event ID of the pledge event. */
	eventId: string;
	/** Pubkey of the pledger. */
	pledgerPubkey: string;
}

// ── Double-Spend Error ──────────────────────────────────────────────────────

/**
 * Error thrown when the mint rejects a swap because proofs
 * have already been spent (double-spend attempt).
 */
export class DoubleSpendError extends Error {
	constructor(message = 'Token proofs have already been spent') {
		super(message);
		this.name = 'DoubleSpendError';
	}
}

/**
 * Error thrown when a mint connection fails after all retries.
 */
export class MintConnectionError extends Error {
	public readonly mintUrl: string;

	constructor(mintUrl: string, cause?: Error) {
		super(`Failed to connect to mint ${mintUrl} after retries`);
		this.name = 'MintConnectionError';
		this.mintUrl = mintUrl;
		if (cause) {
			this.cause = cause;
		}
	}
}
