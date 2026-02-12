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
		const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
		expect(deriveBountyStatus(taskEvt, [], [], [], [], NOW)).toBe('draft');
	});

	it('returns "open" when there are pledges but no solutions', () => {
		const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
		const pledge = mockEvent({ kind: 73002 });
		expect(deriveBountyStatus(taskEvt, [pledge], [], [], [], NOW)).toBe('open');
	});

	it('returns "in_review" when there are solutions', () => {
		const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
		const pledge = mockEvent({ kind: 73002 });
		const solution = mockEvent({ kind: 73001 });
		expect(deriveBountyStatus(taskEvt, [pledge], [solution], [], [], NOW)).toBe('in_review');
	});

	it('returns "completed" when there are payouts', () => {
		const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
		const pledge = mockEvent({ kind: 73002 });
		const solution = mockEvent({ kind: 73001 });
		const payout = mockEvent({ kind: 73004 });
		expect(deriveBountyStatus(taskEvt, [pledge], [solution], [payout], [], NOW)).toBe('completed');
	});

	it('returns "cancelled" when there are delete events', () => {
		const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
		const pledge = mockEvent({ kind: 73002 });
		const deleteEvent = mockEvent({ kind: 5 });
		expect(deriveBountyStatus(taskEvt, [pledge], [], [], [deleteEvent], NOW)).toBe('cancelled');
	});

	it('returns "expired" when expiration is in the past', () => {
		const taskEvt = mockEvent({
			kind: 37300,
			tags: [
				['d', 'test'],
				['expiration', '1699999999']
			]
		});
		expect(deriveBountyStatus(taskEvt, [], [], [], [], NOW)).toBe('expired');
	});

	it('does not return "expired" when expiration is in the future', () => {
		const taskEvt = mockEvent({
			kind: 37300,
			tags: [
				['d', 'test'],
				['expiration', '1800000000']
			]
		});
		const pledge = mockEvent({ kind: 73002 });
		expect(deriveBountyStatus(taskEvt, [pledge], [], [], [], NOW)).toBe('open');
	});

	it('returns "expired" when expiration equals now exactly', () => {
		const taskEvt = mockEvent({
			kind: 37300,
			tags: [
				['d', 'test'],
				['expiration', String(NOW)]
			]
		});
		expect(deriveBountyStatus(taskEvt, [], [], [], [], NOW)).toBe('expired');
	});

	// Priority order tests
	describe('priority order', () => {
		it('cancelled takes priority over completed', () => {
			const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const payout = mockEvent({ kind: 73004 });
			const deleteEvent = mockEvent({ kind: 5 });
			expect(deriveBountyStatus(taskEvt, [], [], [payout], [deleteEvent], NOW)).toBe('cancelled');
		});

		it('completed takes priority over expired', () => {
			const taskEvt = mockEvent({
				kind: 37300,
				tags: [
					['d', 'test'],
					['expiration', '1699999999']
				]
			});
			const payout = mockEvent({ kind: 73004 });
			expect(deriveBountyStatus(taskEvt, [], [], [payout], [], NOW)).toBe('completed');
		});

		it('expired takes priority over in_review', () => {
			const taskEvt = mockEvent({
				kind: 37300,
				tags: [
					['d', 'test'],
					['expiration', '1699999999']
				]
			});
			const solution = mockEvent({ kind: 73001 });
			expect(deriveBountyStatus(taskEvt, [], [solution], [], [], NOW)).toBe('expired');
		});

		it('in_review takes priority over open', () => {
			const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const pledge = mockEvent({ kind: 73002 });
			const solution = mockEvent({ kind: 73001 });
			expect(deriveBountyStatus(taskEvt, [pledge], [solution], [], [], NOW)).toBe('in_review');
		});

		it('cancelled takes priority over everything', () => {
			const taskEvt = mockEvent({
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
				deriveBountyStatus(taskEvt, [pledge], [solution], [payout], [deleteEvent], NOW)
			).toBe('cancelled');
		});
	});

	describe('edge cases', () => {
		it('handles missing expiration tag gracefully', () => {
			const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			expect(deriveBountyStatus(taskEvt, [], [], [], [], NOW)).toBe('draft');
		});

		it('handles malformed expiration tag', () => {
			const taskEvt = mockEvent({
				kind: 37300,
				tags: [
					['d', 'test'],
					['expiration', 'not-a-number']
				]
			});
			// Malformed expiration should be treated as no expiration
			expect(deriveBountyStatus(taskEvt, [], [], [], [], NOW)).toBe('draft');
		});

		it('handles empty expiration tag value', () => {
			const taskEvt = mockEvent({
				kind: 37300,
				tags: [['expiration']]
			});
			expect(deriveBountyStatus(taskEvt, [], [], [], [], NOW)).toBe('draft');
		});

		it('uses current time when now is not provided', () => {
			const farFuture = Math.floor(Date.now() / 1000) + 999999;
			const taskEvt = mockEvent({
				kind: 37300,
				tags: [
					['d', 'test'],
					['expiration', String(farFuture)]
				]
			});
			// Should not be expired since expiration is far in the future
			expect(deriveBountyStatus(taskEvt, [], [], [], [])).toBe('draft');
		});

		it('returns "in_review" with solutions but no pledges', () => {
			const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const solution = mockEvent({ kind: 73001 });
			expect(deriveBountyStatus(taskEvt, [], [solution], [], [], NOW)).toBe('in_review');
		});
	});
});
