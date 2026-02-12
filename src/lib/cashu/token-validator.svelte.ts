/**
 * Reactive Cashu token verification store.
 *
 * Validates token structure, checks P2PK locktime expiry, and caches
 * verification results with a 5-minute TTL. For MVP, we do NOT contact
 * the mint — verification is structural only.
 *
 * Uses Svelte 5 runes (class-based singleton pattern).
 */

import { decodeToken } from './token';

// ── Types ───────────────────────────────────────────────────────────────────

export type TokenVerificationStatus = 'pending' | 'verified' | 'unverified' | 'invalid' | 'expired';

interface TokenVerificationEntry {
	status: TokenVerificationStatus;
	timestamp: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Cache TTL in milliseconds (5 minutes). */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Maximum retry attempts for mint verification (future use). */
const MAX_RETRIES = 3;

/** Delay between retries in milliseconds. */
const RETRY_DELAY_MS = 2000;

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute a simple hash key for a token string.
 * Uses a fast string hash since we only need cache-key uniqueness,
 * not cryptographic security.
 */
function tokenHash(token: string): string {
	let hash = 0;
	for (let i = 0; i < token.length; i++) {
		const char = token.charCodeAt(i);
		hash = ((hash << 5) - hash + char) | 0;
	}
	return `tkn_${hash.toString(36)}`;
}

/**
 * Check if a cached entry has expired (older than CACHE_TTL_MS).
 */
function isExpiredEntry(entry: TokenVerificationEntry): boolean {
	return Date.now() - entry.timestamp > CACHE_TTL_MS;
}

/**
 * Extract P2PK locktime from decoded token proofs.
 *
 * P2PK secrets follow NUT-11 format. The secret is a JSON array:
 * ["P2PK", { nonce, data, tags }]
 * where tags may include ["locktime", "<unix_timestamp>"].
 *
 * Returns the locktime as a Unix timestamp (seconds), or null if
 * no locktime is found or the secret format is unrecognized.
 */
function extractLocktime(proofs: Array<{ secret: string }>): number | null {
	for (const proof of proofs) {
		try {
			const parsed: unknown = JSON.parse(proof.secret);
			if (!Array.isArray(parsed) || parsed.length < 2) continue;
			if (parsed[0] !== 'P2PK') continue;

			const payload = parsed[1] as Record<string, unknown>;
			if (!payload || typeof payload !== 'object') continue;

			const tags = payload.tags;
			if (!Array.isArray(tags)) continue;

			for (const tag of tags) {
				if (
					Array.isArray(tag) &&
					tag.length >= 2 &&
					tag[0] === 'locktime' &&
					typeof tag[1] === 'string'
				) {
					const locktime = parseInt(tag[1], 10);
					if (!isNaN(locktime) && locktime > 0) {
						return locktime;
					}
				}
			}
		} catch {
			// Secret is not JSON — not a P2PK proof, skip
			continue;
		}
	}
	return null;
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── TokenValidator Class ────────────────────────────────────────────────────

/**
 * Reactive token verification store.
 *
 * Maintains a map of token hash → verification status, using Svelte 5
 * `$state` for reactivity. Components can read statuses reactively
 * and trigger verification via the `verify()` method.
 */
class TokenValidator {
	/**
	 * Reactive map of token hash → verification entry.
	 * Keyed by tokenHash() output for deduplication.
	 */
	#statuses = $state<Map<string, TokenVerificationEntry>>(new Map());

	/**
	 * Set of token hashes currently being verified (prevents duplicate runs).
	 */
	#pending = new Set<string>();

	/**
	 * Verify a Cashu token's structural validity.
	 *
	 * Sets status to 'pending' immediately, then performs structural checks:
	 * 1. Decode the token (failure → 'invalid')
	 * 2. Check P2PK locktime expiry (past locktime → 'expired')
	 * 3. MVP structural check (valid cashuA/cashuB prefix → 'verified')
	 *
	 * Results are cached with a 5-minute TTL. Calling verify() on a
	 * token with a valid cache entry is a no-op.
	 *
	 * @param token - Encoded Cashu token string
	 * @param mintUrl - The expected mint URL (for future mint verification)
	 */
	verify(token: string, mintUrl: string): void {
		const hash = tokenHash(token);

		// Check cache — skip if valid entry exists
		const existing = this.#statuses.get(hash);
		if (existing && !isExpiredEntry(existing) && existing.status !== 'pending') {
			return;
		}

		// Prevent duplicate concurrent verifications
		if (this.#pending.has(hash)) {
			return;
		}

		// Set pending immediately for reactive UI feedback
		this.#setStatus(hash, 'pending');
		this.#pending.add(hash);

		// Run verification asynchronously
		this.#verifyAsync(token, mintUrl, hash).finally(() => {
			this.#pending.delete(hash);
		});
	}

	/**
	 * Get the current verification status for a token.
	 *
	 * If the cached entry has expired, returns 'pending' to signal
	 * that re-verification is needed (caller should call verify() again).
	 *
	 * @param token - Encoded Cashu token string
	 * @returns Current verification status, or 'pending' if unknown/expired
	 */
	getStatus(token: string): TokenVerificationStatus {
		const hash = tokenHash(token);
		const entry = this.#statuses.get(hash);

		if (!entry) return 'pending';
		if (isExpiredEntry(entry)) return 'pending';

		return entry.status;
	}

	/**
	 * Clear all cached verification results.
	 * Useful for testing or when switching contexts.
	 */
	reset(): void {
		this.#statuses = new Map();
		this.#pending.clear();
	}

	/**
	 * Get the number of cached entries (for diagnostics).
	 */
	get size(): number {
		return this.#statuses.size;
	}

	// ── Private Methods ───────────────────────────────────────────────────

	/**
	 * Perform async token verification with retry logic.
	 */
	async #verifyAsync(token: string, mintUrl: string, hash: string): Promise<void> {
		// Step 1: Structural decode check
		const tokenInfo = decodeToken(token);

		if (!tokenInfo) {
			this.#setStatus(hash, 'invalid');
			return;
		}

		// Step 2: Validate basic token structure
		if (tokenInfo.proofs.length === 0 || tokenInfo.amount <= 0) {
			this.#setStatus(hash, 'invalid');
			return;
		}

		// Step 3: Check P2PK locktime expiry
		const locktime = extractLocktime(tokenInfo.proofs);
		if (locktime !== null) {
			const nowSeconds = Math.floor(Date.now() / 1000);
			if (locktime < nowSeconds) {
				this.#setStatus(hash, 'expired');
				return;
			}
		}

		// Step 4: Structural pre-filter (fast fail before mint contact)
		const passesStructural = this.#structuralCheck(token, mintUrl);
		if (!passesStructural) {
			this.#setStatus(hash, 'unverified');
			return;
		}

		// Step 5: Real mint verification — check proof spendability
		const isSpendable = await this.#verifyWithMint(token, mintUrl);
		this.#setStatus(hash, isSpendable ? 'verified' : 'unverified');
	}

	/**
	 * Synchronous structural check — validates token format without contacting the mint.
	 * Used as a fast pre-filter before the async mint verification.
	 */
	#structuralCheck(token: string, mintUrl: string): boolean {
		const hasValidPrefix = token.startsWith('cashuA') || token.startsWith('cashuB');
		if (!hasValidPrefix) return false;

		const tokenInfo = decodeToken(token);
		if (!tokenInfo) return false;

		// Normalize mint URLs for comparison
		const normalizedTokenMint = tokenInfo.mint.replace(/\/+$/, '');
		const normalizedExpectedMint = mintUrl.replace(/\/+$/, '');

		if (normalizedTokenMint !== normalizedExpectedMint) {
			console.warn(
				`[cashu/token-validator] Mint URL mismatch: token=${normalizedTokenMint}, expected=${normalizedExpectedMint}`
			);
			return false;
		}

		return true;
	}

	/**
	 * Verify token proofs with the mint using wallet.checkProofsStates().
	 * Retries up to MAX_RETRIES times with RETRY_DELAY_MS backoff.
	 * Gracefully degrades to 'unverified' (not 'invalid') if mint is unreachable.
	 */
	async #verifyWithMint(token: string, mintUrl: string): Promise<boolean> {
		let lastError: Error | undefined;

		for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
			try {
				// Dynamic imports to preserve code-splitting
				const { getWallet } = await import('./mint');
				const tokenInfo = decodeToken(token);
				if (!tokenInfo) return false;

				const wallet = await getWallet(mintUrl);
				const states = await wallet.checkProofsStates(tokenInfo.proofs);
				return states.every((s) => s.state === 'UNSPENT');
			} catch (err) {
				lastError = err instanceof Error ? err : new Error(String(err));
				console.warn(
					`[cashu/token-validator] Mint verification attempt ${attempt}/${MAX_RETRIES} failed: ${lastError.message}`
				);

				if (attempt < MAX_RETRIES) {
					await sleep(RETRY_DELAY_MS);
				}
			}
		}

		// All retries exhausted — mint unreachable, degrade gracefully
		console.warn(
			`[cashu/token-validator] Mint verification failed after ${MAX_RETRIES} retries, marking as unverified`
		);
		return false;
	}

	/**
	 * Update the status map reactively.
	 * Creates a new Map to trigger Svelte 5 reactivity.
	 */
	#setStatus(hash: string, status: TokenVerificationStatus): void {
		const next = new Map(this.#statuses);
		next.set(hash, { status, timestamp: Date.now() });
		this.#statuses = next;
	}
}

// ── Singleton Export ────────────────────────────────────────────────────────

/** Singleton token validator instance */
export const tokenValidator = new TokenValidator();
