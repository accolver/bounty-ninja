import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAYMENT_JOURNAL_DB_NAME } from '$lib/cashu/payment-journal';

const { clearCacheMeta } = vi.hoisted(() => ({ clearCacheMeta: vi.fn() }));
vi.mock('$lib/nostr/cache-meta', () => ({ clearCacheMeta }));
vi.mock('$lib/nostr/event-store', () => ({
	eventStore: { insert$: { subscribe: vi.fn() } }
}));
vi.mock('$lib/nostr/event-ingestion', () => ({
	ingestEvent: vi.fn(),
	validateIncomingEvent: vi.fn()
}));
vi.mock('nostr-idb', () => ({
	openDB: vi.fn(),
	getEventsForFilters: vi.fn(),
	addEvents: vi.fn(),
	deleteEvent: vi.fn(),
	deleteAllEvents: vi.fn()
}));

import { clearAllCaches, EVENT_CACHE_DATABASE_NAME } from '$lib/nostr/cache';

describe('cache clearing ownership', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		vi.stubGlobal('indexedDB', { deleteDatabase: vi.fn() });
	});

	afterEach(() => vi.unstubAllGlobals());

	it('deletes only the public event cache database and never the payment journal', async () => {
		const deleteDatabase = vi.mocked(indexedDB.deleteDatabase);

		await clearAllCaches();

		expect(deleteDatabase).toHaveBeenCalledTimes(1);
		expect(deleteDatabase).toHaveBeenCalledWith(EVENT_CACHE_DATABASE_NAME);
		expect(deleteDatabase).not.toHaveBeenCalledWith(PAYMENT_JOURNAL_DB_NAME);
	});
});
