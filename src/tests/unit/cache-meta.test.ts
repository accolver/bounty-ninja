import { describe, it, expect, beforeEach } from 'vitest';
import { hashFilters, recordQueryFetch, getQueryMeta, isQueryFresh, clearCacheMeta, FRESHNESS } from '$lib/nostr/cache-meta';

describe('cache-meta', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	describe('hashFilters', () => {
		it('produces deterministic hashes', () => {
			const filters = [{ kinds: [0], authors: ['abc'] }];
			const hash1 = hashFilters(filters);
			const hash2 = hashFilters(filters);
			expect(hash1).toBe(hash2);
		});

		it('produces same hash regardless of key order', () => {
			const f1 = [{ authors: ['abc'], kinds: [0] }];
			const f2 = [{ kinds: [0], authors: ['abc'] }];
			expect(hashFilters(f1)).toBe(hashFilters(f2));
		});

		it('produces same hash regardless of array value order', () => {
			const f1 = [{ kinds: [0, 1] }];
			const f2 = [{ kinds: [1, 0] }];
			expect(hashFilters(f1)).toBe(hashFilters(f2));
		});

		it('produces different hashes for different filters', () => {
			const f1 = [{ kinds: [0] }];
			const f2 = [{ kinds: [1] }];
			expect(hashFilters(f1)).not.toBe(hashFilters(f2));
		});

		it('returns 8-char hex string', () => {
			const hash = hashFilters([{ kinds: [0] }]);
			expect(hash).toMatch(/^[0-9a-f]{8}$/);
		});
	});

	describe('recordQueryFetch / getQueryMeta', () => {
		it('records and retrieves query metadata', () => {
			recordQueryFetch('abc123', 42);
			const meta = getQueryMeta('abc123');
			expect(meta).not.toBeNull();
			expect(meta!.eventCount).toBe(42);
			expect(meta!.lastFetched).toBeGreaterThan(0);
		});

		it('returns null for unknown hash', () => {
			expect(getQueryMeta('unknown')).toBeNull();
		});

		it('overwrites previous entry', () => {
			recordQueryFetch('abc123', 10);
			recordQueryFetch('abc123', 20);
			expect(getQueryMeta('abc123')!.eventCount).toBe(20);
		});
	});

	describe('isQueryFresh', () => {
		it('returns false for unknown query', () => {
			expect(isQueryFresh('unknown', 60_000)).toBe(false);
		});

		it('returns true for recently fetched query', () => {
			recordQueryFetch('abc123', 5);
			expect(isQueryFresh('abc123', 60_000)).toBe(true);
		});

		it('returns false for expired query', () => {
			// Manually set old timestamp
			const store = {
				queries: {
					old: { lastFetched: Date.now() - 120_000, eventCount: 5 }
				},
				version: 1
			};
			localStorage.setItem('bounty.ninja:cache-meta', JSON.stringify(store));
			expect(isQueryFresh('old', 60_000)).toBe(false);
		});
	});

	describe('clearCacheMeta', () => {
		it('removes all metadata', () => {
			recordQueryFetch('abc', 1);
			clearCacheMeta();
			expect(getQueryMeta('abc')).toBeNull();
		});
	});

	describe('FRESHNESS constants', () => {
		it('has expected values', () => {
			expect(FRESHNESS.BOUNTY_LIST).toBe(120_000);
			expect(FRESHNESS.BOUNTY_DETAIL).toBe(300_000);
			expect(FRESHNESS.PROFILE).toBe(900_000);
			expect(FRESHNESS.APPLICATIONS).toBe(60_000);
		});
	});
});
