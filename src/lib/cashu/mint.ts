/**
 * Singleton CashuMint and CashuWallet initialization for Bounty.ninja.
 *
 * Provides lazy-initialized wallet instances with retry logic.
 * Supports per-bounty mint overrides via mint URL parameter.
 *
 * @cashu/cashu-ts v3.x uses `Mint` and `Wallet` class names.
 */

import { Mint, Wallet } from '@cashu/cashu-ts';
import { getDefaultMint } from '$lib/utils/env';
import { MintConnectionError } from './types';

/** Maximum number of connection retries. */
const MAX_RETRIES = 3;

/** Delay between retries in milliseconds. */
const RETRY_DELAY_MS = 2000;

/**
 * Cache of initialized wallets keyed by mint URL.
 * Prevents creating duplicate Mint/Wallet instances for the same mint.
 */
const walletCache = new Map<string, Wallet>();

/**
 * Cache of Mint instances keyed by mint URL.
 * Shared across wallets that use the same mint.
 */
const mintCache = new Map<string, Mint>();

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get or create a Mint instance for the given URL.
 * Mint instances are cached and reused.
 *
 * @param mintUrl - The mint's base URL.
 * @returns A Mint instance.
 */
function getMint(mintUrl: string): Mint {
	const normalized = mintUrl.replace(/\/+$/, '');
	let mint = mintCache.get(normalized);
	if (!mint) {
		mint = new Mint(normalized);
		mintCache.set(normalized, mint);
	}
	return mint;
}

/**
 * Initialize a wallet by loading mint info, keysets, and keys.
 * Retries up to MAX_RETRIES times with RETRY_DELAY_MS between attempts.
 *
 * @param wallet - The Wallet instance to initialize.
 * @param mintUrl - The mint URL (for error reporting).
 * @throws {MintConnectionError} If all retries fail.
 */
async function initializeWallet(wallet: Wallet, mintUrl: string): Promise<void> {
	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			await wallet.loadMint();
			return;
		} catch (err) {
			lastError = err instanceof Error ? err : new Error(String(err));
			console.warn(
				`[cashu/mint] Wallet init attempt ${attempt}/${MAX_RETRIES} failed for ${mintUrl}: ${lastError.message}`
			);

			if (attempt < MAX_RETRIES) {
				await sleep(RETRY_DELAY_MS);
			}
		}
	}

	throw new MintConnectionError(mintUrl, lastError);
}

/**
 * Get a fully initialized CashuWallet for the given mint URL.
 *
 * - Creates and caches Mint + Wallet instances per URL.
 * - Calls `wallet.loadMint()` with 3-retry, 2-second delay on failure.
 * - Returns the cached wallet on subsequent calls for the same URL.
 *
 * @param mintUrl - Optional mint URL. Defaults to the configured default mint.
 * @returns A ready-to-use Wallet instance.
 * @throws {MintConnectionError} If the mint cannot be reached after retries.
 */
export async function getWallet(mintUrl?: string): Promise<Wallet> {
	const url = (mintUrl ?? getDefaultMint()).replace(/\/+$/, '');

	const cached = walletCache.get(url);
	if (cached) {
		return cached;
	}

	const mint = getMint(url);
	const wallet = new Wallet(mint, { unit: 'sat' });

	await initializeWallet(wallet, url);

	walletCache.set(url, wallet);
	return wallet;
}

/**
 * Get a wallet for a specific mint URL.
 * Alias for `getWallet(mintUrl)` with a required parameter.
 *
 * @param mintUrl - The mint URL to connect to.
 * @returns A ready-to-use Wallet instance.
 * @throws {MintConnectionError} If the mint cannot be reached after retries.
 */
export async function getWalletForMint(mintUrl: string): Promise<Wallet> {
	return getWallet(mintUrl);
}

/**
 * Get a wallet for the default mint.
 * Convenience wrapper around `getWallet()` with no arguments.
 *
 * @returns A ready-to-use Wallet instance for the default mint.
 * @throws {MintConnectionError} If the default mint cannot be reached after retries.
 */
export async function getDefaultWallet(): Promise<Wallet> {
	return getWallet();
}

/**
 * Clear all cached wallet and mint instances.
 * Useful for testing or when switching environments.
 */
export function clearWalletCache(): void {
	walletCache.clear();
	mintCache.clear();
}
