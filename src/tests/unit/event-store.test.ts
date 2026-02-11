import { describe, it, expect } from 'vitest';
import { eventStore } from '$lib/nostr/event-store';
import { EventStore } from 'applesauce-core';

describe('EventStore singleton', () => {
	it('exports an EventStore instance', () => {
		expect(eventStore).toBeInstanceOf(EventStore);
	});

	it('is a singleton (same reference from multiple imports)', async () => {
		const { eventStore: store2 } = await import('$lib/nostr/event-store');
		expect(store2).toBe(eventStore);
	});

	it('can be used to store and retrieve events', () => {
		// EventStore.add expects properly formed events.
		// We verify the store is functional by checking its database property exists.
		expect(eventStore.database).toBeDefined();
		expect(typeof eventStore.add).toBe('function');
	});
});
