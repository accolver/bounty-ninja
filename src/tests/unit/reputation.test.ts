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

function pledge(id: string, pubkey = USER): Pledge {
	return { id, pubkey } as Pledge;
}

function payout(id: string, source: Pledge, pubkey = source.pubkey): Payout {
	return { id, pubkey, sourcePledgeId: source.id } as Payout;
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
			releasedAmount: payouts.length,
			totalAmount: pledges.length,
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
});
