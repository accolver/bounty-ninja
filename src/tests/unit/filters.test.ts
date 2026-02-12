import { describe, it, expect } from 'vitest';
import {
	taskListFilter,
	pledgesForTaskFilter,
	solutionsForTaskFilter,
	votesForTaskFilter,
	payoutForTaskFilter,
	taskByAuthorFilter,
	searchTasksFilter
} from '$lib/task/filters';
import {
	TASK_KIND,
	PLEDGE_KIND,
	SOLUTION_KIND,
	VOTE_KIND,
	PAYOUT_KIND
} from '$lib/task/kinds';

describe('taskListFilter', () => {
	it('returns a filter for task events with default limit', () => {
		const filter = taskListFilter();
		expect(filter).toEqual({
			kinds: [TASK_KIND],
			limit: 50
		});
	});

	it('accepts a custom limit', () => {
		const filter = taskListFilter(100);
		expect(filter).toEqual({
			kinds: [TASK_KIND],
			limit: 100
		});
	});

	it('uses kind 37300', () => {
		const filter = taskListFilter();
		expect(filter.kinds).toEqual([37300]);
	});
});

describe('pledgesForTaskFilter', () => {
	it('returns a filter for pledge events referencing a task', () => {
		const address = '37300:abc123:my-task';
		const filter = pledgesForTaskFilter(address);
		expect(filter).toEqual({
			kinds: [PLEDGE_KIND],
			'#a': [address]
		});
	});

	it('uses kind 73002', () => {
		const filter = pledgesForTaskFilter('test');
		expect(filter.kinds).toEqual([73002]);
	});
});

describe('solutionsForTaskFilter', () => {
	it('returns a filter for solution events referencing a task', () => {
		const address = '37300:abc123:my-task';
		const filter = solutionsForTaskFilter(address);
		expect(filter).toEqual({
			kinds: [SOLUTION_KIND],
			'#a': [address]
		});
	});

	it('uses kind 73001', () => {
		const filter = solutionsForTaskFilter('test');
		expect(filter.kinds).toEqual([73001]);
	});
});

describe('votesForTaskFilter', () => {
	it('returns a filter for vote events referencing a task', () => {
		const address = '37300:abc123:my-task';
		const filter = votesForTaskFilter(address);
		expect(filter).toEqual({
			kinds: [VOTE_KIND],
			'#a': [address]
		});
	});

	it('uses kind 1018', () => {
		const filter = votesForTaskFilter('test');
		expect(filter.kinds).toEqual([1018]);
	});
});

describe('payoutForTaskFilter', () => {
	it('returns a filter for payout events referencing a task', () => {
		const address = '37300:abc123:my-task';
		const filter = payoutForTaskFilter(address);
		expect(filter).toEqual({
			kinds: [PAYOUT_KIND],
			'#a': [address]
		});
	});

	it('uses kind 73004', () => {
		const filter = payoutForTaskFilter('test');
		expect(filter.kinds).toEqual([73004]);
	});
});

describe('taskByAuthorFilter', () => {
	it('returns a filter for tasks by a specific author', () => {
		const pubkey = 'a'.repeat(64);
		const filter = taskByAuthorFilter(pubkey);
		expect(filter).toEqual({
			kinds: [TASK_KIND],
			authors: [pubkey]
		});
	});

	it('uses kind 37300', () => {
		const filter = taskByAuthorFilter('test');
		expect(filter.kinds).toEqual([37300]);
	});
});

describe('searchTasksFilter', () => {
	it('returns a filter with search query and default limit', () => {
		const filter = searchTasksFilter('rust developer');
		expect(filter).toEqual({
			kinds: [TASK_KIND],
			search: 'rust developer',
			limit: 20
		});
	});

	it('accepts a custom limit', () => {
		const filter = searchTasksFilter('design', 10);
		expect(filter).toEqual({
			kinds: [TASK_KIND],
			search: 'design',
			limit: 10
		});
	});

	it('uses kind 37300', () => {
		const filter = searchTasksFilter('test');
		expect(filter.kinds).toEqual([37300]);
	});
});
