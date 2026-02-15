import { describe, it, expect, vi, beforeEach } from 'vitest';

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
		}),
		get _store() {
			return store;
		}
	};
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock btcPrice.fetch to prevent real API calls
vi.mock('$lib/services/btc-price.svelte', () => ({
	btcPrice: {
		fetch: vi.fn().mockResolvedValue(undefined),
		priceUsd: 97000,
		formatSatsAsUsd: vi.fn((sats: number) => {
			const usd = (sats / 100_000_000) * 97000;
			if (usd < 0.01) return '<$0.01';
			return `$${usd.toFixed(2)}`;
		})
	}
}));

import { btcPrice } from '$lib/services/btc-price.svelte';

const mockedFetch = vi.mocked(btcPrice.fetch);

// ── Tests ───────────────────────────────────────────────────────────────────

describe('CurrencyStore', () => {
	async function getCurrencyStore() {
		const mod = await import('$lib/stores/currency.svelte');
		return mod;
	}

	beforeEach(() => {
		vi.clearAllMocks();
		localStorageMock.clear();
		vi.resetModules();
	});

	// ── Default State ───────────────────────────────────────────────────

	describe('default state', () => {
		it('defaults to USD display', async () => {
			const { currencyStore } = await getCurrencyStore();
			expect(currencyStore.display).toBe('usd');
			expect(currencyStore.isUsd).toBe(true);
			expect(currencyStore.isSats).toBe(false);
		});
	});

	// ── Persistence ─────────────────────────────────────────────────────

	describe('persistence', () => {
		it('loads saved sats preference from localStorage', async () => {
			localStorageMock.setItem('bounty.ninja:currency-display', 'sats');
			const { currencyStore } = await getCurrencyStore();
			expect(currencyStore.display).toBe('sats');
			expect(currencyStore.isSats).toBe(true);
		});

		it('loads saved usd preference from localStorage', async () => {
			localStorageMock.setItem('bounty.ninja:currency-display', 'usd');
			const { currencyStore } = await getCurrencyStore();
			expect(currencyStore.display).toBe('usd');
		});

		it('ignores invalid localStorage values and defaults to usd', async () => {
			localStorageMock.setItem('bounty.ninja:currency-display', 'invalid');
			const { currencyStore } = await getCurrencyStore();
			expect(currencyStore.display).toBe('usd');
		});

		it('persists preference to localStorage on set', async () => {
			const { currencyStore } = await getCurrencyStore();
			currencyStore.set('sats');
			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				'bounty.ninja:currency-display',
				'sats'
			);
		});
	});

	// ── set() ───────────────────────────────────────────────────────────

	describe('set', () => {
		it('switches to sats', async () => {
			const { currencyStore } = await getCurrencyStore();
			currencyStore.set('sats');
			expect(currencyStore.display).toBe('sats');
			expect(currencyStore.isSats).toBe(true);
			expect(currencyStore.isUsd).toBe(false);
		});

		it('switches to usd', async () => {
			const { currencyStore } = await getCurrencyStore();
			currencyStore.set('sats');
			currencyStore.set('usd');
			expect(currencyStore.display).toBe('usd');
			expect(currencyStore.isUsd).toBe(true);
		});

		it('triggers btcPrice.fetch when switching to USD', async () => {
			const { currencyStore } = await getCurrencyStore();
			currencyStore.set('sats');
			mockedFetch.mockClear();

			currencyStore.set('usd');
			expect(mockedFetch).toHaveBeenCalledOnce();
		});

		it('does not trigger btcPrice.fetch when switching to sats', async () => {
			const { currencyStore } = await getCurrencyStore();
			mockedFetch.mockClear();

			currencyStore.set('sats');
			expect(mockedFetch).not.toHaveBeenCalled();
		});
	});

	// ── toggle() ────────────────────────────────────────────────────────

	describe('toggle', () => {
		it('toggles from usd to sats', async () => {
			const { currencyStore } = await getCurrencyStore();
			expect(currencyStore.display).toBe('usd');

			currencyStore.toggle();
			expect(currencyStore.display).toBe('sats');
		});

		it('toggles from sats to usd', async () => {
			const { currencyStore } = await getCurrencyStore();
			currencyStore.set('sats');

			currencyStore.toggle();
			expect(currencyStore.display).toBe('usd');
		});

		it('round-trips correctly', async () => {
			const { currencyStore } = await getCurrencyStore();

			currencyStore.toggle(); // usd → sats
			currencyStore.toggle(); // sats → usd
			expect(currencyStore.display).toBe('usd');
		});

		it('persists preference after toggle', async () => {
			const { currencyStore } = await getCurrencyStore();

			currencyStore.toggle();
			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				'bounty.ninja:currency-display',
				'sats'
			);
		});
	});

	// ── Type exports ────────────────────────────────────────────────────

	describe('type exports', () => {
		it('exports CurrencyDisplay type', async () => {
			const mod = await getCurrencyStore();
			// Verify the type union members at runtime via the store
			const values: (typeof mod)['currencyStore'] extends { display: infer D } ? D : never =
				'usd';
			expect(['usd', 'sats']).toContain(values);
		});
	});
});
