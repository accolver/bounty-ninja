import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] ?? null),
		setItem: vi.fn((key: string, value: string) => {
			store[key] = value;
		}),
		removeItem: vi.fn((key: string) => {
			delete store[key];
		}),
		clear: vi.fn(() => {
			store = {};
		})
	};
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock AbortController
class MockAbortController {
	signal = { aborted: false };
	abort() {
		this.signal.aborted = true;
	}
}
vi.stubGlobal('AbortController', MockAbortController);

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Kraken API success response */
function krakenResponse(price = 97000.5) {
	return {
		ok: true,
		json: () =>
			Promise.resolve({
				error: [],
				result: {
					XXBTZUSD: {
						a: [String(price + 1), '1', '1.000'],
						b: [String(price - 1), '1', '1.000'],
						c: [String(price), '0.001'],
						v: ['100', '1000'],
						p: [String(price), String(price)],
						t: [100, 1000],
						l: [String(price - 100), String(price - 200)],
						h: [String(price + 100), String(price + 200)],
						o: String(price - 50)
					}
				}
			})
	};
}

/** CoinGecko API success response */
function coingeckoResponse(price = 97000.5) {
	return {
		ok: true,
		json: () =>
			Promise.resolve({
				bitcoin: { usd: price }
			})
	};
}

/** Network error */
function networkError() {
	return Promise.reject(new Error('Network error'));
}

/** HTTP error response */
function httpError(status = 500) {
	return {
		ok: false,
		status,
		json: () => Promise.resolve({})
	};
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('BtcPriceService', () => {
	let btcPrice: Awaited<ReturnType<typeof getBtcPrice>>;

	async function getBtcPrice() {
		const mod = await import('$lib/services/btc-price.svelte');
		return mod.btcPrice;
	}

	beforeEach(async () => {
		vi.clearAllMocks();
		localStorageMock.clear();
		vi.resetModules();
		btcPrice = await getBtcPrice();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// ── Initial State ───────────────────────────────────────────────────

	describe('initial state', () => {
		it('starts with null price when no cached data', () => {
			expect(btcPrice.priceUsd).toBeNull();
		});

		it('starts with no error', () => {
			expect(btcPrice.error).toBeNull();
		});

		it('starts not loading', () => {
			expect(btcPrice.loading).toBe(false);
		});

		it('reports cache as not fresh when empty', () => {
			expect(btcPrice.isFresh).toBe(false);
		});
	});

	// ── Kraken (Primary) ────────────────────────────────────────────────

	describe('fetch — Kraken primary', () => {
		it('fetches price from Kraken successfully', async () => {
			mockFetch.mockResolvedValueOnce(krakenResponse(97000));

			await btcPrice.fetch();

			expect(btcPrice.priceUsd).toBe(97000);
			expect(btcPrice.source).toBe('kraken');
			expect(btcPrice.isFresh).toBe(true);
			expect(btcPrice.error).toBeNull();
		});

		it('calls Kraken endpoint with correct URL', async () => {
			mockFetch.mockResolvedValueOnce(krakenResponse());

			await btcPrice.fetch();

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.kraken.com/0/public/Ticker?pair=XBTUSD',
				expect.objectContaining({ signal: expect.any(Object) })
			);
		});

		it('persists price to localStorage after successful fetch', async () => {
			mockFetch.mockResolvedValueOnce(krakenResponse(97500));

			await btcPrice.fetch();

			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				expect.stringContaining('btc-price'),
				expect.stringContaining('97500')
			);
		});
	});

	// ── CoinGecko (Fallback) ────────────────────────────────────────────

	describe('fetch — CoinGecko fallback', () => {
		it('falls back to CoinGecko when Kraken fails', async () => {
			mockFetch
				.mockRejectedValueOnce(new Error('Kraken down'))
				.mockResolvedValueOnce(coingeckoResponse(96000));

			await btcPrice.fetch();

			expect(btcPrice.priceUsd).toBe(96000);
			expect(btcPrice.source).toBe('coingecko');
		});

		it('falls back to CoinGecko when Kraken returns HTTP error', async () => {
			mockFetch
				.mockResolvedValueOnce(httpError(503))
				.mockResolvedValueOnce(coingeckoResponse(95500));

			await btcPrice.fetch();

			expect(btcPrice.priceUsd).toBe(95500);
			expect(btcPrice.source).toBe('coingecko');
		});

		it('falls back to CoinGecko when Kraken returns API error', async () => {
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ error: ['EGeneral:Internal error'], result: {} })
				})
				.mockResolvedValueOnce(coingeckoResponse(94000));

			await btcPrice.fetch();

			expect(btcPrice.priceUsd).toBe(94000);
			expect(btcPrice.source).toBe('coingecko');
		});
	});

	// ── Both APIs fail ──────────────────────────────────────────────────

	describe('fetch — both APIs fail', () => {
		it('sets error when both Kraken and CoinGecko fail', async () => {
			mockFetch
				.mockRejectedValueOnce(new Error('Kraken down'))
				.mockRejectedValueOnce(new Error('CoinGecko down'));

			await btcPrice.fetch();

			expect(btcPrice.error).toBe('Unable to fetch BTC price');
			expect(btcPrice.loading).toBe(false);
		});

		it('keeps stale cached price when both APIs fail', async () => {
			// First fetch succeeds
			mockFetch.mockResolvedValueOnce(krakenResponse(90000));
			await btcPrice.fetch();
			expect(btcPrice.priceUsd).toBe(90000);

			// Manually expire the cache by advancing time
			vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 10 * 60 * 1000);

			// Second fetch fails
			mockFetch
				.mockRejectedValueOnce(new Error('Kraken down'))
				.mockRejectedValueOnce(new Error('CoinGecko down'));

			await btcPrice.fetch();

			// Stale price should still be available
			expect(btcPrice.priceUsd).toBe(90000);
		});
	});

	// ── Caching ─────────────────────────────────────────────────────────

	describe('caching', () => {
		it('does not refetch when cache is fresh', async () => {
			mockFetch.mockResolvedValueOnce(krakenResponse(97000));

			await btcPrice.fetch();
			expect(mockFetch).toHaveBeenCalledTimes(1);

			// Second fetch should be a no-op
			await btcPrice.fetch();
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});
	});

	// ── satsToUsd ───────────────────────────────────────────────────────

	describe('satsToUsd', () => {
		it('returns null when no price is available', () => {
			expect(btcPrice.satsToUsd(50000)).toBeNull();
		});

		it('converts sats to USD correctly', async () => {
			mockFetch.mockResolvedValueOnce(krakenResponse(100000));
			await btcPrice.fetch();

			// 50,000 sats at $100,000/BTC = $50
			const usd = btcPrice.satsToUsd(50000);
			expect(usd).toBeCloseTo(50, 1);
		});

		it('handles small sat amounts', async () => {
			mockFetch.mockResolvedValueOnce(krakenResponse(100000));
			await btcPrice.fetch();

			// 100 sats at $100,000/BTC = $0.10
			const usd = btcPrice.satsToUsd(100);
			expect(usd).toBeCloseTo(0.1, 2);
		});

		it('handles zero sats', async () => {
			mockFetch.mockResolvedValueOnce(krakenResponse(100000));
			await btcPrice.fetch();

			expect(btcPrice.satsToUsd(0)).toBe(0);
		});
	});

	// ── formatSatsAsUsd ─────────────────────────────────────────────────

	describe('formatSatsAsUsd', () => {
		it('returns null when no price is available', () => {
			expect(btcPrice.formatSatsAsUsd(50000)).toBeNull();
		});

		it('formats large amounts with dollar sign', async () => {
			mockFetch.mockResolvedValueOnce(krakenResponse(100000));
			await btcPrice.fetch();

			// 50,000 sats at $100k/BTC = $50.00
			const formatted = btcPrice.formatSatsAsUsd(50000);
			expect(formatted).toContain('$');
			expect(formatted).toContain('50');
		});

		it('formats small amounts with cents', async () => {
			mockFetch.mockResolvedValueOnce(krakenResponse(100000));
			await btcPrice.fetch();

			// 100 sats at $100k/BTC = $0.10
			const formatted = btcPrice.formatSatsAsUsd(100);
			expect(formatted).toContain('$');
			expect(formatted).toContain('0.10');
		});

		it('returns <$0.01 for tiny amounts', async () => {
			mockFetch.mockResolvedValueOnce(krakenResponse(100000));
			await btcPrice.fetch();

			// 1 sat at $100k/BTC = $0.001
			const formatted = btcPrice.formatSatsAsUsd(1);
			expect(formatted).toBe('<$0.01');
		});

		it('formats thousand-dollar amounts with separators', async () => {
			mockFetch.mockResolvedValueOnce(krakenResponse(100000));
			await btcPrice.fetch();

			// 5,000,000 sats at $100k/BTC = $5,000.00
			const formatted = btcPrice.formatSatsAsUsd(5_000_000);
			expect(formatted).toContain('$');
			expect(formatted).toMatch(/5[,.]?000/);
		});
	});

	// ── Kraken response validation ──────────────────────────────────────

	describe('Kraken response validation', () => {
		it('rejects missing XXBTZUSD key', async () => {
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ error: [], result: { OTHER: {} } })
				})
				.mockResolvedValueOnce(coingeckoResponse(95000));

			await btcPrice.fetch();
			// Should have fallen back to CoinGecko
			expect(btcPrice.source).toBe('coingecko');
		});

		it('rejects NaN price from Kraken', async () => {
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							error: [],
							result: { XXBTZUSD: { c: ['not-a-number', '0.001'] } }
						})
				})
				.mockResolvedValueOnce(coingeckoResponse(95000));

			await btcPrice.fetch();
			expect(btcPrice.source).toBe('coingecko');
		});

		it('rejects zero price from Kraken', async () => {
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							error: [],
							result: { XXBTZUSD: { c: ['0', '0.001'] } }
						})
				})
				.mockResolvedValueOnce(coingeckoResponse(95000));

			await btcPrice.fetch();
			expect(btcPrice.source).toBe('coingecko');
		});
	});

	// ── CoinGecko response validation ───────────────────────────────────

	describe('CoinGecko response validation', () => {
		it('rejects missing bitcoin.usd field', async () => {
			mockFetch
				.mockRejectedValueOnce(new Error('Kraken down'))
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ bitcoin: {} })
				});

			await btcPrice.fetch();
			expect(btcPrice.error).toBe('Unable to fetch BTC price');
		});

		it('rejects zero price from CoinGecko', async () => {
			mockFetch
				.mockRejectedValueOnce(new Error('Kraken down'))
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ bitcoin: { usd: 0 } })
				});

			await btcPrice.fetch();
			expect(btcPrice.error).toBe('Unable to fetch BTC price');
		});

		it('rejects non-number price from CoinGecko', async () => {
			mockFetch
				.mockRejectedValueOnce(new Error('Kraken down'))
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ bitcoin: { usd: 'bad' } })
				});

			await btcPrice.fetch();
			expect(btcPrice.error).toBe('Unable to fetch BTC price');
		});
	});

	// ── Fetch deduplication ─────────────────────────────────────────────

	describe('fetch deduplication', () => {
		it('deduplicates concurrent fetch calls', async () => {
			mockFetch.mockResolvedValueOnce(krakenResponse(97000));

			// Manually expire cache to force fetching
			vi.spyOn(Date, 'now')
				.mockReturnValueOnce(0) // isFresh check
				.mockReturnValue(Date.now()); // everything else uses real time

			const p1 = btcPrice.fetch();
			const p2 = btcPrice.fetch();

			await Promise.all([p1, p2]);

			// Only one actual fetch should have been made
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});
	});
});
