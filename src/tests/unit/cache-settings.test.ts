import { beforeEach, describe, expect, it } from 'vitest';
import {
	CACHE_LIMITS_KEY,
	DEFAULT_CACHE_LIMITS,
	getSavedEvictionConfig,
	loadCacheLimits,
	saveCacheLimits
} from '$lib/nostr/cache-settings';

describe('cache settings', () => {
	beforeEach(() => localStorage.clear());

	it('converts saved limits to eviction configuration', () => {
		saveCacheLimits({ maxEvents: 5_000, maxAgeDays: 7 });

		expect(getSavedEvictionConfig()).toEqual({
			maxEvents: 5_000,
			maxAgeMs: 7 * 24 * 60 * 60 * 1000
		});
	});

	it.each([
		'not-json',
		JSON.stringify({ maxEvents: 999, maxAgeDays: 7 }),
		JSON.stringify({ maxEvents: 5_000, maxAgeDays: 0 }),
		JSON.stringify({ maxEvents: '5000', maxAgeDays: 7 })
	])('uses safe defaults for invalid saved limits', (stored) => {
		localStorage.setItem(CACHE_LIMITS_KEY, stored);
		expect(loadCacheLimits()).toEqual(DEFAULT_CACHE_LIMITS);
	});
});
