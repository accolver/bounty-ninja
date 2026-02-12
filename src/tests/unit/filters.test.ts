import { describe, it, expect } from 'vitest';
import {
	bountyListFilter,
	pledgesForBountyFilter,
	solutionsForBountyFilter,
	votesForBountyFilter,
	payoutForBountyFilter,
	bountyByAuthorFilter,
	searchBountiesFilter
} from '$lib/bounty/filters';
import {
	BOUNTY_KIND,
	PLEDGE_KIND,
	SOLUTION_KIND,
	VOTE_KIND,
	PAYOUT_KIND
} from '$lib/bounty/kinds';

describe('bountyListFilter', () => {
	it('returns a filter for bounty events with default limit', () => {
		const filter = bountyListFilter();
		expect(filter).toEqual({
			kinds: [BOUNTY_KIND],
			limit: 50
		});
	});

	it('accepts a custom limit', () => {
		const filter = bountyListFilter(100);
		expect(filter).toEqual({
			kinds: [BOUNTY_KIND],
			limit: 100
		});
	});

	it('uses kind 37300', () => {
		const filter = bountyListFilter();
		expect(filter.kinds).toEqual([37300]);
	});
});

describe('pledgesForBountyFilter', () => {
	it('returns a filter for pledge events referencing a bounty', () => {
		const address = '37300:abc123:my-bounty';
		const filter = pledgesForBountyFilter(address);
		expect(filter).toEqual({
			kinds: [PLEDGE_KIND],
			'#a': [address]
		});
	});

	it('uses kind 73002', () => {
		const filter = pledgesForBountyFilter('test');
		expect(filter.kinds).toEqual([73002]);
	});
});

describe('solutionsForBountyFilter', () => {
	it('returns a filter for solution events referencing a bounty', () => {
		const address = '37300:abc123:my-bounty';
		const filter = solutionsForBountyFilter(address);
		expect(filter).toEqual({
			kinds: [SOLUTION_KIND],
			'#a': [address]
		});
	});

	it('uses kind 73001', () => {
		const filter = solutionsForBountyFilter('test');
		expect(filter.kinds).toEqual([73001]);
	});
});

describe('votesForBountyFilter', () => {
	it('returns a filter for vote events referencing a bounty', () => {
		const address = '37300:abc123:my-bounty';
		const filter = votesForBountyFilter(address);
		expect(filter).toEqual({
			kinds: [VOTE_KIND],
			'#a': [address]
		});
	});

	it('uses kind 1018', () => {
		const filter = votesForBountyFilter('test');
		expect(filter.kinds).toEqual([1018]);
	});
});

describe('payoutForBountyFilter', () => {
	it('returns a filter for payout events referencing a bounty', () => {
		const address = '37300:abc123:my-bounty';
		const filter = payoutForBountyFilter(address);
		expect(filter).toEqual({
			kinds: [PAYOUT_KIND],
			'#a': [address]
		});
	});

	it('uses kind 73004', () => {
		const filter = payoutForBountyFilter('test');
		expect(filter.kinds).toEqual([73004]);
	});
});

describe('bountyByAuthorFilter', () => {
	it('returns a filter for tasks by a specific author', () => {
		const pubkey = 'a'.repeat(64);
		const filter = bountyByAuthorFilter(pubkey);
		expect(filter).toEqual({
			kinds: [BOUNTY_KIND],
			authors: [pubkey]
		});
	});

	it('uses kind 37300', () => {
		const filter = bountyByAuthorFilter('test');
		expect(filter.kinds).toEqual([37300]);
	});
});

describe('searchBountiesFilter', () => {
	it('returns a filter with search query and default limit', () => {
		const filter = searchBountiesFilter('rust developer');
		expect(filter).toEqual({
			kinds: [BOUNTY_KIND],
			search: 'rust developer',
			limit: 20
		});
	});

	it('accepts a custom limit', () => {
		const filter = searchBountiesFilter('design', 10);
		expect(filter).toEqual({
			kinds: [BOUNTY_KIND],
			search: 'design',
			limit: 10
		});
	});

	it('uses kind 37300', () => {
		const filter = searchBountiesFilter('test');
		expect(filter.kinds).toEqual([37300]);
	});
});
