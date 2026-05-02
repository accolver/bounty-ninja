import { describe, expect, it } from 'vitest';
import { getFeaturedBountyGroups, hasFeaturedBountyGroups } from '$lib/bounty/featured';
import type { BountySummary } from '$lib/bounty/types';

function bounty(overrides: Partial<BountySummary>): BountySummary {
	return {
		id: overrides.id ?? crypto.randomUUID(),
		dTag: overrides.dTag ?? 'd',
		pubkey: overrides.pubkey ?? 'a'.repeat(64),
		title: overrides.title ?? 'Bounty',
		tags: overrides.tags ?? [],
		rewardAmount: overrides.rewardAmount ?? 0,
		totalPledged: overrides.totalPledged ?? 0,
		solutionCount: overrides.solutionCount ?? 0,
		status: overrides.status ?? 'open',
		createdAt: overrides.createdAt ?? 1,
		deadline: overrides.deadline ?? null
	};
}

describe('getFeaturedBountyGroups', () => {
	it('ranks most funded, ending soon, newest, and needs solutions', () => {
		const groups = getFeaturedBountyGroups(
			[
				bounty({ id: 'low', totalPledged: 100, createdAt: 10 }),
				bounty({ id: 'high', totalPledged: 500, createdAt: 5, solutionCount: 1 }),
				bounty({ id: 'soon', totalPledged: 200, deadline: 110, createdAt: 20 }),
				bounty({ id: 'later', totalPledged: 300, deadline: 200, createdAt: 30 })
			],
			2,
			100
		);

		expect(groups.mostFunded.map((b) => b.id)).toEqual(['high', 'later']);
		expect(groups.endingSoon.map((b) => b.id)).toEqual(['soon', 'later']);
		expect(groups.newest.map((b) => b.id)).toEqual(['later', 'soon']);
		expect(groups.needsSolutions.map((b) => b.id)).toEqual(['later', 'soon']);
		expect(hasFeaturedBountyGroups(groups)).toBe(true);
	});

	it('reports empty groups when there is nothing to feature', () => {
		const groups = getFeaturedBountyGroups([], 2, 100);
		expect(hasFeaturedBountyGroups(groups)).toBe(false);
	});
});
