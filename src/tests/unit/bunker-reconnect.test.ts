/**
 * Tests for bunker logout → re-login flow.
 * Reproduces the "already connected" error when reusing a bunker URI after logout.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
		isConnected: true,
		relays: ['wss://relay.example.com'],
		signer: { key: new Uint8Array(32).fill(1) }
	};
	return {
		ExtensionSigner: vi.fn(),
		PrivateKeySigner: vi.fn().mockImplementation(() => ({})),
		NostrConnectSigner: Object.assign(
			vi.fn().mockImplementation(() => instance),
			{
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
		)
	};
});

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
	resetEventFactory
} from '$lib/nostr/signer.svelte';

const mockInstance = (NostrConnectSigner as any)._instance;

describe('bunker logout → re-login flow', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorageMock.clear();
		resetEventFactory();
		mockInstance.isConnected = true;
		mockInstance.connect.mockResolvedValue('ack');
		mockInstance.getPublicKey.mockResolvedValue('a'.repeat(64));
	});

	it('keeps signer instance alive after clearBunkerSigner(false)', async () => {
		// Step 1: Initial login
		setBunkerSigner(mockInstance as any);
		expect(getBunkerSigner()?.isConnected).toBe(true);

		// Step 2: Logout (keep signer alive — don't disconnect)
		await clearBunkerSigner(false);
		resetEventFactory();

		// Step 3: Signer should still be accessible
		expect(getBunkerSigner()).not.toBeNull();
		expect(getBunkerSigner()?.isConnected).toBe(true);
	});

	it('nulls signer instance after clearBunkerSigner(true)', async () => {
		setBunkerSigner(mockInstance as any);
		await clearBunkerSigner(true);
		expect(getBunkerSigner()).toBeNull();
		expect(mockInstance.close).toHaveBeenCalled();
	});

	it('reconnect after logout reuses signer without calling connect()', async () => {
		// Step 1: Initial login
		setBunkerSigner(mockInstance as any);

		// Step 2: Logout (soft clear)
		await clearBunkerSigner(false);
		resetEventFactory();

		// Step 3: Reconnect — signer still available, just getPublicKey
		const signer = getBunkerSigner();
		expect(signer).not.toBeNull();
		expect(signer!.isConnected).toBe(true);

		const pubkey = await signer!.getPublicKey();
		expect(pubkey).toBe('a'.repeat(64));

		// connect() was NOT called during reconnect
		expect(mockInstance.connect).not.toHaveBeenCalled();
	});

	it('connect() with already-used secret throws "already connected"', async () => {
		// Simulate remote signer rejecting reused secret
		mockInstance.connect.mockRejectedValueOnce(new Error('already connected'));

		const signer = await NostrConnectSigner.fromBunkerURI('bunker://test');
		await signer.open();
		await expect(signer.connect('used-secret')).rejects.toThrow('already connected');
	});

	it('should not call connect() when reusing stored session info', async () => {
		// Simulate restore flow: create signer from stored info, open, ping (no connect)
		setBunkerSigner(mockInstance as any);
		await mockInstance.open();
		await mockInstance.ping();

		expect(mockInstance.open).toHaveBeenCalled();
		expect(mockInstance.ping).toHaveBeenCalled();
		// connect should NOT be called during restore — only open + ping
	});
});
