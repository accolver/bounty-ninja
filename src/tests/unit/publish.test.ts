import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from 'nostr-tools';

const mocks = vi.hoisted(() => ({
	getDefaultRelays: vi.fn<() => string[]>(),
	relay: vi.fn()
}));

vi.mock('$lib/utils/env', () => ({ getDefaultRelays: mocks.getDefaultRelays }));
vi.mock('$lib/nostr/relay-pool', () => ({ pool: { relay: mocks.relay } }));

import { broadcastEvent } from '$lib/nostr/publish';

const event = {
	id: 'a'.repeat(64),
	pubkey: 'b'.repeat(64),
	created_at: 1,
	kind: 1,
	tags: [],
	content: '',
	sig: 'c'.repeat(128)
} satisfies NostrEvent;

describe('broadcastEvent', () => {
	beforeEach(() => {
		mocks.getDefaultRelays.mockReturnValue(['wss://one.example', 'wss://two.example']);
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.spyOn(console, 'info').mockImplementation(() => {});
	});

	afterEach(() => vi.restoreAllMocks());

	it('fails closed when no relay is configured', async () => {
		mocks.getDefaultRelays.mockReturnValue([]);
		await expect(broadcastEvent(event)).rejects.toThrow('No relays configured');
		expect(mocks.relay).not.toHaveBeenCalled();
	});

	it('reports acceptance by every relay', async () => {
		mocks.relay.mockImplementation((url: string) => ({
			publish: vi.fn().mockResolvedValue({ from: url, ok: true })
		}));

		await expect(broadcastEvent(event)).resolves.toMatchObject({
			success: true,
			acceptedCount: 2,
			rejectedCount: 0,
			failures: []
		});
		expect(console.info).not.toHaveBeenCalled();
	});

	it('preserves partial rejection and connection failure results', async () => {
		mocks.getDefaultRelays.mockReturnValue([
			'wss://accept.example',
			'wss://reject.example',
			'wss://offline.example'
		]);
		mocks.relay.mockImplementation((url: string) => ({
			publish: vi.fn().mockImplementation(() => {
				if (url.includes('offline')) throw new Error('connection refused');
				return { from: url, ok: url.includes('accept') };
			})
		}));

		const result = await broadcastEvent(event);
		expect(result).toMatchObject({
			success: true,
			acceptedCount: 1,
			rejectedCount: 1,
			failures: ['wss://offline.example']
		});
		expect(console.warn).toHaveBeenCalledTimes(2);
		expect(console.info).toHaveBeenCalledOnce();
	});

	it('throws a summary when every relay rejects or fails', async () => {
		mocks.relay.mockImplementation((url: string) => ({
			publish: vi.fn().mockImplementation(() => {
				if (url.includes('two')) throw 'offline';
				return { from: url, ok: false, message: 'blocked' };
			})
		}));

		await expect(broadcastEvent(event)).rejects.toThrow(
			'Event rejected by all 2 relay(s). 1 rejected, 1 connection failures.'
		);
	});
});
