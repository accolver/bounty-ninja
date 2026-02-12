import { describe, it, expect, vi } from 'vitest';

// Mock the SvelteKit env module before importing
vi.mock('$env/dynamic/public', () => ({
	env: {}
}));

const { getDefaultRelays, getDefaultMint, getAppName, getAppUrl, getMinSubmissionFee, getMaxSubmissionFee, getSearchRelay } = await import('$lib/utils/env');

describe('env accessors', () => {
	it('getDefaultRelays returns fallback relay list when env is undefined', () => {
		const relays = getDefaultRelays();
		expect(relays).toBeInstanceOf(Array);
		expect(relays.length).toBeGreaterThanOrEqual(2);
		expect(relays[0]).toMatch(/^wss:\/\//);
	});

	it('getDefaultMint returns fallback mint URL', () => {
		const mint = getDefaultMint();
		expect(mint).toMatch(/^https:\/\//);
	});

	it('getAppName returns fallback name', () => {
		expect(getAppName()).toBe('Bounty.ninja');
	});

	it('getAppUrl returns fallback URL', () => {
		expect(getAppUrl()).toMatch(/^https:\/\//);
	});

	it('getMinSubmissionFee returns a number', () => {
		const fee = getMinSubmissionFee();
		expect(typeof fee).toBe('number');
		expect(fee).toBeGreaterThan(0);
	});

	it('getMaxSubmissionFee returns a number greater than min', () => {
		const max = getMaxSubmissionFee();
		const min = getMinSubmissionFee();
		expect(max).toBeGreaterThan(min);
	});

	it('getSearchRelay returns a wss URL', () => {
		expect(getSearchRelay()).toMatch(/^wss:\/\//);
	});
});
