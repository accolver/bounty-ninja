import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventStore } from 'applesauce-core';
import { BehaviorSubject, Subject, NEVER } from 'rxjs';
import type { NostrEvent } from 'nostr-tools';
import { BOUNTY_KIND } from '$lib/bounty/kinds';

// Mock the relay pool
const mockSubscription = vi.fn();
const mockRelay = vi.fn(() => ({
	subscription: mockSubscription
}));
vi.mock('$lib/nostr/relay-pool', () => ({
	pool: { relay: mockRelay }
}));

// Mock the event store with a real EventStore but control timeline
const mockTimeline = vi.fn();
const testStore = new EventStore();
testStore.verifyEvent = () => true;
vi.mock('$lib/nostr/event-store', () => ({
	eventStore: {
		...testStore,
		timeline: mockTimeline,
		database: testStore.database,
		add: testStore.add.bind(testStore)
	}
}));

// Mock the env module
vi.mock('$lib/utils/env', () => ({
	getSearchRelay: () => 'wss://search.nos.today',
	getDefaultRelays: () => ['wss://relay.damus.io'],
	getDefaultMint: () => 'https://mint.test.com',
	getAppName: () => 'Bounty.ninja',
	getAppUrl: () => 'https://bounty.ninja',
	getMinSubmissionFee: () => 10,
	getMaxSubmissionFee: () => 100
}));

// Mock mapEventsToStore and onlyEvents as passthroughs
vi.mock('applesauce-core', async (importOriginal) => {
	const actual = await importOriginal<typeof import('applesauce-core')>();
	return {
		...actual,
		mapEventsToStore: () => (source: unknown) => source
	};
});

vi.mock('applesauce-relay', () => ({
	onlyEvents: () => (source: unknown) => source
}));

function makeBountyEvent(title: string, topicTags: string[] = ['development']): NostrEvent {
	const eventTags: string[][] = [
		['d', 'test-d-tag'],
		['title', title],
		['reward', '1000']
	];
	for (const t of topicTags) {
		eventTags.push(['t', t]);
	}
	eventTags.push(['client', 'bounty.ninja']);

	return {
		id: 'event-' + Math.random().toString(36).slice(2),
		pubkey: 'pubkey123',
		created_at: Math.floor(Date.now() / 1000),
		kind: BOUNTY_KIND,
		content: 'A test bounty description',
		tags: eventTags,
		sig: 'sig123'
	};
}

describe('SearchStore', () => {
	let SearchStoreModule: typeof import('$lib/stores/search.svelte');

	beforeEach(async () => {
		vi.clearAllMocks();
		// Re-import to get a fresh singleton
		vi.resetModules();
		// Re-setup mocks after resetModules
		vi.doMock('$lib/nostr/relay-pool', () => ({
			pool: { relay: mockRelay }
		}));
		vi.doMock('$lib/nostr/event-store', () => ({
			eventStore: {
				...testStore,
				timeline: mockTimeline,
				database: testStore.database,
				add: testStore.add.bind(testStore)
			}
		}));
		vi.doMock('$lib/utils/env', () => ({
			getSearchRelay: () => 'wss://search.nos.today',
			getDefaultRelays: () => ['wss://relay.damus.io'],
			getDefaultMint: () => 'https://mint.test.com',
			getAppName: () => 'Bounty.ninja',
			getAppUrl: () => 'https://bounty.ninja',
			getMinSubmissionFee: () => 10,
			getMaxSubmissionFee: () => 100
		}));
		vi.doMock('applesauce-core', async (importOriginal) => {
			const actual = await importOriginal<typeof import('applesauce-core')>();
			return {
				...actual,
				mapEventsToStore: () => (source: unknown) => source
			};
		});
		vi.doMock('applesauce-relay', () => ({
			onlyEvents: () => (source: unknown) => source
		}));
		SearchStoreModule = await import('$lib/stores/search.svelte');
	});

	it('exports a singleton searchStore', () => {
		expect(SearchStoreModule.searchStore).toBeDefined();
		expect(SearchStoreModule.searchStore.results).toEqual([]);
		expect(SearchStoreModule.searchStore.loading).toBe(false);
		expect(SearchStoreModule.searchStore.error).toBeNull();
		expect(SearchStoreModule.searchStore.query).toBe('');
	});

	it('clears state when query is empty', () => {
		const { searchStore } = SearchStoreModule;
		searchStore.search('');
		expect(searchStore.results).toEqual([]);
		expect(searchStore.loading).toBe(false);
		expect(searchStore.error).toBeNull();
	});

	it('clears state when query is whitespace only', () => {
		const { searchStore } = SearchStoreModule;
		searchStore.search('   ');
		expect(searchStore.results).toEqual([]);
		expect(searchStore.loading).toBe(false);
	});

	it('sets loading to true when search starts', () => {
		// Local search returns empty results
		mockTimeline.mockReturnValue(new BehaviorSubject<NostrEvent[]>([]));
		// Make the relay subscription hang forever
		mockSubscription.mockReturnValue(NEVER);
		const { searchStore } = SearchStoreModule;
		searchStore.search('cashu');
		expect(searchStore.loading).toBe(true);
		expect(searchStore.query).toBe('cashu');
	});

	it('falls back to client-side search when relay throws', () => {
		// Make pool.relay() throw
		mockRelay.mockImplementation(() => {
			throw new Error('Connection failed');
		});

		const bountyEvent = makeBountyEvent('Cashu Integration');
		const events$ = new BehaviorSubject<NostrEvent[]>([bountyEvent]);
		mockTimeline.mockReturnValue(events$);

		const { searchStore } = SearchStoreModule;
		searchStore.search('cashu');

		// Should have fallen back and found the matching event
		expect(searchStore.results.length).toBe(1);
		expect(searchStore.results[0].title).toBe('Cashu Integration');
		expect(searchStore.loading).toBe(false);
	});

	it('client-side fallback filters by title case-insensitively', () => {
		mockRelay.mockImplementation(() => {
			throw new Error('Connection failed');
		});

		const matchingEvent = makeBountyEvent('Bitcoin Lightning');
		const nonMatchingEvent = makeBountyEvent('React Components');
		const events$ = new BehaviorSubject<NostrEvent[]>([matchingEvent, nonMatchingEvent]);
		mockTimeline.mockReturnValue(events$);

		const { searchStore } = SearchStoreModule;
		searchStore.search('lightning');

		expect(searchStore.results.length).toBe(1);
		expect(searchStore.results[0].title).toBe('Bitcoin Lightning');
	});

	it('client-side fallback filters by tags', () => {
		mockRelay.mockImplementation(() => {
			throw new Error('Connection failed');
		});

		const matchingEvent = makeBountyEvent('Some Bounty', ['design']);
		const nonMatchingEvent = makeBountyEvent('Other Bounty', ['development']);
		const events$ = new BehaviorSubject<NostrEvent[]>([matchingEvent, nonMatchingEvent]);
		mockTimeline.mockReturnValue(events$);

		const { searchStore } = SearchStoreModule;
		searchStore.search('design');

		expect(searchStore.results.length).toBe(1);
		expect(searchStore.results[0].title).toBe('Some Bounty');
	});

	it('returns empty results when no matches found', () => {
		mockRelay.mockImplementation(() => {
			throw new Error('Connection failed');
		});

		const events$ = new BehaviorSubject<NostrEvent[]>([makeBountyEvent('Unrelated Bounty')]);
		mockTimeline.mockReturnValue(events$);

		const { searchStore } = SearchStoreModule;
		searchStore.search('zzzznonexistent');

		expect(searchStore.results).toEqual([]);
		expect(searchStore.loading).toBe(false);
	});

	it('cancels previous subscription when new search starts', () => {
		// Local search returns empty results
		mockTimeline.mockReturnValue(new BehaviorSubject<NostrEvent[]>([]));
		// Use Subjects that never complete — simulating a long relay subscription
		const sub1Subject = new Subject<NostrEvent>();
		const sub2Subject = new Subject<NostrEvent>();
		let callCount = 0;
		mockSubscription.mockImplementation(() => {
			callCount++;
			return callCount === 1 ? sub1Subject.asObservable() : sub2Subject.asObservable();
		});

		const { searchStore } = SearchStoreModule;

		// Start first search — query is set and search proceeds
		searchStore.search('first');
		expect(searchStore.query).toBe('first');

		// Start a second search — should cancel the first and set new query
		searchStore.search('second');
		expect(searchStore.query).toBe('second');
	});

	it('clear() resets all state', () => {
		const { searchStore } = SearchStoreModule;

		// Force relay to throw so we use fallback and get a known state
		mockRelay.mockImplementation(() => {
			throw new Error('Connection failed');
		});
		const events$ = new BehaviorSubject<NostrEvent[]>([makeBountyEvent('Test Bounty')]);
		mockTimeline.mockReturnValue(events$);

		searchStore.search('test');
		expect(searchStore.query).toBe('test');
		expect(searchStore.results.length).toBe(1);

		searchStore.clear();
		expect(searchStore.results).toEqual([]);
		expect(searchStore.loading).toBe(false);
		expect(searchStore.error).toBeNull();
		expect(searchStore.query).toBe('');
	});

	it('destroy() cleans up subscriptions', () => {
		mockTimeline.mockReturnValue(new BehaviorSubject<NostrEvent[]>([]));
		const { searchStore } = SearchStoreModule;
		mockSubscription.mockReturnValue(NEVER);
		searchStore.search('test');
		searchStore.destroy();
		expect(searchStore.loading).toBe(false);
		expect(searchStore.query).toBe('');
	});
});
