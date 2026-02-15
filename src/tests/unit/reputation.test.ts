import { describe, it, expect } from 'vitest';
import type { NostrEvent } from 'nostr-tools';
import { deriveReputation } from '$lib/reputation/score';
import { PAYOUT_KIND, PLEDGE_KIND, REPUTATION_KIND } from '$lib/bounty/kinds';

const PUBKEY_A = 'a'.repeat(64);
const PUBKEY_B = 'b'.repeat(64);
const SIG = 'c'.repeat(128);
/** Task address where PUBKEY_B is the bounty creator (NOT PUBKEY_A) */
const TASK_ADDR_BY_B = `37300:${PUBKEY_B}:bounty-123`;
/** Task address where PUBKEY_A is the bounty creator */
const TASK_ADDR_BY_A = `37300:${PUBKEY_A}:bounty-456`;

function mockEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
	return {
		id: 'e'.repeat(64),
		pubkey: PUBKEY_B,
		created_at: Math.floor(Date.now() / 1000),
		kind: 1,
		tags: [],
		content: '',
		sig: SIG,
		...overrides
	};
}

function makePayout(opts: { pubkey?: string; solverPubkey?: string; taskAddr?: string } = {}): NostrEvent {
	return mockEvent({
		kind: PAYOUT_KIND,
		pubkey: opts.pubkey ?? PUBKEY_B,
		tags: [
			['a', opts.taskAddr ?? TASK_ADDR_BY_B],
			['p', opts.solverPubkey ?? PUBKEY_B],
			['e', '1'.repeat(64)]
		]
	});
}

function makePledge(pubkey: string = PUBKEY_A): NostrEvent {
	return mockEvent({
		kind: PLEDGE_KIND,
		pubkey,
		tags: [['a', TASK_ADDR_BY_B]]
	});
}

function makeRepEvent(opts: { targetPubkey: string; type: string }): NostrEvent {
	return mockEvent({
		kind: REPUTATION_KIND,
		tags: [
			['p', opts.targetPubkey],
			['type', opts.type],
			['e', '1'.repeat(64)]
		]
	});
}

describe('deriveReputation', () => {
	it('returns "new" tier for user with no events', () => {
		const score = deriveReputation(PUBKEY_A, [], [], []);
		expect(score.tier).toBe('new');
		expect(score.bountiesCompleted).toBe(0);
		expect(score.releaseRate).toBe(1); // No pledges = 100% rate
	});

	it('returns "emerging" for user with 5 completions and 0 retractions', () => {
		// 5 payouts where PUBKEY_A is the solver
		const payouts = Array.from({ length: 5 }, () =>
			makePayout({ solverPubkey: PUBKEY_A })
		);
		const score = deriveReputation(PUBKEY_A, payouts, [], []);
		expect(score.tier).toBe('emerging');
		expect(score.solutionsAccepted).toBe(5);
	});

	it('returns "established" for user with 15 completions', () => {
		const payouts = Array.from({ length: 15 }, () =>
			makePayout({ solverPubkey: PUBKEY_A })
		);
		const score = deriveReputation(PUBKEY_A, payouts, [], []);
		expect(score.tier).toBe('established');
	});

	it('returns "trusted" for user with 30 completions and perfect release rate', () => {
		// 15 payouts as solver (bounty by someone else) + 15 pledges all released by PUBKEY_A
		const solverPayouts = Array.from({ length: 15 }, () =>
			makePayout({ solverPubkey: PUBKEY_A, taskAddr: TASK_ADDR_BY_B })
		);
		const pledgerPayouts = Array.from({ length: 15 }, () =>
			makePayout({ pubkey: PUBKEY_A, taskAddr: TASK_ADDR_BY_B })
		);
		const pledges = Array.from({ length: 15 }, () => makePledge(PUBKEY_A));
		const payouts = [...solverPayouts, ...pledgerPayouts];
		const score = deriveReputation(PUBKEY_A, payouts, [], pledges);
		expect(score.tier).toBe('trusted');
		expect(score.releaseRate).toBe(1);
		expect(score.bountyRetractions).toBe(0);
	});

	it('returns "flagged" for user with retractions dominating history', () => {
		// 1 completion, 2 retractions
		const payouts = [makePayout({ solverPubkey: PUBKEY_A })];
		const repEvents = [
			makeRepEvent({ targetPubkey: PUBKEY_A, type: 'bounty_retraction' }),
			makeRepEvent({ targetPubkey: PUBKEY_A, type: 'bounty_retraction' })
		];
		const score = deriveReputation(PUBKEY_A, payouts, repEvents, []);
		expect(score.tier).toBe('flagged');
		expect(score.bountyRetractions).toBe(2);
	});

	it('does not flag user when completions exceed retractions', () => {
		const payouts = Array.from({ length: 10 }, () =>
			makePayout({ solverPubkey: PUBKEY_A })
		);
		const repEvents = [
			makeRepEvent({ targetPubkey: PUBKEY_A, type: 'bounty_retraction' })
		];
		const score = deriveReputation(PUBKEY_A, payouts, repEvents, []);
		// 10 completions, 1 retraction — not flagged, but retraction blocks "emerging" (needs 0 retractions)
		// 11 total interactions >= 10 and releaseRate > 0.9 → established
		expect(score.tier).toBe('established');
	});

	it('counts pledge retractions separately', () => {
		const repEvents = [
			makeRepEvent({ targetPubkey: PUBKEY_A, type: 'pledge_retraction' })
		];
		const score = deriveReputation(PUBKEY_A, [], repEvents, []);
		expect(score.pledgeRetractions).toBe(1);
		expect(score.bountyRetractions).toBe(0);
	});

	it('computes correct release rate', () => {
		const pledges = Array.from({ length: 10 }, () => makePledge(PUBKEY_A));
		const payouts = Array.from({ length: 8 }, () =>
			makePayout({ pubkey: PUBKEY_A })
		);
		const score = deriveReputation(PUBKEY_A, payouts, [], pledges);
		expect(score.totalPledges).toBe(10);
		expect(score.pledgesReleased).toBe(8);
		expect(score.releaseRate).toBeCloseTo(0.8);
	});
});
