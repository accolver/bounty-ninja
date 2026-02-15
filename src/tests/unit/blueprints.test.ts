import { describe, it, expect } from 'vitest';
import {
	bountyBlueprint,
	pledgeBlueprint,
	solutionBlueprint,
	voteBlueprint,
	payoutBlueprint,
	type BountyBlueprintParams,
	type PledgeBlueprintParams,
	type SolutionBlueprintParams,
	type VoteBlueprintParams,
	type PayoutBlueprintParams
} from '$lib/bounty/blueprints';
import { BOUNTY_KIND, PLEDGE_KIND, SOLUTION_KIND, VOTE_KIND, PAYOUT_KIND } from '$lib/bounty/kinds';
import { CLIENT_TAG } from '$lib/utils/constants';

const PUBKEY = 'a'.repeat(64);
const OTHER_PUBKEY = 'b'.repeat(64);
const BOUNTY_ADDRESS = `${BOUNTY_KIND}:${PUBKEY}:test-bounty-123`;
const EVENT_ID = 'e'.repeat(64);

/** Helper to find a tag value in an event template */
function findTag(tags: string[][], name: string): string | undefined {
	return tags.find((t) => t[0] === name)?.[1];
}

/** Helper to find all values for a tag */
function findAllTags(tags: string[][], name: string): string[] {
	return tags.filter((t) => t[0] === name).map((t) => t[1]);
}

/** Helper to check that the client tag exists */
function expectClientTag(tags: string[][]) {
	expect(findTag(tags, 'client')).toBe(CLIENT_TAG);
}

// ── bountyBlueprint (Kind 37300) ────────────────────────────────────────────

describe('bountyBlueprint', () => {
	const baseParams: BountyBlueprintParams = {
		dTag: 'test-bounty-abc123',
		title: 'Fix the login bug',
		description: 'Detailed description of the bug and expected behavior.',
		rewardAmount: 50000
	};

	it('produces correct kind', () => {
		const template = bountyBlueprint(baseParams);
		expect(template.kind).toBe(BOUNTY_KIND);
	});

	it('includes required tags: d, title, reward, client', () => {
		const template = bountyBlueprint(baseParams);
		expect(findTag(template.tags, 'd')).toBe('test-bounty-abc123');
		expect(findTag(template.tags, 'title')).toBe('Fix the login bug');
		expect(findTag(template.tags, 'reward')).toBe('50000');
		expectClientTag(template.tags);
	});

	it('sets content to description', () => {
		const template = bountyBlueprint(baseParams);
		expect(template.content).toBe('Detailed description of the bug and expected behavior.');
	});

	it('sets created_at to current timestamp', () => {
		const before = Math.floor(Date.now() / 1000);
		const template = bountyBlueprint(baseParams);
		const after = Math.floor(Date.now() / 1000);
		expect(template.created_at).toBeGreaterThanOrEqual(before);
		expect(template.created_at).toBeLessThanOrEqual(after);
	});

	it('includes topic tags when provided', () => {
		const template = bountyBlueprint({ ...baseParams, tags: ['bug', 'frontend', 'auth'] });
		const tTags = findAllTags(template.tags, 't');
		expect(tTags).toEqual(['bug', 'frontend', 'auth']);
	});

	it('includes deadline as expiration tag', () => {
		const deadline = 1800000000;
		const template = bountyBlueprint({ ...baseParams, deadline });
		expect(findTag(template.tags, 'expiration')).toBe('1800000000');
	});

	it('includes mint URL when provided', () => {
		const template = bountyBlueprint({ ...baseParams, mintUrl: 'https://mint.example.com' });
		expect(findTag(template.tags, 'mint')).toBe('https://mint.example.com');
	});

	it('includes submission fee when provided', () => {
		const template = bountyBlueprint({ ...baseParams, submissionFee: 25 });
		expect(findTag(template.tags, 'fee')).toBe('25');
	});

	it('omits optional tags when not provided', () => {
		const template = bountyBlueprint(baseParams);
		const tagNames = template.tags.map((t) => t[0]);
		expect(tagNames).not.toContain('t');
		expect(tagNames).not.toContain('expiration');
		expect(tagNames).not.toContain('mint');
		expect(tagNames).not.toContain('fee');
	});
});

// ── pledgeBlueprint (Kind 73002) ────────────────────────────────────────────

describe('pledgeBlueprint', () => {
	const baseParams: PledgeBlueprintParams = {
		bountyAddress: BOUNTY_ADDRESS,
		creatorPubkey: PUBKEY,
		amount: 10000,
		cashuToken: 'cashuA_test_token_abc',
		mintUrl: 'https://mint.example.com'
	};

	it('produces correct kind', () => {
		const template = pledgeBlueprint(baseParams);
		expect(template.kind).toBe(PLEDGE_KIND);
	});

	it('includes all required tags: a, p, amount, cashu, mint, client', () => {
		const template = pledgeBlueprint(baseParams);
		expect(findTag(template.tags, 'a')).toBe(BOUNTY_ADDRESS);
		expect(findTag(template.tags, 'p')).toBe(PUBKEY);
		expect(findTag(template.tags, 'amount')).toBe('10000');
		expect(findTag(template.tags, 'cashu')).toBe('cashuA_test_token_abc');
		expect(findTag(template.tags, 'mint')).toBe('https://mint.example.com');
		expectClientTag(template.tags);
	});

	it('sets content to empty string when no message', () => {
		const template = pledgeBlueprint(baseParams);
		expect(template.content).toBe('');
	});

	it('sets content to message when provided', () => {
		const template = pledgeBlueprint({ ...baseParams, message: 'Great bounty!' });
		expect(template.content).toBe('Great bounty!');
	});

	it('sets created_at to current timestamp', () => {
		const before = Math.floor(Date.now() / 1000);
		const template = pledgeBlueprint(baseParams);
		const after = Math.floor(Date.now() / 1000);
		expect(template.created_at).toBeGreaterThanOrEqual(before);
		expect(template.created_at).toBeLessThanOrEqual(after);
	});
});

// ── solutionBlueprint (Kind 73001) ──────────────────────────────────────────

describe('solutionBlueprint', () => {
	const baseParams: SolutionBlueprintParams = {
		bountyAddress: BOUNTY_ADDRESS,
		creatorPubkey: PUBKEY,
		description: 'Here is my solution with full implementation.'
	};

	it('produces correct kind', () => {
		const template = solutionBlueprint(baseParams);
		expect(template.kind).toBe(SOLUTION_KIND);
	});

	it('includes required tags: a, p, client', () => {
		const template = solutionBlueprint(baseParams);
		expect(findTag(template.tags, 'a')).toBe(BOUNTY_ADDRESS);
		expect(findTag(template.tags, 'p')).toBe(PUBKEY);
		expectClientTag(template.tags);
	});

	it('sets content to description', () => {
		const template = solutionBlueprint(baseParams);
		expect(template.content).toBe('Here is my solution with full implementation.');
	});

	it('includes anti-spam cashu tokens when provided', () => {
		const template = solutionBlueprint({
			...baseParams,
			antiSpamTokens: ['cashuA_fee_10_12345']
		});
		expect(findTag(template.tags, 'cashu')).toBe('cashuA_fee_10_12345');
	});

	it('includes multiple anti-spam cashu tokens when provided', () => {
		const template = solutionBlueprint({
			...baseParams,
			antiSpamTokens: ['cashuA_token1', 'cashuA_token2']
		});
		const cashuTags = template.tags.filter((t) => t[0] === 'cashu');
		expect(cashuTags).toHaveLength(2);
		expect(cashuTags[0][1]).toBe('cashuA_token1');
		expect(cashuTags[1][1]).toBe('cashuA_token2');
	});

	it('omits cashu tag when no anti-spam token', () => {
		const template = solutionBlueprint(baseParams);
		const tagNames = template.tags.map((t) => t[0]);
		expect(tagNames).not.toContain('cashu');
	});

	it('includes deliverable URL as r tag when provided', () => {
		const template = solutionBlueprint({
			...baseParams,
			deliverableUrl: 'https://github.com/user/repo'
		});
		expect(findTag(template.tags, 'r')).toBe('https://github.com/user/repo');
	});

	it('omits r tag when no deliverable URL', () => {
		const template = solutionBlueprint(baseParams);
		const tagNames = template.tags.map((t) => t[0]);
		expect(tagNames).not.toContain('r');
	});
});

// ── voteBlueprint (Kind 1018) ───────────────────────────────────────────────

describe('voteBlueprint', () => {
	const baseParams: VoteBlueprintParams = {
		bountyAddress: BOUNTY_ADDRESS,
		solutionId: EVENT_ID,
		solutionAuthor: OTHER_PUBKEY,
		choice: 'approve'
	};

	it('produces correct kind', () => {
		const template = voteBlueprint(baseParams);
		expect(template.kind).toBe(VOTE_KIND);
	});

	it('includes required tags: a, e, p, vote, client', () => {
		const template = voteBlueprint(baseParams);
		expect(findTag(template.tags, 'a')).toBe(BOUNTY_ADDRESS);
		expect(findTag(template.tags, 'e')).toBe(EVENT_ID);
		expect(findTag(template.tags, 'p')).toBe(OTHER_PUBKEY);
		expect(findTag(template.tags, 'vote')).toBe('approve');
		expectClientTag(template.tags);
	});

	it('sets content to empty string', () => {
		const template = voteBlueprint(baseParams);
		expect(template.content).toBe('');
	});

	it('creates reject vote correctly', () => {
		const template = voteBlueprint({ ...baseParams, choice: 'reject' });
		expect(findTag(template.tags, 'vote')).toBe('reject');
	});
});

// ── payoutBlueprint (Kind 73004) ────────────────────────────────────────────

describe('payoutBlueprint', () => {
	const baseParams: PayoutBlueprintParams = {
		bountyAddress: BOUNTY_ADDRESS,
		solutionId: EVENT_ID,
		solverPubkey: OTHER_PUBKEY,
		amount: 45000,
		cashuToken: 'cashuA_payout_token_xyz'
	};

	it('produces correct kind', () => {
		const template = payoutBlueprint(baseParams);
		expect(template.kind).toBe(PAYOUT_KIND);
	});

	it('includes all required tags: a, e, p, amount, cashu, client', () => {
		const template = payoutBlueprint(baseParams);
		expect(findTag(template.tags, 'a')).toBe(BOUNTY_ADDRESS);
		expect(findTag(template.tags, 'e')).toBe(EVENT_ID);
		expect(findTag(template.tags, 'p')).toBe(OTHER_PUBKEY);
		expect(findTag(template.tags, 'amount')).toBe('45000');
		expect(findTag(template.tags, 'cashu')).toBe('cashuA_payout_token_xyz');
		expectClientTag(template.tags);
	});

	it('sets content to empty string', () => {
		const template = payoutBlueprint(baseParams);
		expect(template.content).toBe('');
	});

	it('sets created_at to current timestamp', () => {
		const before = Math.floor(Date.now() / 1000);
		const template = payoutBlueprint(baseParams);
		const after = Math.floor(Date.now() / 1000);
		expect(template.created_at).toBeGreaterThanOrEqual(before);
		expect(template.created_at).toBeLessThanOrEqual(after);
	});
});

// ── Cross-cutting: client tag on all events ─────────────────────────────────

describe('all blueprints include client tag', () => {
	it('bountyBlueprint has client tag', () => {
		const t = bountyBlueprint({
			dTag: 'x',
			title: 'x',
			description: 'x',
			rewardAmount: 1
		});
		expectClientTag(t.tags);
	});

	it('pledgeBlueprint has client tag', () => {
		const t = pledgeBlueprint({
			bountyAddress: 'x',
			creatorPubkey: 'x',
			amount: 1,
			cashuToken: 'x',
			mintUrl: 'x'
		});
		expectClientTag(t.tags);
	});

	it('solutionBlueprint has client tag', () => {
		const t = solutionBlueprint({
			bountyAddress: 'x',
			creatorPubkey: 'x',
			description: 'x'
		});
		expectClientTag(t.tags);
	});

	it('voteBlueprint has client tag', () => {
		const t = voteBlueprint({
			bountyAddress: 'x',
			solutionId: 'x',
			solutionAuthor: 'x',
			choice: 'approve'
		});
		expectClientTag(t.tags);
	});

	it('payoutBlueprint has client tag', () => {
		const t = payoutBlueprint({
			bountyAddress: 'x',
			solutionId: 'x',
			solverPubkey: 'x',
			amount: 1,
			cashuToken: 'x'
		});
		expectClientTag(t.tags);
	});
});
