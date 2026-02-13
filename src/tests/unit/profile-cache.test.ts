import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before imports
vi.mock('$lib/nostr/event-store', () => ({
	eventStore: {
		getReplaceable: vi.fn(),
		add: vi.fn(),
		insert$: { subscribe: vi.fn() }
	}
}));

vi.mock('$lib/nostr/cache', () => ({
	loadCachedEvents: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('$lib/nostr/relay-pool', () => ({
	pool: {
		relay: vi.fn(() => ({
			subscription: vi.fn(() => ({
				pipe: vi.fn(() => ({
					subscribe: vi.fn(() => ({ unsubscribe: vi.fn() }))
				}))
			}))
		}))
	}
}));

vi.mock('applesauce-relay', () => ({
	onlyEvents: vi.fn(() => (x: unknown) => x)
}));

vi.mock('applesauce-core', () => ({
	mapEventsToStore: vi.fn(() => (x: unknown) => x)
}));

vi.mock('$lib/utils/env', () => ({
	getDefaultRelays: vi.fn(() => ['wss://relay.test'])
}));

import {
	getCachedProfile,
	batchLoadProfiles,
	clearProfileCache,
	getProfileCacheStats
} from '$lib/nostr/profile-cache';
import { eventStore } from '$lib/nostr/event-store';

const mockEventStore = vi.mocked(eventStore);

function makeProfileEvent(pubkey: string, name: string) {
	return {
		id: `id-${pubkey}`,
		kind: 0,
		pubkey,
		content: JSON.stringify({ name, display_name: name }),
		created_at: Math.floor(Date.now() / 1000),
		tags: [],
		sig: 'sig'
	};
}

describe('profile-cache', () => {
	beforeEach(() => {
		clearProfileCache();
		vi.clearAllMocks();
	});

	describe('getCachedProfile', () => {
		it('returns null when no profile is cached', () => {
			mockEventStore.getReplaceable.mockReturnValue(undefined);
			expect(getCachedProfile('abc123')).toBeNull();
		});

		it('returns profile from EventStore if available', () => {
			const event = makeProfileEvent('abc123', 'Alice');
			mockEventStore.getReplaceable.mockReturnValue(event as any);

			const result = getCachedProfile('abc123');
			expect(result).not.toBeNull();
			expect(result!.parsed.name).toBe('Alice');
		});

		it('returns cached profile on second call without hitting EventStore', () => {
			const event = makeProfileEvent('abc123', 'Alice');
			mockEventStore.getReplaceable.mockReturnValue(event as any);

			getCachedProfile('abc123');
			mockEventStore.getReplaceable.mockReturnValue(undefined);

			const result = getCachedProfile('abc123');
			expect(result).not.toBeNull();
			expect(result!.parsed.name).toBe('Alice');
		});
	});

	describe('batchLoadProfiles', () => {
		it('returns noop for empty array', () => {
			const loader = batchLoadProfiles([]);
			expect(loader.unsubscribe).toBeDefined();
		});

		it('creates relay subscriptions for needed profiles', () => {
			const loader = batchLoadProfiles(['pk1', 'pk2']);
			expect(loader.unsubscribe).toBeDefined();
			loader.unsubscribe();
		});
	});

	describe('getProfileCacheStats', () => {
		it('returns initial stats', () => {
			const stats = getProfileCacheStats();
			expect(stats.size).toBe(0);
			expect(stats.maxSize).toBe(500);
		});

		it('reflects cached profiles', () => {
			const event = makeProfileEvent('abc', 'Test');
			mockEventStore.getReplaceable.mockReturnValue(event as any);
			getCachedProfile('abc');

			const stats = getProfileCacheStats();
			expect(stats.size).toBe(1);
		});
	});

	describe('clearProfileCache', () => {
		it('empties the cache', () => {
			const event = makeProfileEvent('abc', 'Test');
			mockEventStore.getReplaceable.mockReturnValue(event as any);
			getCachedProfile('abc');

			clearProfileCache();
			expect(getProfileCacheStats().size).toBe(0);
		});
	});
});
