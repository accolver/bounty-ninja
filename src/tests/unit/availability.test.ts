import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('availability state', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal('navigator', { onLine: true });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('tracks relay coverage separately from browser connectivity', async () => {
		const { availability } = await import('$lib/stores/availability.svelte');

		availability.setRelayCoverage(0, 3);
		expect(availability.browser).toEqual({ status: 'online' });
		expect(availability.relays).toEqual({ status: 'unavailable', connected: 0, total: 3 });
		expect(availability.publication).toEqual({
			status: 'blocked',
			reason: 'relay-unavailable'
		});

		availability.setRelayCoverage(1, 3);
		expect(availability.relays).toEqual({ status: 'partial', connected: 1, total: 3 });
		expect(availability.publication).toEqual({ status: 'ready' });

		availability.setRelayCoverage(3, 3);
		expect(availability.relays).toEqual({ status: 'ready', connected: 3, total: 3 });
	});

	it('tracks mint, cache freshness, and publication attempts independently', async () => {
		const now = vi.spyOn(Date, 'now').mockReturnValue(1234);
		const { availability } = await import('$lib/stores/availability.svelte');
		availability.setRelayCoverage(1, 1);

		availability.checkingMint();
		availability.mintUnavailable();
		availability.setCacheFreshness(true);
		availability.publicationStarted();

		expect(availability.mint).toEqual({ status: 'unavailable', checkedAt: 1234 });
		expect(availability.cache).toEqual({ status: 'stale', checkedAt: 1234 });
		expect(availability.publication).toEqual({ status: 'publishing' });

		availability.publicationFailed();
		expect(availability.publication).toEqual({ status: 'failed', failedAt: 1234 });
		availability.checkingRelays(1);
		expect(availability.publication).toEqual({ status: 'checking' });
		expect(availability.mint.status).toBe('unavailable');
		expect(availability.cache.status).toBe('stale');
		now.mockRestore();
	});

	it('gives browser offline precedence over relay and publication state', async () => {
		vi.stubGlobal('navigator', { onLine: false });
		const { availability } = await import('$lib/stores/availability.svelte');
		availability.setRelayCoverage(2, 2);
		availability.publicationSucceeded();

		expect(availability.browser.status).toBe('offline');
		expect(availability.publication).toEqual({
			status: 'blocked',
			reason: 'browser-offline'
		});
	});
});
