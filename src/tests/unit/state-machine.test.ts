import { describe, it, expect } from 'vitest';
import type { NostrEvent } from 'nostr-tools';
import { deriveBountyStatus } from '$lib/bounty/state-machine';

function mockEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
	return {
		id: 'a'.repeat(64),
		pubkey: 'b'.repeat(64),
		created_at: Math.floor(Date.now() / 1000),
		kind: 1,
		tags: [],
		content: '',
		sig: 'c'.repeat(128),
		...overrides
	};
}

const NOW = 1700000000;

describe('deriveBountyStatus', () => {
	it('returns "draft" when there are no related events', () => {
		const bounty = mockEvent({ kind: 37300, tags: [['d', 'test']] });
		expect(deriveBountyStatus(bounty, [], [], [], [], NOW)).toBe('draft');
	});

	it('returns "open" when there are pledges but no solutions', () => {
		const bounty = mockEvent({ kind: 37300, tags: [['d', 'test']] });
		const pledge = mockEvent({ kind: 73002 });
		expect(deriveBountyStatus(bounty, [pledge], [], [], [], NOW)).toBe('open');
	});

	it('returns "in_review" when there are solutions', () => {
		const bounty = mockEvent({ kind: 37300, tags: [['d', 'test']] });
		const pledge = mockEvent({ kind: 73002 });
		const solution = mockEvent({ kind: 73001 });
		expect(deriveBountyStatus(bounty, [pledge], [solution], [], [], NOW)).toBe('in_review');
	});

	it('returns "completed" when there are payouts', () => {
		const bounty = mockEvent({ kind: 37300, tags: [['d', 'test']] });
		const pledge = mockEvent({ kind: 73002 });
		const solution = mockEvent({ kind: 73001 });
		const payout = mockEvent({ kind: 73004 });
		expect(deriveBountyStatus(bounty, [pledge], [solution], [payout], [], NOW)).toBe('completed');
	});

	it('returns "cancelled" when there are delete events', () => {
		const bounty = mockEvent({ kind: 37300, tags: [['d', 'test']] });
		const pledge = mockEvent({ kind: 73002 });
		const deleteEvent = mockEvent({ kind: 5 });
		expect(deriveBountyStatus(bounty, [pledge], [], [], [deleteEvent], NOW)).toBe('cancelled');
	});

	it('returns "expired" when expiration is in the past', () => {
		const bounty = mockEvent({
			kind: 37300,
			tags: [
				['d', 'test'],
				['expiration', '1699999999']
			]
		});
		expect(deriveBountyStatus(bounty, [], [], [], [], NOW)).toBe('expired');
	});

	it('does not return "expired" when expiration is in the future', () => {
		const bounty = mockEvent({
			kind: 37300,
			tags: [
				['d', 'test'],
				['expiration', '1800000000']
			]
		});
		const pledge = mockEvent({ kind: 73002 });
		expect(deriveBountyStatus(bounty, [pledge], [], [], [], NOW)).toBe('open');
	});

	it('returns "expired" when expiration equals now exactly', () => {
		const bounty = mockEvent({
			kind: 37300,
			tags: [
				['d', 'test'],
				['expiration', String(NOW)]
			]
		});
		expect(deriveBountyStatus(bounty, [], [], [], [], NOW)).toBe('expired');
	});

	// Priority order tests
	describe('priority order', () => {
		it('cancelled takes priority over completed', () => {
			const bounty = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const payout = mockEvent({ kind: 73004 });
			const deleteEvent = mockEvent({ kind: 5 });
			expect(deriveBountyStatus(bounty, [], [], [payout], [deleteEvent], NOW)).toBe('cancelled');
		});

		it('completed takes priority over expired', () => {
			const bounty = mockEvent({
				kind: 37300,
				tags: [
					['d', 'test'],
					['expiration', '1699999999']
				]
			});
			const payout = mockEvent({ kind: 73004 });
			expect(deriveBountyStatus(bounty, [], [], [payout], [], NOW)).toBe('completed');
		});

		it('expired takes priority over in_review', () => {
			const bounty = mockEvent({
				kind: 37300,
				tags: [
					['d', 'test'],
					['expiration', '1699999999']
				]
			});
			const solution = mockEvent({ kind: 73001 });
			expect(deriveBountyStatus(bounty, [], [solution], [], [], NOW)).toBe('expired');
		});

		it('in_review takes priority over open', () => {
			const bounty = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const pledge = mockEvent({ kind: 73002 });
			const solution = mockEvent({ kind: 73001 });
			expect(deriveBountyStatus(bounty, [pledge], [solution], [], [], NOW)).toBe('in_review');
		});

		it('cancelled takes priority over everything', () => {
			const bounty = mockEvent({
				kind: 37300,
				tags: [
					['d', 'test'],
					['expiration', '1699999999']
				]
			});
			const pledge = mockEvent({ kind: 73002 });
			const solution = mockEvent({ kind: 73001 });
			const payout = mockEvent({ kind: 73004 });
			const deleteEvent = mockEvent({ kind: 5 });
			expect(
				deriveBountyStatus(bounty, [pledge], [solution], [payout], [deleteEvent], NOW)
			).toBe('cancelled');
		});
	});

	describe('edge cases', () => {
		it('handles missing expiration tag gracefully', () => {
			const bounty = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			expect(deriveBountyStatus(bounty, [], [], [], [], NOW)).toBe('draft');
		});

		it('handles malformed expiration tag', () => {
			const bounty = mockEvent({
				kind: 37300,
				tags: [
					['d', 'test'],
					['expiration', 'not-a-number']
				]
			});
			// Malformed expiration should be treated as no expiration
			expect(deriveBountyStatus(bounty, [], [], [], [], NOW)).toBe('draft');
		});

		it('handles empty expiration tag value', () => {
			const bounty = mockEvent({
				kind: 37300,
				tags: [['expiration']]
			});
			expect(deriveBountyStatus(bounty, [], [], [], [], NOW)).toBe('draft');
		});

		it('uses current time when now is not provided', () => {
			const farFuture = Math.floor(Date.now() / 1000) + 999999;
			const bounty = mockEvent({
				kind: 37300,
				tags: [
					['d', 'test'],
					['expiration', String(farFuture)]
				]
			});
			// Should not be expired since expiration is far in the future
			expect(deriveBountyStatus(bounty, [], [], [], [])).toBe('draft');
		});

		it('returns "in_review" with solutions but no pledges', () => {
			const bounty = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const solution = mockEvent({ kind: 73001 });
			expect(deriveBountyStatus(bounty, [], [solution], [], [], NOW)).toBe('in_review');
		});
	});
});
