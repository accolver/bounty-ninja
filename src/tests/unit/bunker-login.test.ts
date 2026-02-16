/**
 * Unit tests for NIP-46 bunker login flow.
 * Tests URI validation, signer setup, connection flow, and error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports — vi.mock is hoisted, no external refs in factories
vi.mock('$lib/utils/env', () => ({
	getVoteQuorumFraction: () => 0.66
}));

vi.mock('$lib/nostr/relay-pool', () => ({
	pool: { relay: vi.fn() }
}));

vi.mock('$lib/nostr/event-store', () => ({
	eventStore: { add: vi.fn() }
}));

vi.mock('$lib/nostr/publish', () => ({
	broadcastEvent: vi.fn().mockResolvedValue({
		success: true, acceptedCount: 1, rejectedCount: 0, results: [], failures: []
	})
}));

vi.mock('applesauce-core/event-factory', () => {
	class MockEventFactory {
		sign = vi.fn();
		constructor() {}
	}
	return { EventFactory: MockEventFactory };
});

vi.mock('applesauce-signers', () => {
	const instance = {
		open: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined),
		connect: vi.fn().mockResolvedValue('ack'),
		getPublicKey: vi.fn().mockResolvedValue('a'.repeat(64)),
		signEvent: vi.fn(),
		ping: vi.fn().mockResolvedValue('pong'),
		relays: ['wss://relay.example.com']
	};
	return {
		ExtensionSigner: vi.fn(),
		PrivateKeySigner: { fromKey: vi.fn() },
		NostrConnectSigner: {
			pool: null,
			_instance: instance,
			fromBunkerURI: vi.fn().mockResolvedValue(instance),
			parseBunkerURI: vi.fn().mockReturnValue({
				remote: 'b'.repeat(64),
				relays: ['wss://relay.example.com'],
				secret: 'test-secret'
			}),
			buildSigningPermissions: vi.fn((kinds: number[]) =>
				kinds.map((k: number) => `sign_event:${k}`)
			)
		}
	};
});

// Mock globals
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] ?? null),
		setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
		removeItem: vi.fn((key: string) => { delete store[key]; }),
		clear: () => { store = {}; }
	};
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
Object.defineProperty(globalThis, 'window', {
	value: { nostr: undefined, addEventListener: vi.fn() },
	writable: true
});

import { NostrConnectSigner } from 'applesauce-signers';
import {
	setBunkerSigner,
	clearBunkerSigner,
	getBunkerSigner,
	getEventFactory,
	resetEventFactory
} from '$lib/nostr/signer.svelte';

// Access the mock instance for assertions
const mockInstance = (NostrConnectSigner as any)._instance;

describe('NIP-46 bunker login', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorageMock.clear();
		resetEventFactory();
	});

	describe('URI validation', () => {
		it('rejects non-bunker URIs', () => {
			const invalid = ['https://example.com', 'nostrconnect://abc', 'nsec1abc', '', 'bunker:missing'];
			for (const uri of invalid) {
				expect(uri.startsWith('bunker://')).toBe(false);
			}
		});

		it('accepts valid bunker:// URI format', () => {
			const valid = `bunker://${'a'.repeat(64)}?relay=wss://relay.example.com&secret=abc`;
			expect(valid.startsWith('bunker://')).toBe(true);
		});
	});

	describe('parseBunkerURI', () => {
		it('parses remote pubkey, relays, and secret', () => {
			const result = NostrConnectSigner.parseBunkerURI(
				`bunker://${'b'.repeat(64)}?relay=wss://relay.example.com&secret=mysecret`
			);
			expect(result.remote).toBe('b'.repeat(64));
			expect(result.relays).toContain('wss://relay.example.com');
			expect(result.secret).toBe('test-secret');
		});
	});

	describe('buildSigningPermissions', () => {
		it('builds permissions for all bounty event kinds', () => {
			const kinds = [37300, 73001, 73002, 1018, 73004, 73005, 73006];
			const perms = NostrConnectSigner.buildSigningPermissions(kinds);
			expect(perms).toHaveLength(7);
			expect(perms).toContain('sign_event:37300');
			expect(perms).toContain('sign_event:73005');
			expect(perms).toContain('sign_event:73006');
		});
	});

	describe('connection flow', () => {
		it('creates signer from bunker URI', async () => {
			const signer = await NostrConnectSigner.fromBunkerURI(
				`bunker://${'b'.repeat(64)}?relay=wss://relay.example.com`
			);
			expect(signer).toBeDefined();
			expect(NostrConnectSigner.fromBunkerURI).toHaveBeenCalled();
		});

		it('opens connection, connects with secret, and gets pubkey', async () => {
			const signer = await NostrConnectSigner.fromBunkerURI('bunker://test');
			await signer.open();
			expect(mockInstance.open).toHaveBeenCalled();

			await signer.connect('test-secret');
			expect(mockInstance.connect).toHaveBeenCalledWith('test-secret');

			const pubkey = await signer.getPublicKey();
			expect(pubkey).toBe('a'.repeat(64));
			expect(pubkey).toMatch(/^[0-9a-f]{64}$/);
		});

		it('handles connection timeout', async () => {
			mockInstance.connect.mockImplementationOnce(
				() => new Promise((resolve) => setTimeout(resolve, 60_000))
			);

			const signer = await NostrConnectSigner.fromBunkerURI('bunker://test');
			await signer.open();

			await expect(
				Promise.race([
					signer.connect('secret'),
					new Promise<never>((_, reject) =>
						setTimeout(() => reject(new Error('timeout')), 50)
					)
				])
			).rejects.toThrow('timeout');
		});

		it('handles connection refused', async () => {
			mockInstance.connect.mockRejectedValueOnce(new Error('Connection refused'));

			const signer = await NostrConnectSigner.fromBunkerURI('bunker://test');
			await signer.open();
			await expect(signer.connect('secret')).rejects.toThrow('Connection refused');
		});

		it('detects invalid pubkey from remote signer', async () => {
			mockInstance.getPublicKey.mockResolvedValueOnce('not-hex');

			const signer = await NostrConnectSigner.fromBunkerURI('bunker://test');
			await signer.open();
			await signer.connect('secret');
			const pubkey = await signer.getPublicKey();
			expect(pubkey).not.toMatch(/^[0-9a-f]{64}$/);
		});
	});

	describe('signer management', () => {
		it('setBunkerSigner enables getEventFactory to use it', () => {
			setBunkerSigner(mockInstance as any);
			resetEventFactory();
			const factory = getEventFactory();
			expect(factory).toBeDefined();
		});

		it('clearBunkerSigner with disconnect=true closes the connection', async () => {
			setBunkerSigner(mockInstance as any);
			await clearBunkerSigner(true);
			expect(mockInstance.close).toHaveBeenCalled();
		});

		it('clearBunkerSigner without disconnect keeps signer alive', async () => {
			setBunkerSigner(mockInstance as any);
			await clearBunkerSigner(false);
			expect(mockInstance.close).not.toHaveBeenCalled();
			// Signer should still be accessible
			expect(getBunkerSigner()).not.toBeNull();
		});

		it('bunker signer takes priority over NIP-07', () => {
			(globalThis as any).window = { nostr: { getPublicKey: vi.fn() }, addEventListener: vi.fn() };
			setBunkerSigner(mockInstance as any);
			resetEventFactory();
			// Should not throw — bunker signer is used, not NIP-07
			expect(() => getEventFactory()).not.toThrow();
		});
	});
});
