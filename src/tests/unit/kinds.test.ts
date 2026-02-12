import { describe, it, expect } from 'vitest';
import {
	BOUNTY_KIND,
	SOLUTION_KIND,
	PLEDGE_KIND,
	VOTE_KIND,
	PAYOUT_KIND
} from '$lib/bounty/kinds';

describe('bounty event kinds', () => {
	it('BOUNTY_KIND is 37300', () => {
		expect(BOUNTY_KIND).toBe(37300);
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
