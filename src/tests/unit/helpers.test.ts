import { describe, it, expect } from 'vitest';
import type { NostrEvent } from 'nostr-tools';
import {
	parseTaskSummary,
	parsePledge,
	parseSolution,
	parseVote,
	parsePayout,
	parseTaskDetail
} from '$lib/task/helpers';

// Valid hex constants for reuse across tests
const PUBKEY_A = 'a'.repeat(64);
const PUBKEY_B = 'b'.repeat(64);
const PUBKEY_C = 'c'.repeat(64);
const PUBKEY_D = 'd'.repeat(64);
const EVENT_ID_1 = '1'.repeat(64);
const EVENT_ID_2 = '2'.repeat(64);
const EVENT_ID_3 = '3'.repeat(64);
const EVENT_ID_4 = '4'.repeat(64);
const EVENT_ID_5 = '5'.repeat(64);
const SIG = 'c'.repeat(128);
const VALID_TASK_ADDR = `37300:${PUBKEY_B}:task-123`;
const VALID_MINT_URL = 'https://mint.example.com';

function mockEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
	return {
		id: PUBKEY_A,
		pubkey: PUBKEY_B,
		created_at: Math.floor(Date.now() / 1000),
		kind: 1,
		tags: [],
		content: '',
		sig: SIG,
		...overrides
	};
}

describe('parseTaskSummary', () => {
	it('parses a task event with all tags', () => {
		const event = mockEvent({
			kind: 37300,
			tags: [
				['d', 'task-123'],
				['title', 'Fix the login bug'],
				['reward', '50000'],
				['t', 'bug'],
				['t', 'frontend'],
				['expiration', '1800000000']
			],
			content: 'Detailed description of the bug'
		});

		const summary = parseTaskSummary(event)!;

		expect(summary.id).toBe(PUBKEY_A);
		expect(summary.dTag).toBe('task-123');
		expect(summary.pubkey).toBe(PUBKEY_B);
		expect(summary.title).toBe('Fix the login bug');
		expect(summary.rewardAmount).toBe(50000);
		expect(summary.tags).toEqual(['bug', 'frontend']);
		expect(summary.deadline).toBe(1800000000);
		expect(summary.status).toBe('draft');
		expect(summary.totalPledged).toBe(0);
		expect(summary.solutionCount).toBe(0);
	});

	it('falls back to subject tag when title tag is missing', () => {
		const event = mockEvent({
			kind: 37300,
			tags: [
				['d', 'task-456'],
				['subject', 'Implement dark mode'],
				['reward', '10000']
			]
		});

		const summary = parseTaskSummary(event)!;
		expect(summary.title).toBe('Implement dark mode');
	});

	it('returns null when title and subject are missing (validation failure)', () => {
		const event = mockEvent({
			kind: 37300,
			tags: [
				['d', 'task-789'],
				['reward', '5000']
			],
			content: 'Build a REST API\nWith proper error handling\nAnd tests'
		});

		const result = parseTaskSummary(event);
		expect(result).toBeNull();
	});

	it('returns null when title/subject missing even with long content (validation failure)', () => {
		const longLine = 'A'.repeat(100);
		const event = mockEvent({
			kind: 37300,
			tags: [
				['d', 'task-long'],
				['reward', '5000']
			],
			content: longLine
		});

		const result = parseTaskSummary(event);
		expect(result).toBeNull();
	});

	it('returns null when required tags are missing (validation failure)', () => {
		const event = mockEvent({
			kind: 37300,
			tags: [['d', 'task-empty']],
			content: ''
		});

		const result = parseTaskSummary(event);
		expect(result).toBeNull();
	});

	it('returns null when all tags are missing (validation failure)', () => {
		const event = mockEvent({
			kind: 37300,
			tags: [],
			content: ''
		});

		const result = parseTaskSummary(event);
		expect(result).toBeNull();
	});

	it('returns null for malformed reward tag (validation failure)', () => {
		const event = mockEvent({
			kind: 37300,
			tags: [
				['d', 'task-bad'],
				['title', 'Test task'],
				['reward', 'not-a-number']
			]
		});

		const result = parseTaskSummary(event);
		expect(result).toBeNull();
	});

	it('handles malformed expiration tag', () => {
		const event = mockEvent({
			kind: 37300,
			tags: [
				['d', 'task-bad-exp'],
				['title', 'Test task'],
				['reward', '5000'],
				['expiration', 'invalid']
			]
		});

		const summary = parseTaskSummary(event)!;
		expect(summary.deadline).toBeNull();
	});
});

describe('parsePledge', () => {
	it('parses a pledge event with all tags', () => {
		const event = mockEvent({
			kind: 73002,
			tags: [
				['a', VALID_TASK_ADDR],
				['amount', '25000'],
				['cashu', 'cashuAtoken123'],
				['mint', VALID_MINT_URL]
			],
			content: 'Happy to fund this!'
		});

		const pledge = parsePledge(event)!;

		expect(pledge.id).toBe(PUBKEY_A);
		expect(pledge.pubkey).toBe(PUBKEY_B);
		expect(pledge.taskAddress).toBe(VALID_TASK_ADDR);
		expect(pledge.amount).toBe(25000);
		expect(pledge.cashuToken).toBe('cashuAtoken123');
		expect(pledge.mintUrl).toBe(VALID_MINT_URL);
		expect(pledge.message).toBe('Happy to fund this!');
	});

	it('returns null when tags are missing (validation failure)', () => {
		const event = mockEvent({ kind: 73002, tags: [] });

		const result = parsePledge(event);
		expect(result).toBeNull();
	});

	it('returns null for malformed amount (validation failure)', () => {
		const event = mockEvent({
			kind: 73002,
			tags: [
				['a', VALID_TASK_ADDR],
				['amount', 'xyz'],
				['cashu', 'token123'],
				['mint', VALID_MINT_URL]
			]
		});

		const result = parsePledge(event);
		expect(result).toBeNull();
	});
});

describe('parseSolution', () => {
	it('parses a solution event with all tags', () => {
		const event = mockEvent({
			kind: 73001,
			tags: [
				['a', VALID_TASK_ADDR],
				['cashu', 'cashuBtoken456'],
				['amount', '100'],
				['r', 'https://github.com/user/repo/pull/1']
			],
			content: 'Here is my solution with full implementation'
		});

		const solution = parseSolution(event)!;

		expect(solution.taskAddress).toBe(VALID_TASK_ADDR);
		expect(solution.description).toBe('Here is my solution with full implementation');
		expect(solution.antiSpamToken).toBe('cashuBtoken456');
		expect(solution.antiSpamAmount).toBe(100);
		expect(solution.deliverableUrl).toBe('https://github.com/user/repo/pull/1');
		expect(solution.voteWeight).toBe(0);
	});

	it('returns null when content is empty (validation failure)', () => {
		const event = mockEvent({
			kind: 73001,
			tags: [
				['a', VALID_TASK_ADDR],
				['fee', 'feeToken789']
			]
		});

		const result = parseSolution(event);
		expect(result).toBeNull();
	});

	it('returns null when tags are missing (validation failure)', () => {
		const event = mockEvent({ kind: 73001, tags: [] });

		const result = parseSolution(event);
		expect(result).toBeNull();
	});
});

describe('parseVote', () => {
	it('parses an approve vote', () => {
		const event = mockEvent({
			kind: 1018,
			tags: [
				['a', VALID_TASK_ADDR],
				['e', EVENT_ID_1],
				['vote', 'approve']
			]
		});

		const vote = parseVote(event)!;

		expect(vote.taskAddress).toBe(VALID_TASK_ADDR);
		expect(vote.solutionId).toBe(EVENT_ID_1);
		expect(vote.choice).toBe('approve');
	});

	it('parses a reject vote', () => {
		const event = mockEvent({
			kind: 1018,
			tags: [
				['a', VALID_TASK_ADDR],
				['e', EVENT_ID_1],
				['vote', 'reject']
			]
		});

		const vote = parseVote(event)!;
		expect(vote.choice).toBe('reject');
	});

	it('returns null for unknown vote value (validation failure)', () => {
		const event = mockEvent({
			kind: 1018,
			tags: [
				['a', VALID_TASK_ADDR],
				['e', EVENT_ID_1],
				['vote', 'maybe']
			]
		});

		const result = parseVote(event);
		expect(result).toBeNull();
	});

	it('returns null when vote tag is missing (validation failure)', () => {
		const event = mockEvent({
			kind: 1018,
			tags: [
				['a', VALID_TASK_ADDR],
				['e', EVENT_ID_1]
			]
		});

		const result = parseVote(event);
		expect(result).toBeNull();
	});

	it('returns null when all tags are missing (validation failure)', () => {
		const event = mockEvent({ kind: 1018, tags: [] });

		const result = parseVote(event);
		expect(result).toBeNull();
	});
});

describe('parsePayout', () => {
	it('parses a payout event with all tags', () => {
		const event = mockEvent({
			kind: 73004,
			tags: [
				['a', VALID_TASK_ADDR],
				['e', EVENT_ID_1],
				['p', PUBKEY_C],
				['amount', '75000'],
				['cashu', 'cashuCpayoutToken']
			]
		});

		const payout = parsePayout(event)!;

		expect(payout.taskAddress).toBe(VALID_TASK_ADDR);
		expect(payout.solutionId).toBe(EVENT_ID_1);
		expect(payout.solverPubkey).toBe(PUBKEY_C);
		expect(payout.amount).toBe(75000);
		expect(payout.cashuToken).toBe('cashuCpayoutToken');
	});

	it('returns null when tags are missing (validation failure)', () => {
		const event = mockEvent({ kind: 73004, tags: [] });

		const result = parsePayout(event);
		expect(result).toBeNull();
	});
});

describe('parseTaskDetail', () => {
	it('composes all parsers into a full TaskDetail', () => {
		const taskAddr = `37300:${PUBKEY_B}:task-full`;

		const taskEvent = mockEvent({
			kind: 37300,
			tags: [
				['d', 'task-full'],
				['title', 'Full task test'],
				['reward', '100000'],
				['t', 'test'],
				['currency', 'sat'],
				['mint', VALID_MINT_URL]
			],
			content: 'A full task description'
		});

		const pledgeEvent = mockEvent({
			id: EVENT_ID_1,
			pubkey: PUBKEY_C,
			kind: 73002,
			tags: [
				['a', taskAddr],
				['amount', '50000'],
				['cashu', 'token1'],
				['mint', VALID_MINT_URL]
			],
			content: 'Funding this'
		});

		const solutionEvent = mockEvent({
			id: EVENT_ID_2,
			pubkey: PUBKEY_D,
			kind: 73001,
			tags: [
				['a', taskAddr],
				['cashu', 'feeToken'],
				['r', 'https://github.com/pr/1']
			],
			content: 'My solution'
		});

		const voteEvent = mockEvent({
			id: EVENT_ID_3,
			pubkey: PUBKEY_C,
			kind: 1018,
			tags: [
				['a', taskAddr],
				['e', EVENT_ID_2],
				['vote', 'approve']
			]
		});

		const detail = parseTaskDetail(
			taskEvent,
			[pledgeEvent],
			[solutionEvent],
			[voteEvent],
			[],
			[]
		)!;

		expect(detail.title).toBe('Full task test');
		expect(detail.rewardAmount).toBe(100000);
		expect(detail.totalPledged).toBe(50000);
		expect(detail.solutionCount).toBe(1);
		expect(detail.pledges).toHaveLength(1);
		expect(detail.solutions).toHaveLength(1);
		expect(detail.payout).toBeNull();
		expect(detail.status).toBe('in_review');
		expect(detail.mintUrl).toBe(VALID_MINT_URL);
		expect(detail.description).toBe('A full task description');
		expect(detail.creatorProfile).toBeNull();

		// Votes grouped by solution
		const solutionVotes = detail.votesBySolution.get(EVENT_ID_2);
		expect(solutionVotes).toHaveLength(1);
		expect(solutionVotes![0].choice).toBe('approve');
	});

	it('handles empty related events', () => {
		const taskEvent = mockEvent({
			kind: 37300,
			tags: [
				['d', 'task-empty'],
				['title', 'Empty task'],
				['reward', '5000']
			],
			content: ''
		});

		const detail = parseTaskDetail(taskEvent, [], [], [], [], [])!;

		expect(detail.totalPledged).toBe(0);
		expect(detail.solutionCount).toBe(0);
		expect(detail.pledges).toEqual([]);
		expect(detail.solutions).toEqual([]);
		expect(detail.votesBySolution.size).toBe(0);
		expect(detail.payout).toBeNull();
		expect(detail.status).toBe('draft');
	});

	it('sets status to completed when payouts exist', () => {
		const taskAddr = `37300:${PUBKEY_B}:task-paid`;

		const taskEvent = mockEvent({
			kind: 37300,
			tags: [
				['d', 'task-paid'],
				['title', 'Paid task'],
				['reward', '100000']
			]
		});

		const payoutEvent = mockEvent({
			kind: 73004,
			tags: [
				['a', taskAddr],
				['e', EVENT_ID_1],
				['p', PUBKEY_C],
				['amount', '100000'],
				['cashu', 'payoutToken']
			]
		});

		const detail = parseTaskDetail(taskEvent, [], [], [], [payoutEvent], [])!;

		expect(detail.status).toBe('completed');
		expect(detail.payout).not.toBeNull();
		expect(detail.payout!.amount).toBe(100000);
	});

	it('sets status to cancelled when delete events exist', () => {
		const taskEvent = mockEvent({
			kind: 37300,
			tags: [
				['d', 'task-cancelled'],
				['title', 'Cancelled task'],
				['reward', '5000']
			]
		});

		const deleteEvent = mockEvent({ kind: 5 });

		const detail = parseTaskDetail(taskEvent, [], [], [], [], [deleteEvent])!;

		expect(detail.status).toBe('cancelled');
	});
});
