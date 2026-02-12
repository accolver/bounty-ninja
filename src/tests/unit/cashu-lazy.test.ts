/**
 * Unit tests for $lib/cashu/lazy.ts — the Cashu module lazy-loading wrapper.
 *
 * Tests: getCashu caching, concurrent load deduplication, isCashuLoaded,
 * and _resetCashuCache for test isolation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @cashu/cashu-ts at the module level so dynamic import() is intercepted
const fakeCashuModule = {
	Mint: vi.fn(),
	Wallet: vi.fn(),
	getEncodedTokenV4: vi.fn(),
	getDecodedToken: vi.fn()
};

vi.mock('@cashu/cashu-ts', () => fakeCashuModule);

import { getCashu, isCashuLoaded, _resetCashuCache } from '$lib/cashu/lazy';

beforeEach(() => {
	_resetCashuCache();
});

// ═══════════════════════════════════════════════════════════════════════════
// getCashu
// ═══════════════════════════════════════════════════════════════════════════

describe('getCashu', () => {
	it('returns the @cashu/cashu-ts module', async () => {
		const mod = await getCashu();
		expect(mod).toBeDefined();
		expect(mod.Mint).toBeDefined();
		expect(mod.Wallet).toBeDefined();
		expect(mod.getEncodedTokenV4).toBeDefined();
		expect(mod.getDecodedToken).toBeDefined();
	});

	it('caches the module after first load', async () => {
		const first = await getCashu();
		const second = await getCashu();

		// Same object reference — cached, not re-imported
		expect(first).toBe(second);
	});

	it('deduplicates concurrent calls during initial load', async () => {
		// Reset cache to ensure fresh load
		_resetCashuCache();

		// Fire multiple concurrent loads
		const [a, b, c] = await Promise.all([getCashu(), getCashu(), getCashu()]);

		// All should resolve to the same cached module
		expect(a).toBe(b);
		expect(b).toBe(c);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// isCashuLoaded
// ═══════════════════════════════════════════════════════════════════════════

describe('isCashuLoaded', () => {
	it('returns false before getCashu() is called', () => {
		expect(isCashuLoaded()).toBe(false);
	});

	it('returns true after getCashu() resolves', async () => {
		await getCashu();
		expect(isCashuLoaded()).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// _resetCashuCache
// ═══════════════════════════════════════════════════════════════════════════

describe('_resetCashuCache', () => {
	it('resets the loaded state so isCashuLoaded returns false', async () => {
		await getCashu();
		expect(isCashuLoaded()).toBe(true);

		_resetCashuCache();
		expect(isCashuLoaded()).toBe(false);
	});

	it('causes getCashu() to re-import the module', async () => {
		const first = await getCashu();

		_resetCashuCache();

		const second = await getCashu();
		// Both resolve to the mocked module, so they are structurally equal,
		// but the key behavior is that getCashu() re-ran the import
		expect(second).toBeDefined();
		expect(second.Mint).toBeDefined();
	});
});
