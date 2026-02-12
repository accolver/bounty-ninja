import { describe, it, expect } from 'vitest';
import {
	TASK_KIND,
	SOLUTION_KIND,
	PLEDGE_KIND,
	VOTE_KIND,
	PAYOUT_KIND
} from '$lib/task/kinds';

describe('task event kinds', () => {
	it('TASK_KIND is 37300', () => {
		expect(TASK_KIND).toBe(37300);
	});

	it('SOLUTION_KIND is 73001', () => {
		expect(SOLUTION_KIND).toBe(73001);
	});

	it('PLEDGE_KIND is 73002', () => {
		expect(PLEDGE_KIND).toBe(73002);
	});

	it('VOTE_KIND is 1018', () => {
		expect(VOTE_KIND).toBe(1018);
	});

	it('PAYOUT_KIND is 73004', () => {
		expect(PAYOUT_KIND).toBe(73004);
	});
});
