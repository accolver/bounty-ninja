/**
 * Unit tests for broadcast failure handling in publishEvent.
 *
 * Verifies that:
 * - publishEvent returns broadcast failure status (success: false) when all relays reject
 * - publishEvent returns broadcast success status (success: true) when at least one relay accepts
 * - Callers can distinguish success from failure via the returned PublishResult
 * - The broadcast catch path produces a well-formed failure result
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NostrEvent, EventTemplate } from 'nostr-tools';
import type { BroadcastResult } from '$lib/nostr/publish';
import type { PublishResult } from '$lib/nostr/signer.svelte';

// ── Mocks ─────────────────────────────────────────────────────────────────

// Mock the event store
vi.mock('$lib/nostr/event-store', () => ({
	eventStore: {
		add: vi.fn()
	}
}));

// Mock the broadcast module
vi.mock('$lib/nostr/publish', () => ({
	broadcastEvent: vi.fn()
}));

// Mock the signer dependencies so we can control EventFactory behavior
const mockSign = vi.fn();
vi.mock('applesauce-core/event-factory', () => {
	return {
		EventFactory: class MockEventFactory {
			sign = mockSign;
			constructor() {
				// no-op
			}
		}
	};
});

vi.mock('applesauce-signers', () => {
	return {
		ExtensionSigner: class MockExtensionSigner {
			constructor() {
				// no-op
			}
		}
	};
});

vi.mock('$lib/utils/constants', () => ({
	SIGNER_POLL_INTERVAL_MS: 500,
	SIGNER_MAX_RETRIES: 10,
	SIGNER_TIMEOUT_MS: 30_000,
	CLIENT_TAG: 'bounty.ninja'
}));

import { publishEvent, resetEventFactory } from '$lib/nostr/signer.svelte';
import { broadcastEvent } from '$lib/nostr/publish';
import { eventStore } from '$lib/nostr/event-store';

const mockedBroadcast = vi.mocked(broadcastEvent);
const mockedEventStoreAdd = vi.mocked(eventStore.add);

// ── Helpers ───────────────────────────────────────────────────────────────

const TEST_PUBKEY = 'a'.repeat(64);
const TEST_SIG = 'd'.repeat(128);
const TEST_EVENT_ID = 'e'.repeat(64);

function makeSignedEvent(template?: Partial<NostrEvent>): NostrEvent {
	return {
		id: TEST_EVENT_ID,
		pubkey: TEST_PUBKEY,
		created_at: Math.floor(Date.now() / 1000),
		kind: 37300,
		tags: [['client', 'bounty.ninja']],
		content: 'test content',
		sig: TEST_SIG,
		...template
	};
}

function makeTemplate(): EventTemplate {
	return {
		kind: 37300,
		created_at: Math.floor(Date.now() / 1000),
		tags: [['client', 'bounty.ninja']],
		content: 'test content'
	};
}

function makeSuccessBroadcast(): BroadcastResult {
	return {
		success: true,
		acceptedCount: 2,
		rejectedCount: 0,
		results: [],
		failures: []
	};
}

function makeFailureBroadcast(): BroadcastResult {
	return {
		success: false,
		acceptedCount: 0,
		rejectedCount: 2,
		results: [],
		failures: ['wss://relay1.example.com', 'wss://relay2.example.com']
	};
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
	vi.clearAllMocks();

	// Reset the factory singleton so each test starts fresh
	resetEventFactory();

	// Simulate window.nostr being available (NIP-07 extension)
	Object.defineProperty(globalThis, 'window', {
		value: { nostr: { getPublicKey: vi.fn(), signEvent: vi.fn() } },
		writable: true,
		configurable: true
	});

	// Default: signing resolves immediately with a valid event
	const signedEvent = makeSignedEvent();
	mockSign.mockResolvedValue(signedEvent);
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('publishEvent broadcast result', () => {
	it('returns success: true when broadcast succeeds', async () => {
		const broadcastResult = makeSuccessBroadcast();
		mockedBroadcast.mockResolvedValue(broadcastResult);

		const result: PublishResult = await publishEvent(makeTemplate());

		expect(result.broadcast.success).toBe(true);
		expect(result.broadcast.acceptedCount).toBe(2);
		expect(result.event).toBeDefined();
		expect(result.event.id).toBe(TEST_EVENT_ID);
	});

	it('returns success: false when broadcast throws (all relays reject)', async () => {
		mockedBroadcast.mockRejectedValue(
			new Error('Event rejected by all 2 relay(s). 2 rejected, 0 connection failures.')
		);

		const result: PublishResult = await publishEvent(makeTemplate());

		// publishEvent should NOT throw — it catches the broadcast error
		expect(result.broadcast.success).toBe(false);
		expect(result.broadcast.acceptedCount).toBe(0);
		expect(result.broadcast.rejectedCount).toBe(0);
		expect(result.broadcast.results).toEqual([]);
		expect(result.broadcast.failures).toEqual([]);
	});

	it('returns the signed event even when broadcast fails', async () => {
		mockedBroadcast.mockRejectedValue(new Error('Network error'));

		const result = await publishEvent(makeTemplate());

		expect(result.event).toBeDefined();
		expect(result.event.id).toBe(TEST_EVENT_ID);
		expect(result.event.sig).toBe(TEST_SIG);
	});

	it('optimistically inserts event into EventStore regardless of broadcast outcome', async () => {
		mockedBroadcast.mockRejectedValue(new Error('All relays failed'));

		await publishEvent(makeTemplate());

		expect(mockedEventStoreAdd).toHaveBeenCalledTimes(1);
		expect(mockedEventStoreAdd).toHaveBeenCalledWith(
			expect.objectContaining({ id: TEST_EVENT_ID })
		);
	});

	it('returns partial broadcast result (some relays accepted, some rejected)', async () => {
		const partialResult: BroadcastResult = {
			success: true,
			acceptedCount: 1,
			rejectedCount: 1,
			results: [],
			failures: ['wss://relay2.example.com']
		};
		mockedBroadcast.mockResolvedValue(partialResult);

		const result = await publishEvent(makeTemplate());

		expect(result.broadcast.success).toBe(true);
		expect(result.broadcast.acceptedCount).toBe(1);
		expect(result.broadcast.rejectedCount).toBe(1);
		expect(result.broadcast.failures).toHaveLength(1);
	});
});

describe('caller broadcast result inspection', () => {
	it('caller can detect broadcast failure and take alternative action', async () => {
		mockedBroadcast.mockRejectedValue(new Error('All relays offline'));

		const result = await publishEvent(makeTemplate());

		// Simulating what a caller (e.g. BountyForm) would do:
		if (!result.broadcast.success) {
			// Caller-side handling: show error, skip navigation, etc.
			expect(result.broadcast.success).toBe(false);
		} else {
			// This branch should NOT execute
			expect.unreachable('Expected broadcast failure');
		}
	});

	it('caller can detect broadcast success and proceed normally', async () => {
		mockedBroadcast.mockResolvedValue(makeSuccessBroadcast());

		const result = await publishEvent(makeTemplate());

		if (result.broadcast.success) {
			expect(result.broadcast.acceptedCount).toBeGreaterThan(0);
			expect(result.event.id).toBeTruthy();
		} else {
			expect.unreachable('Expected broadcast success');
		}
	});

	it('PublishResult always contains both event and broadcast fields', async () => {
		// Test with success
		mockedBroadcast.mockResolvedValue(makeSuccessBroadcast());
		const successResult = await publishEvent(makeTemplate());
		expect(successResult).toHaveProperty('event');
		expect(successResult).toHaveProperty('broadcast');
		expect(successResult.broadcast).toHaveProperty('success');
		expect(successResult.broadcast).toHaveProperty('acceptedCount');
		expect(successResult.broadcast).toHaveProperty('rejectedCount');
		expect(successResult.broadcast).toHaveProperty('results');
		expect(successResult.broadcast).toHaveProperty('failures');

		// Reset mocks for failure case
		vi.clearAllMocks();
		resetEventFactory();
		mockSign.mockResolvedValue(makeSignedEvent());

		// Test with failure
		mockedBroadcast.mockRejectedValue(new Error('fail'));
		const failResult = await publishEvent(makeTemplate());
		expect(failResult).toHaveProperty('event');
		expect(failResult).toHaveProperty('broadcast');
		expect(failResult.broadcast).toHaveProperty('success');
		expect(failResult.broadcast).toHaveProperty('acceptedCount');
		expect(failResult.broadcast).toHaveProperty('rejectedCount');
		expect(failResult.broadcast).toHaveProperty('results');
		expect(failResult.broadcast).toHaveProperty('failures');
	});

	it('broadcast failure does not throw — callers do not need try/catch for broadcast issues', async () => {
		mockedBroadcast.mockRejectedValue(new Error('Connection refused'));

		// This must not throw
		const result = await publishEvent(makeTemplate());

		expect(result).toBeDefined();
		expect(result.broadcast.success).toBe(false);
	});
});
