import type { BountySummary } from './types';

export interface FeaturedBountyGroups {
	mostFunded: BountySummary[];
	endingSoon: BountySummary[];
	newest: BountySummary[];
	needsSolutions: BountySummary[];
}

export function getFeaturedBountyGroups(
	bounties: BountySummary[],
	limit = 3,
	now = Math.floor(Date.now() / 1000)
): FeaturedBountyGroups {
	const active = bounties.filter(
		(bounty) => bounty.status === 'open' || bounty.status === 'in_review'
	);
	const open = bounties.filter((bounty) => bounty.status === 'open');

	return {
		mostFunded: [...active]
			.filter((bounty) => bounty.totalPledged > 0)
			.sort((a, b) => b.totalPledged - a.totalPledged || b.createdAt - a.createdAt)
			.slice(0, limit),
		endingSoon: [...active]
			.filter((bounty) => bounty.deadline !== null && bounty.deadline > now)
			.sort((a, b) => (a.deadline ?? 0) - (b.deadline ?? 0))
			.slice(0, limit),
		newest: [...bounties].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit),
		needsSolutions: [...open]
			.filter((bounty) => bounty.solutionCount === 0)
			.sort((a, b) => b.totalPledged - a.totalPledged || b.createdAt - a.createdAt)
			.slice(0, limit)
	};
}

export function hasFeaturedBountyGroups(groups: FeaturedBountyGroups): boolean {
	return Object.values(groups).some((group) => group.length > 0);
}
