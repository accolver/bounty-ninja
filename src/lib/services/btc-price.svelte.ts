/**
 * BTC → USD price service.
 *
 * Fetches the current Bitcoin price from Kraken (primary) with CoinGecko
 * as fallback. Caches the result for 5 minutes to avoid hammering APIs.
 *
 * Both APIs are free, keyless, and support CORS from any origin.
 *
 * Uses Svelte 5 runes (class-based singleton pattern).
 */

import { storageKey } from '$lib/config';

// ── Constants ───────────────────────────────────────────────────────────────

/** How long a cached price is considered fresh (5 minutes). */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Fetch timeout to avoid hanging on unresponsive APIs. */
const FETCH_TIMEOUT_MS = 8_000;

/** localStorage key for persisting the last known price across sessions. */
const PRICE_CACHE_KEY = storageKey('btc-price');

/** Number of satoshis in 1 BTC. */
const SATS_PER_BTC = 100_000_000;

// ── Types ───────────────────────────────────────────────────────────────────

interface CachedPrice {
	usd: number;
	source: 'kraken' | 'coingecko';
	fetchedAt: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

/** Load persisted price from localStorage. */
function loadPersistedPrice(): CachedPrice | null {
	try {
		const raw = localStorage.getItem(PRICE_CACHE_KEY);
		if (!raw) return null;
		const parsed: CachedPrice = JSON.parse(raw);
		// Validate shape
		if (typeof parsed.usd !== 'number' || parsed.usd <= 0) return null;
		return parsed;
	} catch {
		return null;
	}
}

/** Persist price to localStorage for cross-session resilience. */
function persistPrice(price: CachedPrice): void {
	try {
		localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(price));
	} catch {
		// Storage full — non-critical, skip silently
	}
}

// ── API Fetchers ────────────────────────────────────────────────────────────

/**
 * Fetch BTC/USD from Kraken public ticker.
 * Response key is `XXBTZUSD` (X-prefixed), price in `c[0]` (last trade).
 */
async function fetchFromKraken(): Promise<CachedPrice> {
	const res = await fetchWithTimeout(
		'https://api.kraken.com/0/public/Ticker?pair=XBTUSD',
		FETCH_TIMEOUT_MS
	);
	if (!res.ok) throw new Error(`Kraken HTTP ${res.status}`);

	const data = await res.json();
	if (data.error?.length > 0) throw new Error(`Kraken API error: ${data.error[0]}`);

	const ticker = data.result?.XXBTZUSD;
	if (!ticker?.c?.[0]) throw new Error('Kraken: missing ticker data');

	const usd = parseFloat(ticker.c[0]);
	if (isNaN(usd) || usd <= 0) throw new Error('Kraken: invalid price');

	return { usd, source: 'kraken', fetchedAt: Date.now() };
}

/**
 * Fetch BTC/USD from CoinGecko simple price endpoint.
 * No API key required (free public tier).
 */
async function fetchFromCoinGecko(): Promise<CachedPrice> {
	const res = await fetchWithTimeout(
		'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
		FETCH_TIMEOUT_MS
	);
	if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);

	const data = await res.json();
	const usd = data?.bitcoin?.usd;
	if (typeof usd !== 'number' || usd <= 0) throw new Error('CoinGecko: invalid price');

	return { usd, source: 'coingecko', fetchedAt: Date.now() };
}

// ── BtcPriceService Class ───────────────────────────────────────────────────

class BtcPriceService {
	/** Current BTC price in USD, or null if not yet fetched. */
	#price = $state<CachedPrice | null>(null);

	/** Whether a fetch is currently in progress. */
	#loading = $state(false);

	/** Last fetch error message, or null. */
	#error = $state<string | null>(null);

	/** In-flight fetch promise to deduplicate concurrent calls. */
	#fetchPromise: Promise<void> | null = null;

	constructor() {
		// Hydrate from localStorage on init for instant display
		const persisted = loadPersistedPrice();
		if (persisted) {
			this.#price = persisted;
		}
	}

	// ── Public API ────────────────────────────────────────────────────────

	/** BTC price in USD, or null if unavailable. */
	get priceUsd(): number | null {
		return this.#price?.usd ?? null;
	}

	/** Data source of the current price. */
	get source(): string | null {
		return this.#price?.source ?? null;
	}

	/** Whether the cached price is still fresh. */
	get isFresh(): boolean {
		if (!this.#price) return false;
		return Date.now() - this.#price.fetchedAt < CACHE_TTL_MS;
	}

	/** Whether a fetch is in progress. */
	get loading(): boolean {
		return this.#loading;
	}

	/** Last error message, or null. */
	get error(): string | null {
		return this.#error;
	}

	/**
	 * Convert satoshis to USD.
	 * Returns null if no price data is available.
	 */
	satsToUsd(sats: number): number | null {
		if (!this.#price) return null;
		return (sats / SATS_PER_BTC) * this.#price.usd;
	}

	/**
	 * Format satoshis as a USD string (e.g. "$1.23").
	 * Returns null if no price data is available.
	 */
	formatSatsAsUsd(sats: number): string | null {
		const usd = this.satsToUsd(sats);
		if (usd === null) return null;

		// Use appropriate precision based on amount
		if (usd < 0.01) return '<$0.01';
		if (usd < 1) return `$${usd.toFixed(2)}`;
		if (usd < 1000) return `$${usd.toFixed(2)}`;
		return `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	/**
	 * Fetch the latest BTC price. Uses cache if fresh.
	 * Deduplicates concurrent calls.
	 */
	async fetch(): Promise<void> {
		// Return early if cache is fresh
		if (this.isFresh) return;

		// Deduplicate concurrent fetches
		if (this.#fetchPromise) return this.#fetchPromise;

		this.#fetchPromise = this.#doFetch();
		try {
			await this.#fetchPromise;
		} finally {
			this.#fetchPromise = null;
		}
	}

	// ── Private ───────────────────────────────────────────────────────────

	async #doFetch(): Promise<void> {
		this.#loading = true;
		this.#error = null;

		try {
			// Primary: Kraken (no key, generous limits, 2s freshness)
			const price = await fetchFromKraken();
			this.#price = price;
			persistPrice(price);
		} catch (krakenErr) {
			console.warn('[btc-price] Kraken failed, trying CoinGecko:', krakenErr);

			try {
				// Fallback: CoinGecko
				const price = await fetchFromCoinGecko();
				this.#price = price;
				persistPrice(price);
			} catch (geckoErr) {
				console.warn('[btc-price] CoinGecko also failed:', geckoErr);
				this.#error = 'Unable to fetch BTC price';
				// Keep using stale cached price if available — don't clear it
			}
		} finally {
			this.#loading = false;
		}
	}
}

// ── Singleton Export ────────────────────────────────────────────────────────

export const btcPrice = new BtcPriceService();
