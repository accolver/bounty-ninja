import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import type { NostrEvent } from 'nostr-tools';

const mocks = vi.hoisted(() => ({ ingest: vi.fn(), relay: vi.fn() }));
vi.mock('$lib/nostr/event-ingestion', () => ({ ingestEvent: mocks.ingest }));
vi.mock('$lib/nostr/relay-pool', () => ({ pool: { relay: mocks.relay } }));
vi.mock('$lib/utils/env', () => ({ getDefaultRelays: vi.fn(() => []) }));

import { createRelatedEventsLoader } from '$lib/nostr/loaders/related-events-loader';

describe('createRelatedEventsLoader', () => {
	let streams: Map<string, Subject<NostrEvent | 'EOSE'>>;

	beforeEach(() => {
		streams = new Map();
		mocks.relay.mockImplementation((url: string) => {
			const stream = new Subject<NostrEvent | 'EOSE'>();
			streams.set(url, stream);
			return { subscription: vi.fn(() => stream) };
		});
	});

	it('ingests events and settles only after every relay reaches EOSE or failure', () => {
		const settled = vi.fn();
		createRelatedEventsLoader('37300:author:id', ['wss://one', 'wss://two'], settled);
		const event = { id: 'a'.repeat(64) } as NostrEvent;
		streams.get('wss://one')?.next(event);
		expect(mocks.ingest).toHaveBeenCalledWith(event, 'relay');
		streams.get('wss://one')?.next('EOSE');
		expect(settled).not.toHaveBeenCalled();
		streams.get('wss://two')?.error(new Error('offline'));
		expect(settled).toHaveBeenCalledOnce();
	});

	it('does not settle or ingest after unsubscribe', () => {
		const settled = vi.fn();
		const loader = createRelatedEventsLoader('37300:author:id', ['wss://one'], settled);
		loader.unsubscribe();
		streams.get('wss://one')?.next('EOSE');
		expect(settled).not.toHaveBeenCalled();
	});

	it('settles an empty relay set asynchronously', async () => {
		const settled = vi.fn();
		createRelatedEventsLoader('37300:author:id', [], settled);
		await Promise.resolve();
		expect(settled).toHaveBeenCalledOnce();
	});
});
