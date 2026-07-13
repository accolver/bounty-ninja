import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import type { NostrEvent } from 'nostr-tools';

const mocks = vi.hoisted(() => ({ ingest: vi.fn(), relay: vi.fn(), filters: [] as unknown[] }));
vi.mock('$lib/nostr/event-ingestion', () => ({ ingestEvent: mocks.ingest }));
vi.mock('$lib/nostr/relay-pool', () => ({ pool: { relay: mocks.relay } }));
vi.mock('$lib/utils/env', () => ({ getDefaultRelays: vi.fn(() => []) }));

import {
	createGlobalProofOwnershipLoader,
	createRelatedEventsLoader
} from '$lib/nostr/loaders/related-events-loader';

describe('createRelatedEventsLoader', () => {
	let streams: Map<string, Subject<NostrEvent | 'EOSE'>>;

	beforeEach(() => {
		streams = new Map();
		mocks.filters.length = 0;
		mocks.relay.mockImplementation((url: string) => {
			const stream = new Subject<NostrEvent | 'EOSE'>();
			streams.set(url, stream);
			return {
				subscription: vi.fn((filter: unknown) => {
					mocks.filters.push(filter);
					return stream;
				})
			};
		});
	});

	it('ingests events but remains incomplete when a relay fails before EOSE', () => {
		const settled = vi.fn();
		createRelatedEventsLoader('37300:author:id', ['wss://one', 'wss://two'], settled);
		const event = { id: 'a'.repeat(64) } as NostrEvent;
		streams.get('wss://one')?.next(event);
		expect(mocks.ingest).toHaveBeenCalledWith(event, 'relay');
		streams.get('wss://one')?.next('EOSE');
		expect(settled).not.toHaveBeenCalled();
		streams.get('wss://two')?.error(new Error('offline'));
		expect(settled).not.toHaveBeenCalled();
	});

	it('does not settle or ingest after unsubscribe', () => {
		const settled = vi.fn();
		const loader = createRelatedEventsLoader('37300:author:id', ['wss://one'], settled);
		loader.unsubscribe();
		streams.get('wss://one')?.next('EOSE');
		expect(settled).not.toHaveBeenCalled();
	});

	it('keeps an empty relay set incomplete', async () => {
		const settled = vi.fn();
		createRelatedEventsLoader('37300:author:id', [], settled);
		await Promise.resolve();
		expect(settled).not.toHaveBeenCalled();
	});

	it('loads unbounded pledge and payout ownership and requires relay EOSE', () => {
		const complete = vi.fn();
		createGlobalProofOwnershipLoader(['wss://one', 'wss://two'], complete);
		expect(mocks.filters).toEqual([{ kinds: [73002, 73004] }, { kinds: [73002, 73004] }]);
		streams.get('wss://one')?.next('EOSE');
		expect(complete).not.toHaveBeenCalled();
		streams.get('wss://two')?.next('EOSE');
		expect(complete).toHaveBeenCalledOnce();
	});
});
