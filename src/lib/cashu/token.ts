/**
 * Token encoding/decoding utilities for Cashu tokens.
 *
 * Wraps @cashu/cashu-ts encoding functions with graceful error handling
 * suitable for a client-side application where malformed tokens from
 * Nostr events should not crash the UI.
 *
 * All functions that interact with @cashu/cashu-ts are async to support
 * lazy-loading of the library for bundle size optimization.
 */

import type { Proof, Token } from '@cashu/cashu-ts';
import { getCashu } from './lazy';
import type { TokenInfo } from './types';

/**
 * Encode proofs into a Cashu v4 token string.
 *
 * @param proofs - Array of Cashu proofs to encode.
 * @param mint - The mint URL these proofs belong to.
 * @param memo - Optional memo to include in the token.
 * @returns Encoded token string (cashuB...).
 */
export async function encodeToken(proofs: Proof[], mint: string, memo?: string): Promise<string> {
	const { getEncodedTokenV4 } = await getCashu();
	const token: Token = {
		mint,
		proofs,
		unit: 'sat',
		...(memo ? { memo } : {})
	};
	return getEncodedTokenV4(token);
}

/**
 * Decode a Cashu token string into its constituent parts.
 *
 * Handles malformed tokens gracefully by returning null and logging a warning.
 *
 * @param tokenStr - Encoded Cashu token string (cashuA... or cashuB...).
 * @returns Decoded TokenInfo or null if the token is invalid.
 */
export async function decodeToken(tokenStr: string): Promise<TokenInfo | null> {
	try {
		const { getDecodedToken } = await getCashu();
		const decoded = getDecodedToken(tokenStr);
		const amount = decoded.proofs.reduce((sum, p) => sum + p.amount, 0);

		return {
			mint: decoded.mint,
			amount,
			proofs: decoded.proofs,
			memo: decoded.memo,
			unit: decoded.unit
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.warn(`[cashu/token] Failed to decode token: ${message}`);
		return null;
	}
}

/**
 * Compute the total satoshi amount from a Cashu token string.
 *
 * Returns 0 for malformed tokens with a console warning.
 *
 * @param tokenStr - Encoded Cashu token string.
 * @returns Total amount in satoshis, or 0 if the token is invalid.
 */
export async function getTokenAmount(tokenStr: string): Promise<number> {
	try {
		const { getDecodedToken } = await getCashu();
		const decoded = getDecodedToken(tokenStr);
		return decoded.proofs.reduce((sum, p) => sum + p.amount, 0);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.warn(`[cashu/token] Failed to get token amount: ${message}`);
		return 0;
	}
}

/**
 * Compute the total satoshi amount from an array of proofs.
 *
 * Pure function — no mint interaction or library import needed.
 *
 * @param proofs - Array of Cashu proofs.
 * @returns Total amount in satoshis.
 */
export function getProofsAmount(proofs: Proof[]): number {
	return proofs.reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Validate that a token string can be decoded and has a positive amount.
 *
 * @param tokenStr - Encoded Cashu token string.
 * @returns True if the token is valid and has amount > 0.
 */
export async function isValidToken(tokenStr: string): Promise<boolean> {
	const info = await decodeToken(tokenStr);
	return info !== null && info.amount > 0 && info.proofs.length > 0;
}

// ── Anti-Spam Fee Validation ────────────────────────────────────────────────

/**
 * Result of anti-spam fee token validation.
 */
export interface AntiSpamFeeValidation {
	/** Whether the token passes all validation checks. */
	valid: boolean;
	/** Human-readable error message if validation failed. */
	error?: string;
	/** Decoded token info if the token was successfully decoded. */
	tokenInfo?: TokenInfo;
}

/**
 * Validate a Cashu token string for use as an anti-spam submission fee.
 *
 * Checks:
 * 1. Token can be decoded (valid Cashu format).
 * 2. Token amount >= required fee.
 *
 * If `requiredFee` is 0, validation is skipped and the result is always valid.
 *
 * @param tokenStr - The raw Cashu token string pasted by the user.
 * @param requiredFee - The minimum fee in sats required by the bounty.
 * @returns Validation result with decoded info or error message.
 */
export async function validateAntiSpamFee(tokenStr: string, requiredFee: number): Promise<AntiSpamFeeValidation> {
	// No fee required — always valid
	if (requiredFee <= 0) {
		return { valid: true };
	}

	const trimmed = tokenStr.trim();

	// Empty token when fee is required
	if (!trimmed) {
		return { valid: false, error: 'Anti-spam fee token is required' };
	}

	// Must start with cashuA or cashuB prefix
	if (!trimmed.startsWith('cashuA') && !trimmed.startsWith('cashuB')) {
		return { valid: false, error: 'Token must start with cashuA or cashuB' };
	}

	// Attempt to decode
	const info = await decodeToken(trimmed);
	if (!info) {
		return { valid: false, error: 'Invalid Cashu token — could not decode' };
	}

	// Check amount meets minimum
	if (info.amount < requiredFee) {
		return {
			valid: false,
			error: `Token amount (${info.amount} sats) is less than the required fee (${requiredFee} sats)`,
			tokenInfo: info
		};
	}

	return { valid: true, tokenInfo: info };
}
