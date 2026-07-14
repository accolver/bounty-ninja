import { afterEach, describe, expect, it, vi } from 'vitest';

const idb = vi.hoisted(() => ({
	openDB: vi.fn(() => new Promise<never>(() => {})),
	getEventsForFilters: vi.fn(),
	addEvents: vi.fn(),
	deleteEvent: vi.fn(),
	deleteAllEvents: vi.fn()
}));

vi.mock('nostr-idb', () => idb);

describe('cache read timeout', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('continues without cache data when IndexedDB initialization stalls', async () => {
		vi.useFakeTimers();
		const { loadCachedEvents } = await import('$lib/nostr/cache');
		const load = loadCachedEvents([{ kinds: [37300] }]);

		await vi.advanceTimersByTimeAsync(2_000);

		await expect(load).resolves.toBeUndefined();
		expect(idb.getEventsForFilters).not.toHaveBeenCalled();
	});
});
