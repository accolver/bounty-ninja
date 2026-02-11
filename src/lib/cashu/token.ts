/**
 * Token encoding/decoding utilities for Cashu tokens.
 *
 * Wraps @cashu/cashu-ts encoding functions with graceful error handling
 * suitable for a client-side application where malformed tokens from
 * Nostr events should not crash the UI.
 */

import { getEncodedTokenV4, getDecodedToken, type Proof, type Token } from '@cashu/cashu-ts';
import type { TokenInfo } from './types';

/**
 * Encode proofs into a Cashu v4 token string.
 *
 * @param proofs - Array of Cashu proofs to encode.
 * @param mint - The mint URL these proofs belong to.
 * @param memo - Optional memo to include in the token.
 * @returns Encoded token string (cashuB...).
 */
export function encodeToken(proofs: Proof[], mint: string, memo?: string): string {
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
export function decodeToken(tokenStr: string): TokenInfo | null {
	try {
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
export function getTokenAmount(tokenStr: string): number {
	try {
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
 * Pure function — no mint interaction needed.
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
export function isValidToken(tokenStr: string): boolean {
	const info = decodeToken(tokenStr);
	return info !== null && info.amount > 0 && info.proofs.length > 0;
}
