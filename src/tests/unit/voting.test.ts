import { describe, it, expect } from 'vitest';
import type { NostrEvent } from 'nostr-tools';
import { calculateVoteWeight, tallyVotes } from '$lib/task/voting';
import type { Vote } from '$lib/task/types';

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

function mockVote(overrides: Partial<Vote> = {}): Vote {
	return {
		event: mockEvent(),
		id: 'a'.repeat(64),
		pubkey: 'b'.repeat(64),
		taskAddress: '37300:pub:task',
		solutionId: 'solution1'.padEnd(64, '0'),
		choice: 'approve',
		pledgeAmount: 0,
		weight: 0,
		createdAt: Math.floor(Date.now() / 1000),
		...overrides
	};
}

describe('calculateVoteWeight', () => {
	it('returns the pledge amount for positive values', () => {
		expect(calculateVoteWeight(50000)).toBe(50000);
	});

	it('returns the pledge amount for small positive values', () => {
		expect(calculateVoteWeight(1)).toBe(1);
	});

	it('returns 0 for zero pledge', () => {
		expect(calculateVoteWeight(0)).toBe(0);
	});

	it('returns 0 for negative pledge', () => {
		expect(calculateVoteWeight(-100)).toBe(0);
	});

	it('handles large amounts', () => {
		expect(calculateVoteWeight(21_000_000 * 100_000_000)).toBe(21_000_000 * 100_000_000);
	});
});

describe('tallyVotes', () => {
	it('tallies unanimous approval correctly', () => {
		const pledgesByPubkey = new Map([
			['alice'.padEnd(64, '0'), 30000],
			['bob'.padEnd(64, '0'), 20000]
		]);
		const totalPledged = 50000;

		const votes: Vote[] = [
			mockVote({ pubkey: 'alice'.padEnd(64, '0'), choice: 'approve', createdAt: 100 }),
			mockVote({ pubkey: 'bob'.padEnd(64, '0'), choice: 'approve', createdAt: 100 })
		];

		const tally = tallyVotes(votes, pledgesByPubkey, totalPledged);

		expect(tally.approveWeight).toBe(50000);
		expect(tally.rejectWeight).toBe(0);
		expect(tally.quorum).toBe(25000);
		expect(tally.isApproved).toBe(true);
		expect(tally.isRejected).toBe(false);
		expect(tally.quorumPercent).toBe(100);
	});

	it('tallies unanimous rejection correctly', () => {
		const pledgesByPubkey = new Map([
			['alice'.padEnd(64, '0'), 30000],
			['bob'.padEnd(64, '0'), 20000]
		]);
		const totalPledged = 50000;

		const votes: Vote[] = [
			mockVote({ pubkey: 'alice'.padEnd(64, '0'), choice: 'reject', createdAt: 100 }),
			mockVote({ pubkey: 'bob'.padEnd(64, '0'), choice: 'reject', createdAt: 100 })
		];

		const tally = tallyVotes(votes, pledgesByPubkey, totalPledged);

		expect(tally.approveWeight).toBe(0);
		expect(tally.rejectWeight).toBe(50000);
		expect(tally.isApproved).toBe(false);
		expect(tally.isRejected).toBe(true);
	});

	it('handles approval below quorum', () => {
		const pledgesByPubkey = new Map([
			['alice'.padEnd(64, '0'), 10000],
			['bob'.padEnd(64, '0'), 20000],
			['carol'.padEnd(64, '0'), 70000]
		]);
		const totalPledged = 100000;

		// Only alice votes (10000 weight), quorum is 50000
		const votes: Vote[] = [
			mockVote({ pubkey: 'alice'.padEnd(64, '0'), choice: 'approve', createdAt: 100 })
		];

		const tally = tallyVotes(votes, pledgesByPubkey, totalPledged);

		expect(tally.approveWeight).toBe(10000);
		expect(tally.rejectWeight).toBe(0);
		expect(tally.quorum).toBe(50000);
		expect(tally.isApproved).toBe(false);
		expect(tally.isRejected).toBe(false);
		expect(tally.quorumPercent).toBe(10);
	});

	it('reject wins when reject weight exceeds approve weight and meets quorum', () => {
		const pledgesByPubkey = new Map([
			['alice'.padEnd(64, '0'), 10000],
			['bob'.padEnd(64, '0'), 60000]
		]);
		const totalPledged = 70000;

		const votes: Vote[] = [
			mockVote({ pubkey: 'alice'.padEnd(64, '0'), choice: 'approve', createdAt: 100 }),
			mockVote({ pubkey: 'bob'.padEnd(64, '0'), choice: 'reject', createdAt: 100 })
		];

		const tally = tallyVotes(votes, pledgesByPubkey, totalPledged);

		expect(tally.approveWeight).toBe(10000);
		expect(tally.rejectWeight).toBe(60000);
		expect(tally.isApproved).toBe(false);
		expect(tally.isRejected).toBe(true);
	});

	it('excludes non-pledger votes', () => {
		const pledgesByPubkey = new Map([['alice'.padEnd(64, '0'), 50000]]);
		const totalPledged = 50000;

		const votes: Vote[] = [
			mockVote({ pubkey: 'alice'.padEnd(64, '0'), choice: 'approve', createdAt: 100 }),
			// bob is not a pledger — this vote should be ignored
			mockVote({ pubkey: 'bob'.padEnd(64, '0'), choice: 'reject', createdAt: 100 })
		];

		const tally = tallyVotes(votes, pledgesByPubkey, totalPledged);

		expect(tally.approveWeight).toBe(50000);
		expect(tally.rejectWeight).toBe(0);
		expect(tally.isApproved).toBe(true);
	});

	it('deduplicates votes — latest vote per pubkey wins', () => {
		const pledgesByPubkey = new Map([['alice'.padEnd(64, '0'), 50000]]);
		const totalPledged = 50000;

		const votes: Vote[] = [
			// Alice first votes approve, then changes to reject
			mockVote({ pubkey: 'alice'.padEnd(64, '0'), choice: 'approve', createdAt: 100 }),
			mockVote({ pubkey: 'alice'.padEnd(64, '0'), choice: 'reject', createdAt: 200 })
		];

		const tally = tallyVotes(votes, pledgesByPubkey, totalPledged);

		expect(tally.approveWeight).toBe(0);
		expect(tally.rejectWeight).toBe(50000);
		expect(tally.isApproved).toBe(false);
		expect(tally.isRejected).toBe(true);
	});

	it('deduplicates votes — earlier reject overridden by later approve', () => {
		const pledgesByPubkey = new Map([['alice'.padEnd(64, '0'), 50000]]);
		const totalPledged = 50000;

		const votes: Vote[] = [
			mockVote({ pubkey: 'alice'.padEnd(64, '0'), choice: 'reject', createdAt: 100 }),
			mockVote({ pubkey: 'alice'.padEnd(64, '0'), choice: 'approve', createdAt: 200 })
		];

		const tally = tallyVotes(votes, pledgesByPubkey, totalPledged);

		expect(tally.approveWeight).toBe(50000);
		expect(tally.rejectWeight).toBe(0);
		expect(tally.isApproved).toBe(true);
	});

	it('returns zero tally when totalPledgedSats is zero', () => {
		const pledgesByPubkey = new Map<string, number>();
		const totalPledged = 0;

		const votes: Vote[] = [
			mockVote({ pubkey: 'alice'.padEnd(64, '0'), choice: 'approve', createdAt: 100 })
		];

		const tally = tallyVotes(votes, pledgesByPubkey, totalPledged);

		expect(tally.approveWeight).toBe(0);
		expect(tally.rejectWeight).toBe(0);
		expect(tally.quorum).toBe(0);
		expect(tally.isApproved).toBe(false);
		expect(tally.isRejected).toBe(false);
		expect(tally.quorumPercent).toBe(0);
	});

	it('returns zero tally when totalPledgedSats is negative', () => {
		const pledgesByPubkey = new Map<string, number>();
		const totalPledged = -100;

		const tally = tallyVotes([], pledgesByPubkey, totalPledged);

		expect(tally.approveWeight).toBe(0);
		expect(tally.rejectWeight).toBe(0);
		expect(tally.quorum).toBe(0);
		expect(tally.isApproved).toBe(false);
		expect(tally.isRejected).toBe(false);
	});

	it('handles single funder scenario', () => {
		const pledgesByPubkey = new Map([['alice'.padEnd(64, '0'), 100000]]);
		const totalPledged = 100000;

		const votes: Vote[] = [
			mockVote({ pubkey: 'alice'.padEnd(64, '0'), choice: 'approve', createdAt: 100 })
		];

		const tally = tallyVotes(votes, pledgesByPubkey, totalPledged);

		expect(tally.approveWeight).toBe(100000);
		expect(tally.quorum).toBe(50000);
		expect(tally.isApproved).toBe(true);
		expect(tally.quorumPercent).toBe(100);
	});

	it('handles tie — neither approved nor rejected', () => {
		const pledgesByPubkey = new Map([
			['alice'.padEnd(64, '0'), 50000],
			['bob'.padEnd(64, '0'), 50000]
		]);
		const totalPledged = 100000;

		const votes: Vote[] = [
			mockVote({ pubkey: 'alice'.padEnd(64, '0'), choice: 'approve', createdAt: 100 }),
			mockVote({ pubkey: 'bob'.padEnd(64, '0'), choice: 'reject', createdAt: 100 })
		];

		const tally = tallyVotes(votes, pledgesByPubkey, totalPledged);

		expect(tally.approveWeight).toBe(50000);
		expect(tally.rejectWeight).toBe(50000);
		// Tie: neither approve > reject nor reject > approve
		expect(tally.isApproved).toBe(false);
		expect(tally.isRejected).toBe(false);
		expect(tally.quorumPercent).toBe(100);
	});

	it('handles no votes with positive total pledged', () => {
		const pledgesByPubkey = new Map([['alice'.padEnd(64, '0'), 50000]]);
		const totalPledged = 50000;

		const tally = tallyVotes([], pledgesByPubkey, totalPledged);

		expect(tally.approveWeight).toBe(0);
		expect(tally.rejectWeight).toBe(0);
		expect(tally.quorum).toBe(25000);
		expect(tally.isApproved).toBe(false);
		expect(tally.isRejected).toBe(false);
		expect(tally.quorumPercent).toBe(0);
	});

	it('ignores pledger with zero pledge amount', () => {
		const pledgesByPubkey = new Map([
			['alice'.padEnd(64, '0'), 0],
			['bob'.padEnd(64, '0'), 50000]
		]);
		const totalPledged = 50000;

		const votes: Vote[] = [
			mockVote({ pubkey: 'alice'.padEnd(64, '0'), choice: 'reject', createdAt: 100 }),
			mockVote({ pubkey: 'bob'.padEnd(64, '0'), choice: 'approve', createdAt: 100 })
		];

		const tally = tallyVotes(votes, pledgesByPubkey, totalPledged);

		// Alice's vote has 0 weight, so only Bob's approve counts
		expect(tally.approveWeight).toBe(50000);
		expect(tally.rejectWeight).toBe(0);
		expect(tally.isApproved).toBe(true);
	});
});
