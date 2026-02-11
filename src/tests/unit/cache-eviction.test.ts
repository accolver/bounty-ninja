import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NostrEvent } from 'nostr-tools';

// Mock dependencies before importing the module under test
vi.mock('$lib/nostr/cache', () => ({
	getDatabase: vi.fn()
}));

vi.mock('nostr-idb', () => ({
	getEventsForFilters: vi.fn(),
	deleteEventsByIds: vi.fn()
}));

import {
	getCacheEventCount,
	estimateCacheSize,
	scheduleEviction,
	emergencyEviction
} from '$lib/nostr/cache-eviction';
import { getDatabase } from '$lib/nostr/cache';
import { getEventsForFilters, deleteEventsByIds } from 'nostr-idb';

const mockedGetDatabase = vi.mocked(getDatabase);
const mockedGetEventsForFilters = vi.mocked(getEventsForFilters);
const mockedDeleteEventsByIds = vi.mocked(deleteEventsByIds);

/** Helper to create a mock NostrEvent. */
function makeEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
	return {
		id: Math.random().toString(36).slice(2).padEnd(64, '0'),
		pubkey: 'b'.repeat(64),
		kind: 1,
		created_at: Math.floor(Date.now() / 1000),
		content: 'test event',
		tags: [],
		sig: 'c'.repeat(128),
		...overrides
	};
}

describe('cache-eviction', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// ── getCacheEventCount ───────────────────────────────────────────────

	describe('getCacheEventCount', () => {
		it('returns 0 when no database is available', async () => {
			mockedGetDatabase.mockReturnValue(null);

			const count = await getCacheEventCount();
			expect(count).toBe(0);
		});

		it('returns 0 when database has no events', async () => {
			const mockDb = {} as ReturnType<typeof getDatabase>;
			mockedGetDatabase.mockReturnValue(mockDb);
			mockedGetEventsForFilters.mockResolvedValue([]);

			const count = await getCacheEventCount();
			expect(count).toBe(0);
		});

		it('returns correct count for mocked events', async () => {
			const mockDb = {} as ReturnType<typeof getDatabase>;
			mockedGetDatabase.mockReturnValue(mockDb);
			const events = [makeEvent(), makeEvent(), makeEvent()];
			mockedGetEventsForFilters.mockResolvedValue(events);

			const count = await getCacheEventCount();
			expect(count).toBe(3);
		});

		it('returns 0 when getEventsForFilters throws', async () => {
			const mockDb = {} as ReturnType<typeof getDatabase>;
			mockedGetDatabase.mockReturnValue(mockDb);
			mockedGetEventsForFilters.mockRejectedValue(new Error('IDB error'));

			const count = await getCacheEventCount();
			expect(count).toBe(0);
		});

		it('calls getEventsForFilters with empty filter', async () => {
			const mockDb = {} as ReturnType<typeof getDatabase>;
			mockedGetDatabase.mockReturnValue(mockDb);
			mockedGetEventsForFilters.mockResolvedValue([]);

			await getCacheEventCount();
			expect(mockedGetEventsForFilters).toHaveBeenCalledWith(mockDb, [{}]);
		});
	});

	// ── estimateCacheSize ───────────────────────────────────────────────

	describe('estimateCacheSize', () => {
		it('returns 0 when no database is available', async () => {
			mockedGetDatabase.mockReturnValue(null);

			const size = await estimateCacheSize();
			expect(size).toBe(0);
		});

		it('returns 0 when database has no events', async () => {
			const mockDb = {} as ReturnType<typeof getDatabase>;
			mockedGetDatabase.mockReturnValue(mockDb);
			mockedGetEventsForFilters.mockResolvedValue([]);

			const size = await estimateCacheSize();
			expect(size).toBe(0);
		});

		it('returns estimated byte size for events', async () => {
			const mockDb = {} as ReturnType<typeof getDatabase>;
			mockedGetDatabase.mockReturnValue(mockDb);
			const event = makeEvent({ content: 'hello' });
			mockedGetEventsForFilters.mockResolvedValue([event]);

			const size = await estimateCacheSize();
			// Size should be JSON.stringify(event).length * 2 (UTF-16)
			const expectedSize = JSON.stringify(event).length * 2;
			expect(size).toBe(expectedSize);
		});

		it('sums sizes across multiple events', async () => {
			const mockDb = {} as ReturnType<typeof getDatabase>;
			mockedGetDatabase.mockReturnValue(mockDb);
			const event1 = makeEvent({ content: 'short' });
			const event2 = makeEvent({ content: 'a longer piece of content here' });
			mockedGetEventsForFilters.mockResolvedValue([event1, event2]);

			const size = await estimateCacheSize();
			const expectedSize = JSON.stringify(event1).length * 2 + JSON.stringify(event2).length * 2;
			expect(size).toBe(expectedSize);
		});

		it('returns 0 when getEventsForFilters throws', async () => {
			const mockDb = {} as ReturnType<typeof getDatabase>;
			mockedGetDatabase.mockReturnValue(mockDb);
			mockedGetEventsForFilters.mockRejectedValue(new Error('IDB error'));

			const size = await estimateCacheSize();
			expect(size).toBe(0);
		});
	});

	// ── scheduleEviction ────────────────────────────────────────────────

	describe('scheduleEviction', () => {
		it('returns zero eviction result when no database is available', async () => {
			mockedGetDatabase.mockReturnValue(null);

			// Mock setTimeout since requestIdleCallback may not exist in jsdom
			vi.useFakeTimers();
			const resultPromise = scheduleEviction(null);
			vi.runAllTimers();
			const result = await resultPromise;
			vi.useRealTimers();

			expect(result).toEqual({ ageEvicted: 0, countEvicted: 0, remaining: 0 });
		});

		it('returns zero eviction result when cache is empty', async () => {
			const mockDb = {} as ReturnType<typeof getDatabase>;
			mockedGetDatabase.mockReturnValue(mockDb);
			mockedGetEventsForFilters.mockResolvedValue([]);

			vi.useFakeTimers();
			const resultPromise = scheduleEviction(null);
			vi.runAllTimers();
			const result = await resultPromise;
			vi.useRealTimers();

			expect(result).toEqual({ ageEvicted: 0, countEvicted: 0, remaining: 0 });
		});
	});

	// ── emergencyEviction ───────────────────────────────────────────────

	describe('emergencyEviction', () => {
		it('returns zero eviction result when no database is available', async () => {
			mockedGetDatabase.mockReturnValue(null);
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const result = await emergencyEviction(null);

			expect(result).toEqual({ ageEvicted: 0, countEvicted: 0, remaining: 0 });
			warnSpy.mockRestore();
		});

		it('logs a warning when triggered', async () => {
			mockedGetDatabase.mockReturnValue(null);
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			await emergencyEviction(null);

			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Emergency eviction triggered'));
			warnSpy.mockRestore();
		});

		it('evicts expired events based on maxAgeMs', async () => {
			const mockDb = {} as ReturnType<typeof getDatabase>;
			mockedGetDatabase.mockReturnValue(mockDb);

			const now = Math.floor(Date.now() / 1000);
			const oldEvent = makeEvent({
				id: 'old'.padEnd(64, '0'),
				created_at: now - 60 * 24 * 60 * 60, // 60 days ago
				pubkey: 'c'.repeat(64)
			});
			const recentEvent = makeEvent({
				id: 'new'.padEnd(64, '0'),
				created_at: now - 60, // 1 minute ago
				pubkey: 'c'.repeat(64)
			});

			mockedGetEventsForFilters.mockResolvedValue([oldEvent, recentEvent]);
			mockedDeleteEventsByIds.mockResolvedValue(1);

			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

			const result = await emergencyEviction(null);

			// The old event should have been evicted by age
			expect(result.ageEvicted).toBe(1);
			expect(mockedDeleteEventsByIds).toHaveBeenCalled();

			warnSpy.mockRestore();
			infoSpy.mockRestore();
		});

		it('protects current user events from eviction', async () => {
			const mockDb = {} as ReturnType<typeof getDatabase>;
			mockedGetDatabase.mockReturnValue(mockDb);

			const userPubkey = 'd'.repeat(64);
			const now = Math.floor(Date.now() / 1000);

			const userEvent = makeEvent({
				id: 'user'.padEnd(64, '0'),
				created_at: now - 60 * 24 * 60 * 60, // 60 days ago — would be evicted
				pubkey: userPubkey
			});
			const otherEvent = makeEvent({
				id: 'other'.padEnd(64, '0'),
				created_at: now - 60 * 24 * 60 * 60, // 60 days ago
				pubkey: 'e'.repeat(64)
			});

			mockedGetEventsForFilters.mockResolvedValue([userEvent, otherEvent]);
			mockedDeleteEventsByIds.mockResolvedValue(1);

			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

			const result = await emergencyEviction(userPubkey);

			// Only the other event should be evicted, user event is protected
			expect(result.ageEvicted).toBe(1);

			// Verify the deleted IDs don't include the user's event
			if (mockedDeleteEventsByIds.mock.calls.length > 0) {
				const deletedIds = mockedDeleteEventsByIds.mock.calls[0][1] as string[];
				expect(deletedIds).not.toContain(userEvent.id);
				expect(deletedIds).toContain(otherEvent.id);
			}

			warnSpy.mockRestore();
			infoSpy.mockRestore();
		});
	});
});
