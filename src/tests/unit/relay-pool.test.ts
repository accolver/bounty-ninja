import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RelayPool } from 'applesauce-relay';

// Mock the env module
vi.mock('$env/dynamic/public', () => ({
	env: {
		PUBLIC_DEFAULT_RELAYS:
			'wss://relay.damus.io,wss://nos.lol,wss://relay.nostr.band,wss://relay.primal.net'
	}
}));

describe('RelayPool singleton', () => {
	it('exports a RelayPool instance', async () => {
		const { pool } = await import('$lib/nostr/relay-pool');
		expect(pool).toBeInstanceOf(RelayPool);
	});

	it('is a singleton (same reference from multiple imports)', async () => {
		const { pool: pool1 } = await import('$lib/nostr/relay-pool');
		const { pool: pool2 } = await import('$lib/nostr/relay-pool');
		expect(pool1).toBe(pool2);
	});
});

describe('connectDefaultRelays', () => {
	it('parses relay URLs from environment variable', async () => {
		const { pool, connectDefaultRelays } = await import('$lib/nostr/relay-pool');

		// Spy on pool.relay
		const relaySpy = vi.spyOn(pool, 'relay');

		connectDefaultRelays();

		expect(relaySpy).toHaveBeenCalledWith('wss://relay.damus.io');
		expect(relaySpy).toHaveBeenCalledWith('wss://nos.lol');
		expect(relaySpy).toHaveBeenCalledWith('wss://relay.nostr.band');
		expect(relaySpy).toHaveBeenCalledWith('wss://relay.primal.net');
		expect(relaySpy).toHaveBeenCalledTimes(4);
	});
});
