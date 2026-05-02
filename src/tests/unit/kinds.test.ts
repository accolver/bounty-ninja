import { describe, it, expect } from 'vitest';
import { BOUNTY_KIND, SOLUTION_KIND, PLEDGE_KIND, VOTE_KIND, PAYOUT_KIND } from '$lib/bounty/kinds';

describe('bounty event kinds', () => {
	it('BOUNTY_KIND is 37300', () => {
		expect(BOUNTY_KIND).toBe(37300);
	});

	it('SOLUTION_KIND is 7301', () => {
		expect(SOLUTION_KIND).toBe(7301);
	});

	it('PLEDGE_KIND is 7302', () => {
		expect(PLEDGE_KIND).toBe(7302);
	});

	it('VOTE_KIND is 1018', () => {
		expect(VOTE_KIND).toBe(1018);
	});

	it('PAYOUT_KIND is 7304', () => {
		expect(PAYOUT_KIND).toBe(7304);
	});
});
