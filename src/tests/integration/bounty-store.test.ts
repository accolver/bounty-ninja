/**
 * Integration test: EventStore → Task helpers reactivity.
 *
 * Verifies that adding events to EventStore produces correct domain objects
 * through the parsing pipeline. Tests the full chain:
 * EventStore.add() → timeline Observable → parse helpers → domain types
 *
 * Uses the real EventStore (from applesauce-core) with no relay connections.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { firstValueFrom, take, skip } from 'rxjs';
import { EventStore } from 'applesauce-core';
import type { NostrEvent } from 'nostr-tools';
import { TASK_KIND, PLEDGE_KIND, SOLUTION_KIND, VOTE_KIND, PAYOUT_KIND } from '$lib/task/kinds';
import {
	parseTaskSummary,
	parsePledge,
	parseSolution,
	parseVote,
	parsePayout,
	parseTaskDetail
} from '$lib/task/helpers';

const PUBKEY_A = 'a'.repeat(64);
const PUBKEY_B = 'b'.repeat(64);
const SIG = 'c'.repeat(128);

function mockEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
	return {
		id: crypto.randomUUID().replace(/-/g, '').padEnd(64, '0').slice(0, 64),
		pubkey: PUBKEY_A,
		created_at: Math.floor(Date.now() / 1000),
		kind: 1,
		tags: [],
		content: '',
		sig: SIG,
		...overrides
	};
}

function makeTaskEvent(dTag: string, title: string, reward: number): NostrEvent {
	return mockEvent({
		kind: TASK_KIND,
		tags: [
			['d', dTag],
			['title', title],
			['reward', String(reward)],
			['t', 'test'],
			['client', 'tasks.fyi']
		],
		content: 'Task description'
	});
}

function makePledgeEvent(
	taskAddress: string,
	amount: number,
	pledgerPubkey: string = PUBKEY_B
): NostrEvent {
	return mockEvent({
		kind: PLEDGE_KIND,
		pubkey: pledgerPubkey,
		tags: [
			['a', taskAddress],
			['p', PUBKEY_A],
			['amount', String(amount)],
			['cashu', 'cashuA_test_token'],
			['mint', 'https://mint.test.com'],
			['client', 'tasks.fyi']
		],
		content: ''
	});
}

function makeSolutionEvent(taskAddress: string, solverPubkey: string = PUBKEY_B): NostrEvent {
	return mockEvent({
		kind: SOLUTION_KIND,
		pubkey: solverPubkey,
		tags: [
			['a', taskAddress],
			['p', PUBKEY_A],
			['client', 'tasks.fyi']
		],
		content: 'Here is my solution.'
	});
}

function makeVoteEvent(
	taskAddress: string,
	solutionId: string,
	choice: 'approve' | 'reject',
	voterPubkey: string = PUBKEY_B
): NostrEvent {
	return mockEvent({
		kind: VOTE_KIND,
		pubkey: voterPubkey,
		tags: [
			['a', taskAddress],
			['e', solutionId],
			['p', PUBKEY_B],
			['vote', choice],
			['client', 'tasks.fyi']
		],
		content: ''
	});
}

function makePayoutEvent(taskAddress: string, solutionId: string): NostrEvent {
	return mockEvent({
		kind: PAYOUT_KIND,
		pubkey: PUBKEY_A,
		tags: [
			['a', taskAddress],
			['e', solutionId],
			['p', PUBKEY_B],
			['amount', '10000'],
			['cashu', 'cashuA_payout_token'],
			['client', 'tasks.fyi']
		],
		content: ''
	});
}

// ── EventStore → Timeline reactivity ────────────────────────────────────────

describe('EventStore timeline reactivity', () => {
	let store: EventStore;

	beforeEach(() => {
		store = new EventStore();
		// Disable signature verification for test events with mock signatures
		store.verifyEvent = () => true;
	});

	it('emits task events via timeline observable', async () => {
		const task = makeTaskEvent('test-1', 'Fix bug', 50000);

		// Subscribe before adding to catch the emission
		const eventsPromise = firstValueFrom(
			store.timeline({ kinds: [TASK_KIND] }).pipe(skip(1), take(1))
		);

		store.add(task);

		const events = await eventsPromise;
		expect(events).toHaveLength(1);
		expect(events[0].id).toBe(task.id);
	});

	it('emits pledge events for a specific task', async () => {
		const taskAddress = `${TASK_KIND}:${PUBKEY_A}:test-1`;
		const pledge = makePledgeEvent(taskAddress, 5000);

		const eventsPromise = firstValueFrom(
			store.timeline({ kinds: [PLEDGE_KIND], '#a': [taskAddress] }).pipe(skip(1), take(1))
		);

		store.add(pledge);

		const events = await eventsPromise;
		expect(events).toHaveLength(1);
		expect(events[0].kind).toBe(PLEDGE_KIND);
	});

	it('emits multiple events as they are added', async () => {
		const taskAddress = `${TASK_KIND}:${PUBKEY_A}:test-1`;
		const pledge1 = makePledgeEvent(taskAddress, 1000);
		const pledge2 = makePledgeEvent(taskAddress, 2000);

		// Wait for second emission (after both are added)
		const eventsPromise = firstValueFrom(
			store.timeline({ kinds: [PLEDGE_KIND], '#a': [taskAddress] }).pipe(skip(2), take(1))
		);

		store.add(pledge1);
		store.add(pledge2);

		const events = await eventsPromise;
		expect(events).toHaveLength(2);
	});
});

// ── Parsing pipeline ────────────────────────────────────────────────────────

describe('Event parsing pipeline', () => {
	it('parseTaskSummary extracts correct fields from task event', () => {
		const event = makeTaskEvent('my-task', 'Build a widget', 100000);
		const summary = parseTaskSummary(event)!;

		expect(summary.dTag).toBe('my-task');
		expect(summary.title).toBe('Build a widget');
		expect(summary.rewardAmount).toBe(100000);
		expect(summary.tags).toContain('test');
		expect(summary.pubkey).toBe(PUBKEY_A);
	});

	it('parsePledge extracts amount and token from pledge event', () => {
		const taskAddress = `${TASK_KIND}:${PUBKEY_A}:test-1`;
		const event = makePledgeEvent(taskAddress, 5000);
		const pledge = parsePledge(event)!;

		expect(pledge.amount).toBe(5000);
		expect(pledge.taskAddress).toBe(taskAddress);
		expect(pledge.cashuToken).toBe('cashuA_test_token');
		expect(pledge.mintUrl).toBe('https://mint.test.com');
		expect(pledge.pubkey).toBe(PUBKEY_B);
	});

	it('parseSolution extracts description from solution event', () => {
		const taskAddress = `${TASK_KIND}:${PUBKEY_A}:test-1`;
		const event = makeSolutionEvent(taskAddress);
		const solution = parseSolution(event)!;

		expect(solution.description).toBe('Here is my solution.');
		expect(solution.taskAddress).toBe(taskAddress);
		expect(solution.pubkey).toBe(PUBKEY_B);
	});

	it('parseVote extracts vote choice', () => {
		const taskAddress = `${TASK_KIND}:${PUBKEY_A}:test-1`;
		const solutionId = 'd'.repeat(64);
		const event = makeVoteEvent(taskAddress, solutionId, 'approve');
		const vote = parseVote(event)!;

		expect(vote.choice).toBe('approve');
		expect(vote.solutionId).toBe(solutionId);
		expect(vote.taskAddress).toBe(taskAddress);
	});

	it('parsePayout extracts payout details', () => {
		const taskAddress = `${TASK_KIND}:${PUBKEY_A}:test-1`;
		const solutionId = 'd'.repeat(64);
		const event = makePayoutEvent(taskAddress, solutionId);
		const payout = parsePayout(event)!;

		expect(payout.amount).toBe(10000);
		expect(payout.solutionId).toBe(solutionId);
		expect(payout.cashuToken).toBe('cashuA_payout_token');
		expect(payout.solverPubkey).toBe(PUBKEY_B);
	});
});

// ── Full detail composition ─────────────────────────────────────────────────

describe('parseTaskDetail composition', () => {
	it('composes task, pledges, solutions, votes, and payouts', () => {
		const taskAddress = `${TASK_KIND}:${PUBKEY_A}:compose-test`;
		const taskEvent = makeTaskEvent('compose-test', 'Compose Test', 50000);
		const pledge1 = makePledgeEvent(taskAddress, 10000);
		const pledge2 = makePledgeEvent(taskAddress, 5000, PUBKEY_A);
		const solution = makeSolutionEvent(taskAddress);
		const vote = makeVoteEvent(taskAddress, solution.id, 'approve');

		const detail = parseTaskDetail(
			taskEvent,
			[pledge1, pledge2],
			[solution],
			[vote],
			[], // no payouts
			[] // no deletes
		)!;

		expect(detail.title).toBe('Compose Test');
		expect(detail.rewardAmount).toBe(50000);
		expect(detail.pledges).toHaveLength(2);
		expect(detail.totalPledged).toBe(15000);
		expect(detail.solutions).toHaveLength(1);
		expect(detail.solutionCount).toBe(1);
		expect(detail.votesBySolution.get(solution.id)).toHaveLength(1);
		expect(detail.payout).toBeNull();
	});

	it('includes payout when present', () => {
		const taskAddress = `${TASK_KIND}:${PUBKEY_A}:payout-test`;
		const taskEvent = makeTaskEvent('payout-test', 'Payout Test', 25000);
		const solution = makeSolutionEvent(taskAddress);
		const payout = makePayoutEvent(taskAddress, solution.id);

		const detail = parseTaskDetail(
			taskEvent,
			[], // no pledges
			[solution],
			[], // no votes
			[payout],
			[]
		)!;

		expect(detail.payout).not.toBeNull();
		expect(detail.payout?.amount).toBe(10000);
		expect(detail.payout?.solutionId).toBe(solution.id);
	});

	it('groups votes by solution ID', () => {
		const taskAddress = `${TASK_KIND}:${PUBKEY_A}:vote-group`;
		const taskEvent = makeTaskEvent('vote-group', 'Vote Group', 10000);
		const sol1 = makeSolutionEvent(taskAddress, PUBKEY_B);
		const sol2 = makeSolutionEvent(taskAddress, PUBKEY_A);
		const vote1 = makeVoteEvent(taskAddress, sol1.id, 'approve');
		const vote2 = makeVoteEvent(taskAddress, sol1.id, 'reject', PUBKEY_A);
		const vote3 = makeVoteEvent(taskAddress, sol2.id, 'approve');

		const detail = parseTaskDetail(taskEvent, [], [sol1, sol2], [vote1, vote2, vote3], [], [])!;

		expect(detail.votesBySolution.get(sol1.id)).toHaveLength(2);
		expect(detail.votesBySolution.get(sol2.id)).toHaveLength(1);
	});

	it('derives status based on events present', () => {
		const taskEvent = makeTaskEvent('status-test', 'Status Test', 10000);
		const taskAddress = `${TASK_KIND}:${PUBKEY_A}:status-test`;

		// Draft: no pledges, no solutions
		const draftDetail = parseTaskDetail(taskEvent, [], [], [], [], [])!;
		expect(draftDetail.status).toBe('draft');

		// Open: has pledges
		const pledge = makePledgeEvent(taskAddress, 5000);
		const openDetail = parseTaskDetail(taskEvent, [pledge], [], [], [], [])!;
		expect(openDetail.status).toBe('open');

		// In review: has pledges + solutions
		const solution = makeSolutionEvent(taskAddress);
		const reviewDetail = parseTaskDetail(taskEvent, [pledge], [solution], [], [], [])!;
		expect(reviewDetail.status).toBe('in_review');

		// Completed: has payout
		const payout = makePayoutEvent(taskAddress, solution.id);
		const completedDetail = parseTaskDetail(taskEvent, [pledge], [solution], [], [payout], [])!;
		expect(completedDetail.status).toBe('completed');
	});
});
