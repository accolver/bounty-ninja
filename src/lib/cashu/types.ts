/**
 * Cashu payment layer types for Bounty.ninja.
 *
 * These types complement @cashu/cashu-ts types (Proof, Token, etc.)
 * with domain-specific structures for the bounty escrow workflow.
 */

import type { Proof, Token } from '@cashu/cashu-ts';

// ── Financial Verification ──────────────────────────────────────────────────

/** Financial checks are fail-closed: only `valid` records contribute value. */
export type VerificationStatus = 'pending' | 'valid' | 'invalid' | 'unavailable';

/** Mint-scoped Cashu proof identity: normalized mint URL plus NUT-00 Y. */
export type ProofIdentity = string & { readonly __proofIdentity: unique symbol };

export type PledgeInvalidReason =
	| 'wrong_bounty'
	| 'missing_payment_key'
	| 'decode_failed'
	| 'wrong_unit'
	| 'missing_proofs'
	| 'invalid_amount'
	| 'amount_mismatch'
	| 'mint_mismatch'
	| 'nut11_unsupported'
	| 'mint_unavailable'
	| 'proof_state_mismatch'
	| 'spent_proof'
	| 'pending_proof'
	| 'duplicate_proof'
	| 'not_p2pk'
	| 'p2pk_target_mismatch'
	| 'locktime_mismatch'
	| 'refund_policy_mismatch'
	| 'signature_policy_mismatch'
	| 'inconsistent_proof_conditions';

/** Result of validating one pledge against its bounty and supported mint guarantees. */
export interface PledgeVerification {
	pledgeId: string;
	status: VerificationStatus;
	policyVersion: number;
	checkedAt: number;
	validUntil: number | null;
	normalizedMint: string | null;
	decodedAmount: number | null;
	proofIdentities: readonly ProofIdentity[];
	reasons: readonly PledgeInvalidReason[];
}

export type CashuTokenInvalidReason =
	| 'decode_failed'
	| 'missing_payment_key'
	| 'wrong_unit'
	| 'missing_proofs'
	| 'invalid_amount'
	| 'mint_mismatch'
	| 'nut11_unsupported'
	| 'mint_unavailable'
	| 'amount_mismatch'
	| 'proof_state_mismatch'
	| 'spent_proof'
	| 'pending_proof'
	| 'duplicate_proof'
	| 'not_p2pk'
	| 'p2pk_target_mismatch'
	| 'inconsistent_proof_conditions';

/** Verification record for source-bound payout token validation. */
export interface CashuTokenVerification {
	status: VerificationStatus;
	policyVersion: number;
	checkedAt: number;
	validUntil: number | null;
	normalizedMint: string | null;
	decodedAmount: number | null;
	proofIdentities: readonly ProofIdentity[];
	p2pkTarget: string | null;
	reasons: readonly CashuTokenInvalidReason[];
}

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
	 * Hex-encoded public keys that can spend after locktime expires.
	 * Required whenever `refundLocktimeUnix` is present.
	 */
	refundKeys?: string[];
}

// ── Escrow State ────────────────────────────────────────────────────────────

/**
 * Lifecycle state of escrowed Cashu tokens within a bounty.
 *
 * - `locked`    — Tokens are P2PK-locked to the pledger's own pubkey (self-custody).
 * - `released`  — Pledger has swapped tokens to solver-locked proofs after consensus.
 * - `reclaimed` — Pledger took back their tokens (e.g. after deadline or early reclaim).
 * - `expired`   — The locktime passed without the pledger taking action.
 */
export type EscrowState = 'locked' | 'released' | 'reclaimed' | 'expired';

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
