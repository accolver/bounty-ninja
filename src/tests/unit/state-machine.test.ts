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
	it('returns "open" when there are no related events', () => {
		const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
		expect(deriveBountyStatus(taskEvt, [], [], [], [], NOW, false)).toBe('open');
	});

	it('returns "open" when there are pledges but no solutions', () => {
		const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
		const pledge = mockEvent({ kind: 73002 });
		expect(deriveBountyStatus(taskEvt, [pledge], [], [], [], NOW, false)).toBe('open');
	});

	it('returns "in_review" when there are solutions', () => {
		const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
		const pledge = mockEvent({ kind: 73002 });
		const solution = mockEvent({ kind: 73001 });
		expect(deriveBountyStatus(taskEvt, [pledge], [solution], [], [], NOW, false)).toBe('in_review');
	});

	it('returns "completed" when there are payouts and no consensus', () => {
		const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
		const pledge = mockEvent({ kind: 73002 });
		const solution = mockEvent({ kind: 73001 });
		const payout = mockEvent({ kind: 73004 });
		expect(deriveBountyStatus(taskEvt, [pledge], [solution], [payout], [], NOW, false)).toBe(
			'completed'
		);
	});

	it('returns "cancelled" when there are delete events', () => {
		const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
		const pledge = mockEvent({ kind: 73002 });
		const deleteEvent = mockEvent({ kind: 5 });
		expect(deriveBountyStatus(taskEvt, [pledge], [], [], [deleteEvent], NOW, false)).toBe(
			'cancelled'
		);
	});

	it('returns "expired" when expiration is in the past', () => {
		const taskEvt = mockEvent({
			kind: 37300,
			tags: [
				['d', 'test'],
				['expiration', '1699999999']
			]
		});
		expect(deriveBountyStatus(taskEvt, [], [], [], [], NOW, false)).toBe('expired');
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
		expect(deriveBountyStatus(taskEvt, [pledge], [], [], [], NOW, false)).toBe('open');
	});

	it('returns "expired" when expiration equals now exactly', () => {
		const taskEvt = mockEvent({
			kind: 37300,
			tags: [
				['d', 'test'],
				['expiration', String(NOW)]
			]
		});
		expect(deriveBountyStatus(taskEvt, [], [], [], [], NOW, false)).toBe('expired');
	});

	// New consensus/releasing status tests
	describe('consensus_reached status', () => {
		it('returns "consensus_reached" when hasConsensus=true and no payouts', () => {
			const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const solution = mockEvent({ kind: 73001 });
			expect(deriveBountyStatus(taskEvt, [], [solution], [], [], NOW, true)).toBe(
				'consensus_reached'
			);
		});

		it('returns "consensus_reached" with pledges and solutions', () => {
			const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const pledge = mockEvent({ kind: 73002 });
			const solution = mockEvent({ kind: 73001 });
			expect(deriveBountyStatus(taskEvt, [pledge], [solution], [], [], NOW, true)).toBe(
				'consensus_reached'
			);
		});
	});

	describe('releasing status', () => {
		it('returns "releasing" when hasConsensus=true and payouts exist', () => {
			const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const payout = mockEvent({ kind: 73004 });
			expect(deriveBountyStatus(taskEvt, [], [], [payout], [], NOW, true)).toBe('releasing');
		});

		it('returns "releasing" with multiple payouts and consensus', () => {
			const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const payout1 = mockEvent({ kind: 73004 });
			const payout2 = mockEvent({ kind: 73004 });
			expect(deriveBountyStatus(taskEvt, [], [], [payout1, payout2], [], NOW, true)).toBe(
				'releasing'
			);
		});
	});

	describe('completed status', () => {
		it('returns "completed" when payouts exist and no consensus', () => {
			const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const payout = mockEvent({ kind: 73004 });
			expect(deriveBountyStatus(taskEvt, [], [], [payout], [], NOW, false)).toBe('completed');
		});
	});

	describe('expired overrides consensus', () => {
		it('returns "expired" when deadline passed and hasConsensus but no payouts', () => {
			const taskEvt = mockEvent({
				kind: 37300,
				tags: [
					['d', 'test'],
					['expiration', '1699999999']
				]
			});
			expect(deriveBountyStatus(taskEvt, [], [], [], [], NOW, true)).toBe('expired');
		});
	});

	// Priority order tests
	describe('priority order', () => {
		it('cancelled takes priority over completed', () => {
			const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const payout = mockEvent({ kind: 73004 });
			const deleteEvent = mockEvent({ kind: 5 });
			expect(deriveBountyStatus(taskEvt, [], [], [payout], [deleteEvent], NOW, false)).toBe(
				'cancelled'
			);
		});

		it('cancelled takes priority over releasing', () => {
			const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const payout = mockEvent({ kind: 73004 });
			const deleteEvent = mockEvent({ kind: 5 });
			expect(deriveBountyStatus(taskEvt, [], [], [payout], [deleteEvent], NOW, true)).toBe(
				'cancelled'
			);
		});

		it('cancelled takes priority over consensus_reached', () => {
			const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const deleteEvent = mockEvent({ kind: 5 });
			expect(deriveBountyStatus(taskEvt, [], [], [], [deleteEvent], NOW, true)).toBe('cancelled');
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
			expect(deriveBountyStatus(taskEvt, [], [], [payout], [], NOW, false)).toBe('completed');
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
			expect(deriveBountyStatus(taskEvt, [], [solution], [], [], NOW, false)).toBe('expired');
		});

		it('in_review takes priority over open', () => {
			const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const pledge = mockEvent({ kind: 73002 });
			const solution = mockEvent({ kind: 73001 });
			expect(deriveBountyStatus(taskEvt, [pledge], [solution], [], [], NOW, false)).toBe(
				'in_review'
			);
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
				deriveBountyStatus(taskEvt, [pledge], [solution], [payout], [deleteEvent], NOW, true)
			).toBe('cancelled');
		});
	});

	describe('Kind 73005 retraction', () => {
		it('returns "cancelled" for Kind 73005 type=bounty retraction', () => {
			const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const retraction = mockEvent({
				kind: 73005,
				tags: [
					['a', '37300:' + 'b'.repeat(64) + ':test'],
					['type', 'bounty']
				]
			});
			expect(
				deriveBountyStatus(taskEvt, [], [], [], [], NOW, false, [retraction])
			).toBe('cancelled');
		});

		it('does NOT return "cancelled" for Kind 73005 type=pledge retraction', () => {
			const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const retraction = mockEvent({
				kind: 73005,
				tags: [
					['a', '37300:' + 'b'.repeat(64) + ':test'],
					['type', 'pledge'],
					['e', '1'.repeat(64)]
				]
			});
			expect(
				deriveBountyStatus(taskEvt, [], [], [], [], NOW, false, [retraction])
			).toBe('open');
		});

		it('Kind 73005 bounty retraction overrides other states', () => {
			const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const solution = mockEvent({ kind: 73001 });
			const payout = mockEvent({ kind: 73004 });
			const retraction = mockEvent({
				kind: 73005,
				tags: [
					['a', '37300:' + 'b'.repeat(64) + ':test'],
					['type', 'bounty']
				]
			});
			expect(
				deriveBountyStatus(taskEvt, [], [solution], [payout], [], NOW, true, [retraction])
			).toBe('cancelled');
		});

		it('legacy Kind 5 still triggers cancelled', () => {
			const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const deleteEvent = mockEvent({ kind: 5 });
			expect(deriveBountyStatus(taskEvt, [], [], [], [deleteEvent], NOW, false, [])).toBe(
				'cancelled'
			);
		});
	});

	describe('edge cases', () => {
		it('handles missing expiration tag gracefully', () => {
			const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			expect(deriveBountyStatus(taskEvt, [], [], [], [], NOW, false)).toBe('open');
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
			expect(deriveBountyStatus(taskEvt, [], [], [], [], NOW, false)).toBe('open');
		});

		it('handles empty expiration tag value', () => {
			const taskEvt = mockEvent({
				kind: 37300,
				tags: [['expiration']]
			});
			expect(deriveBountyStatus(taskEvt, [], [], [], [], NOW, false)).toBe('open');
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
			expect(deriveBountyStatus(taskEvt, [], [], [], [])).toBe('open');
		});

		it('returns "in_review" with solutions but no pledges', () => {
			const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const solution = mockEvent({ kind: 73001 });
			expect(deriveBountyStatus(taskEvt, [], [solution], [], [], NOW, false)).toBe('in_review');
		});

		it('defaults hasConsensus to false for backward compatibility', () => {
			const taskEvt = mockEvent({ kind: 37300, tags: [['d', 'test']] });
			const payout = mockEvent({ kind: 73004 });
			// Not passing hasConsensus — should default to false, so payouts = completed
			expect(deriveBountyStatus(taskEvt, [], [], [payout], [], NOW)).toBe('completed');
		});
	});
});
