import { beforeEach, describe, it, expect, vi } from 'vitest';

const { publicEnv } = vi.hoisted(() => ({
	publicEnv: {} as Record<string, string | undefined>
}));

// Mock the SvelteKit env module before importing
vi.mock('$env/dynamic/public', () => ({
	env: publicEnv
}));

const {
	getDefaultRelays,
	getDefaultMint,
	arePaymentWritesEnabled,
	getAppName,
	getAppUrl,
	getMinSubmissionFee,
	getMaxSubmissionFee,
	getSearchRelay
} = await import('$lib/utils/env');

describe('env accessors', () => {
	beforeEach(() => {
		for (const key of Object.keys(publicEnv)) delete publicEnv[key];
		localStorage.clear();
	});

	it('getDefaultRelays returns fallback relay list when env is undefined', () => {
		const relays = getDefaultRelays();
		expect(relays).toBeInstanceOf(Array);
		expect(relays.length).toBeGreaterThanOrEqual(2);
		expect(relays[0]).toMatch(/^wss:\/\//);
	});

	it('allows insecure private relay defaults only for a loopback-hosted app', () => {
		publicEnv.PUBLIC_DEFAULT_RELAYS = 'ws://127.0.0.1:10547,wss://relay.example.com';
		expect(getDefaultRelays()).toEqual(['ws://127.0.0.1:10547', 'wss://relay.example.com']);
	});

	it('allows saved loopback relays for a loopback-hosted app', () => {
		localStorage.setItem(
			'bounty.ninja:settings',
			JSON.stringify({ relays: ['ws://127.0.0.1:10547', 'ws://127.0.0.1:10548'] })
		);
		expect(getDefaultRelays()).toEqual(['ws://127.0.0.1:10547', 'ws://127.0.0.1:10548']);
	});

	it('getDefaultMint returns fallback mint URL', () => {
		const mint = getDefaultMint();
		expect(mint).toMatch(/^https:\/\//);
	});

	it('disables payment writes by default', () => {
		expect(arePaymentWritesEnabled()).toBe(false);
	});

	it('enables payment writes only for an explicit true value', () => {
		publicEnv.PUBLIC_PAYMENT_WRITES_ENABLED = 'true';
		expect(arePaymentWritesEnabled()).toBe(true);

		publicEnv.PUBLIC_PAYMENT_WRITES_ENABLED = ' TRUE ';
		expect(arePaymentWritesEnabled()).toBe(true);
	});

	it.each(['false', '1', 'yes', 'enabled', ''])('fails closed for %j', (value) => {
		publicEnv.PUBLIC_PAYMENT_WRITES_ENABLED = value;
		expect(arePaymentWritesEnabled()).toBe(false);
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
