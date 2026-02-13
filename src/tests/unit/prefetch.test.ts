import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
vi.mock('$lib/nostr/cache', () => ({
	loadCachedEvents: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('$lib/nostr/profile-cache', () => ({
	loadProfile: vi.fn().mockResolvedValue(null),
	batchLoadProfiles: vi.fn(() => ({ unsubscribe: vi.fn() }))
}));

vi.mock('$lib/nostr/relay-pool', () => ({
	pool: { relay: vi.fn() }
}));

vi.mock('$lib/nostr/event-store', () => ({
	eventStore: { add: vi.fn(), getReplaceable: vi.fn(), insert$: { subscribe: vi.fn() } }
}));

vi.mock('$lib/utils/env', () => ({
	getDefaultRelays: vi.fn(() => ['wss://relay.test'])
}));

import { prefetch, prefetchProfiles, clearPrefetchState } from '$lib/nostr/prefetch';
import { loadProfile, batchLoadProfiles } from '$lib/nostr/profile-cache';

describe('prefetch', () => {
	beforeEach(() => {
		clearPrefetchState();
		vi.clearAllMocks();
		// Mock requestIdleCallback to execute immediately
		vi.stubGlobal('requestIdleCallback', (cb: () => void) => { cb(); return 0; });
	});

	it('prefetches a profile', () => {
		prefetch('profile', 'abc123');
		expect(loadProfile).toHaveBeenCalledWith('abc123');
	});

	it('does not prefetch the same thing twice', () => {
		prefetch('profile', 'abc123');
		prefetch('profile', 'abc123');
		expect(loadProfile).toHaveBeenCalledTimes(1);
	});

	it('prefetches different targets', () => {
		prefetch('profile', 'abc');
		prefetch('profile', 'def');
		expect(loadProfile).toHaveBeenCalledTimes(2);
	});
});

describe('prefetchProfiles', () => {
	beforeEach(() => {
		clearPrefetchState();
		vi.clearAllMocks();
		vi.stubGlobal('requestIdleCallback', (cb: () => void) => { cb(); return 0; });
	});

	it('batch loads profiles', () => {
		prefetchProfiles(['pk1', 'pk2']);
		expect(batchLoadProfiles).toHaveBeenCalledWith(['pk1', 'pk2']);
	});

	it('filters already prefetched pubkeys', () => {
		prefetch('profile', 'pk1');
		vi.clearAllMocks();
		prefetchProfiles(['pk1', 'pk2']);
		expect(batchLoadProfiles).toHaveBeenCalledWith(['pk2']);
	});
});
