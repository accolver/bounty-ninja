import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NostrEvent } from 'nostr-tools';

// Mock nostr-tools before importing the module under test
vi.mock('nostr-tools', () => ({
	verifyEvent: vi.fn()
}));

import { validateEvent } from '$lib/nostr/event-validator';
import { verifyEvent } from 'nostr-tools';

const mockedVerifyEvent = vi.mocked(verifyEvent);

/** Helper to create a well-formed mock NostrEvent. */
function makeEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
	return {
		id: 'a'.repeat(64),
		pubkey: 'b'.repeat(64),
		kind: 1,
		created_at: Math.floor(Date.now() / 1000),
		content: 'hello',
		tags: [],
		sig: 'c'.repeat(128),
		...overrides
	};
}

describe('validateEvent', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns true when verifyEvent confirms a valid signature', () => {
		mockedVerifyEvent.mockReturnValue(true);
		const event = makeEvent();

		const result = validateEvent(event);

		expect(result).toBe(true);
		expect(mockedVerifyEvent).toHaveBeenCalledOnce();
		expect(mockedVerifyEvent).toHaveBeenCalledWith(event);
	});

	it('returns false when verifyEvent rejects an invalid signature', () => {
		mockedVerifyEvent.mockReturnValue(false);
		const event = makeEvent({ sig: '0'.repeat(128) });

		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const result = validateEvent(event);

		expect(result).toBe(false);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('Rejected event with invalid signature')
		);
		warnSpy.mockRestore();
	});

	it('returns false for a malformed event (verifyEvent returns false)', () => {
		mockedVerifyEvent.mockReturnValue(false);
		const malformed = makeEvent({ id: 'not-a-valid-id', kind: -1 });

		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const result = validateEvent(malformed);

		expect(result).toBe(false);
		expect(mockedVerifyEvent).toHaveBeenCalledWith(malformed);
		warnSpy.mockRestore();
	});

	it('passes the exact event object to verifyEvent', () => {
		mockedVerifyEvent.mockReturnValue(true);
		const event = makeEvent({ content: 'specific content', kind: 37300 });

		validateEvent(event);

		expect(mockedVerifyEvent).toHaveBeenCalledWith(event);
	});
});
