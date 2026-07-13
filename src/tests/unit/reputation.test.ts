import { describe, expect, it } from 'vitest';
import type { Payout, Pledge, Retraction, Solution, VoteTally } from '$lib/bounty/types';
import { deriveReputation, type ReputationProjection } from '$lib/reputation/score';

const USER = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);
const SOLVER = 'c'.repeat(64);

function projection(
	id: number,
	overrides: Partial<ReputationProjection> = {}
): ReputationProjection {
	const bountyAddress = `37300:${OTHER}:bounty-${id}`;
	return {
		bountyAddress,
		projectedAt: id,
		validatedPledges: [],
		consensus: { state: 'none', tallies: new Map() },
		authorizedRetractions: [],
		validPayouts: [],
		releaseProgress: {
			requiredPledgeIds: new Set(),
			releasedPledgeIds: new Set(),
			releasedAmount: 0,
			totalAmount: 0,
			complete: false
		},
		...overrides
	};
}

function pledge(id: string, pubkey = USER, overrides: Partial<Pledge> = {}): Pledge {
	return { id, pubkey, amount: 1, createdAt: 100, ...overrides } as Pledge;
}

function payout(id: string, source: Pledge, overrides: Partial<Payout> = {}): Payout {
	return {
		id,
		pubkey: source.pubkey,
		solverPubkey: SOLVER,
		sourcePledgeId: source.id,
		amount: source.amount,
		createdAt: source.createdAt,
		...overrides
	} as Payout;
}

function completeProjection(
	id: number,
	creator: string,
	solver: string,
	pledges: Pledge[],
	payouts: Payout[]
): ReputationProjection {
	const winner = { id: `solution-${id}`, pubkey: solver } as Solution;
	const tally = {} as VoteTally;
	return projection(id, {
		bountyAddress: `37300:${creator}:bounty-${id}`,
		validatedPledges: pledges,
		validPayouts: payouts,
		consensus: { state: 'unique', winner, tallies: new Map([[winner.id, tally]]) },
		releaseProgress: {
			requiredPledgeIds: new Set(pledges.map((item) => item.id)),
			releasedPledgeIds: new Set(payouts.map((item) => item.sourcePledgeId!)),
			releasedAmount: payouts.reduce((sum, item) => sum + item.amount, 0),
			totalAmount: pledges.reduce((sum, item) => sum + item.amount, 0),
			complete: true
		}
	});
}

describe('deriveReputation', () => {
	it('returns neutral new reputation without trusted projections', () => {
		expect(deriveReputation(USER, [])).toEqual({
			bountiesCompleted: 0,
			pledgesReleased: 0,
			totalPledges: 0,
			releaseRate: 1,
			solutionsAccepted: 0,
			bountyRetractions: 0,
			pledgeRetractions: 0,
			satsEarned: 0,
			satsReleased: 0,
			recentActivityAt: null,
			tier: 'new'
		});
	});

	it('credits only valid source-bound payouts represented by the projection', () => {
		const source = pledge('pledge-1');
		const score = deriveReputation(USER, [
			completeProjection(1, OTHER, SOLVER, [source], [payout('payout-1', source)])
		]);
		expect(score.totalPledges).toBe(1);
		expect(score.pledgesReleased).toBe(1);
		expect(score.releaseRate).toBe(1);
	});

	it('does not credit incomplete releases as completed bounties or accepted solutions', () => {
		const source = pledge('pledge-1', OTHER);
		const winner = { id: 'solution', pubkey: USER } as Solution;
		const incomplete = projection(1, {
			bountyAddress: `37300:${USER}:bounty`,
			consensus: { state: 'unique', winner, tallies: new Map() },
			validatedPledges: [source]
		});
		const score = deriveReputation(USER, [incomplete]);
		expect(score.bountiesCompleted).toBe(0);
		expect(score.solutionsAccepted).toBe(0);
	});

	it('counts one completion and accepted solution across multiple source payouts', () => {
		const first = pledge('pledge-1');
		const second = pledge('pledge-2');
		const result = completeProjection(
			1,
			USER,
			USER,
			[first, second],
			[payout('payout-1', first), payout('payout-2', second)]
		);
		const score = deriveReputation(USER, [result]);
		expect(score.bountiesCompleted).toBe(1);
		expect(score.solutionsAccepted).toBe(1);
		expect(score.pledgesReleased).toBe(2);
	});

	it('deduplicates source payouts and repeated projections', () => {
		const source = pledge('pledge-1');
		const result = completeProjection(
			1,
			OTHER,
			SOLVER,
			[source],
			[payout('payout-1', source), payout('payout-2', source)]
		);
		const newer = { ...result, projectedAt: 2 };
		const score = deriveReputation(USER, [result, newer]);
		expect(score.totalPledges).toBe(1);
		expect(score.pledgesReleased).toBe(1);
	});

	it('uses validated pledges only for the release-rate denominator', () => {
		const released = pledge('pledge-1');
		const unreleased = pledge('pledge-2');
		const score = deriveReputation(USER, [
			projection(1, {
				validatedPledges: [released, unreleased],
				validPayouts: [payout('payout-1', released)]
			})
		]);
		expect(score.totalPledges).toBe(2);
		expect(score.pledgesReleased).toBe(1);
		expect(score.releaseRate).toBe(0.5);
	});

	it('counts only authorized retractions supplied by the projection and deduplicates IDs', () => {
		const bountyRetraction = { id: 'r1', pubkey: USER, type: 'bounty' } as Retraction;
		const pledgeRetraction = { id: 'r2', pubkey: USER, type: 'pledge' } as Retraction;
		const score = deriveReputation(USER, [
			projection(1, {
				authorizedRetractions: [bountyRetraction, bountyRetraction, pledgeRetraction]
			})
		]);
		expect(score.bountyRetractions).toBe(1);
		expect(score.pledgeRetractions).toBe(1);
		expect(score.tier).toBe('flagged');
	});

	it('ignores authorized retractions belonging to another user', () => {
		const otherRetraction = { id: 'r1', pubkey: OTHER, type: 'bounty' } as Retraction;
		const score = deriveReputation(USER, [
			projection(1, { authorizedRetractions: [otherRetraction] })
		]);
		expect(score.bountyRetractions).toBe(0);
	});

	it('returns emerging for five accepted solutions and no retractions', () => {
		const history = Array.from({ length: 5 }, (_, index) =>
			completeProjection(index, OTHER, USER, [], [])
		);
		const score = deriveReputation(USER, history);
		expect(score.tier).toBe('emerging');
		expect(score.solutionsAccepted).toBe(5);
	});

	it('returns established for fifteen accepted solutions', () => {
		const history = Array.from({ length: 15 }, (_, index) =>
			completeProjection(index, OTHER, USER, [], [])
		);
		expect(deriveReputation(USER, history).tier).toBe('established');
	});

	it('returns trusted for thirty completions and a perfect release rate', () => {
		const history = Array.from({ length: 15 }, (_, index) => {
			const source = pledge(`pledge-${index}`);
			return completeProjection(index, OTHER, USER, [source], [payout(`payout-${index}`, source)]);
		});
		const score = deriveReputation(USER, history);
		expect(score.tier).toBe('trusted');
		expect(score.solutionsAccepted + score.pledgesReleased).toBe(30);
		expect(score.releaseRate).toBe(1);
		expect(score.bountyRetractions).toBe(0);
	});

	it('returns flagged when retractions dominate completed history', () => {
		const completed = completeProjection(1, OTHER, USER, [], []);
		const score = deriveReputation(USER, [
			{
				...completed,
				authorizedRetractions: [
					{ id: 'r1', pubkey: USER, type: 'bounty' } as Retraction,
					{ id: 'r2', pubkey: USER, type: 'bounty' } as Retraction
				]
			}
		]);
		expect(score.tier).toBe('flagged');
		expect(score.bountyRetractions).toBe(2);
	});

	it('does not flag a user when completions exceed retractions', () => {
		const history = Array.from({ length: 10 }, (_, index) =>
			completeProjection(index, OTHER, USER, [], [])
		);
		history[0] = {
			...history[0],
			authorizedRetractions: [{ id: 'r1', pubkey: USER, type: 'bounty' } as Retraction]
		};
		expect(deriveReputation(USER, history).tier).toBe('established');
	});

	it('counts pledge retractions separately', () => {
		const score = deriveReputation(USER, [
			projection(1, {
				authorizedRetractions: [{ id: 'r1', pubkey: USER, type: 'pledge' } as Retraction]
			})
		]);
		expect(score.pledgeRetractions).toBe(1);
		expect(score.bountyRetractions).toBe(0);
		expect(score.tier).toBe('flagged');
	});

	it('computes the release rate from source-bound payouts', () => {
		const pledges = Array.from({ length: 10 }, (_, index) => pledge(`pledge-${index}`));
		const payouts = pledges.slice(0, 8).map((source, index) => payout(`payout-${index}`, source));
		const score = deriveReputation(USER, [
			projection(1, { validatedPledges: pledges, validPayouts: payouts })
		]);
		expect(score.totalPledges).toBe(10);
		expect(score.pledgesReleased).toBe(8);
		expect(score.releaseRate).toBeCloseTo(0.8);
	});

	it('derives sats earned, sats released, and recent activity from trusted public data', () => {
		const earnedSource = pledge('earned-source', OTHER, { amount: 2100, createdAt: 200 });
		const releasedSource = pledge('released-source', USER, { amount: 900, createdAt: 250 });
		const score = deriveReputation(USER, [
			projection(1, {
				validatedPledges: [earnedSource, releasedSource],
				validPayouts: [
					payout('earned-payout', earnedSource, {
						solverPubkey: USER,
						amount: 2100,
						createdAt: 300
					}),
					payout('released-payout', releasedSource, {
						solverPubkey: OTHER,
						amount: 900,
						createdAt: 275
					})
				]
			})
		]);
		expect(score.satsEarned).toBe(2100);
		expect(score.satsReleased).toBe(900);
		expect(score.recentActivityAt).toBe(300);
	});
});
