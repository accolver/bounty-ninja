/**
 * Integration test: EventStore → Bounty helpers reactivity.
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
import { BOUNTY_KIND, PLEDGE_KIND, SOLUTION_KIND, VOTE_KIND, PAYOUT_KIND } from '$lib/bounty/kinds';
import {
	parseBountySummary,
	parsePledge,
	parseSolution,
	parseVote,
	parsePayout,
	parseBountyDetail
} from '$lib/bounty/helpers';

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

function makeBountyEvent(dTag: string, title: string, reward: number): NostrEvent {
	return mockEvent({
		kind: BOUNTY_KIND,
		tags: [
			['d', dTag],
			['title', title],
			['reward', String(reward)],
			['t', 'test'],
			['client', 'bounty.ninja']
		],
		content: 'Bounty description'
	});
}

function makePledgeEvent(
	bountyAddress: string,
	amount: number,
	pledgerPubkey: string = PUBKEY_B
): NostrEvent {
	return mockEvent({
		kind: PLEDGE_KIND,
		pubkey: pledgerPubkey,
		tags: [
			['a', bountyAddress],
			['p', PUBKEY_A],
			['amount', String(amount)],
			['cashu', 'cashuA_test_token'],
			['mint', 'https://mint.test.com'],
			['client', 'bounty.ninja']
		],
		content: ''
	});
}

function makeSolutionEvent(bountyAddress: string, solverPubkey: string = PUBKEY_B): NostrEvent {
	return mockEvent({
		kind: SOLUTION_KIND,
		pubkey: solverPubkey,
		tags: [
			['a', bountyAddress],
			['p', PUBKEY_A],
			['client', 'bounty.ninja']
		],
		content: 'Here is my solution.'
	});
}

function makeVoteEvent(
	bountyAddress: string,
	solutionId: string,
	choice: 'approve' | 'reject',
	voterPubkey: string = PUBKEY_B
): NostrEvent {
	return mockEvent({
		kind: VOTE_KIND,
		pubkey: voterPubkey,
		tags: [
			['a', bountyAddress],
			['e', solutionId],
			['p', PUBKEY_B],
			['vote', choice],
			['client', 'bounty.ninja']
		],
		content: ''
	});
}

function makePayoutEvent(bountyAddress: string, solutionId: string): NostrEvent {
	return mockEvent({
		kind: PAYOUT_KIND,
		pubkey: PUBKEY_A,
		tags: [
			['a', bountyAddress],
			['e', solutionId],
			['p', PUBKEY_B],
			['amount', '10000'],
			['cashu', 'cashuA_payout_token'],
			['client', 'bounty.ninja']
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

	it('emits bounty events via timeline observable', async () => {
		const bountyEvt = makeBountyEvent('test-1', 'Fix bug', 50000);

		// Subscribe before adding to catch the emission
		const eventsPromise = firstValueFrom(
			store.timeline({ kinds: [BOUNTY_KIND] }).pipe(skip(1), take(1))
		);

		store.add(bountyEvt);

		const events = await eventsPromise;
		expect(events).toHaveLength(1);
		expect(events[0].id).toBe(bountyEvt.id);
	});

	it('emits pledge events for a specific bounty', async () => {
		const bountyAddress = `${BOUNTY_KIND}:${PUBKEY_A}:test-1`;
		const pledge = makePledgeEvent(bountyAddress, 5000);

		const eventsPromise = firstValueFrom(
			store.timeline({ kinds: [PLEDGE_KIND], '#a': [bountyAddress] }).pipe(skip(1), take(1))
		);

		store.add(pledge);

		const events = await eventsPromise;
		expect(events).toHaveLength(1);
		expect(events[0].kind).toBe(PLEDGE_KIND);
	});

	it('emits multiple events as they are added', async () => {
		const bountyAddress = `${BOUNTY_KIND}:${PUBKEY_A}:test-1`;
		const pledge1 = makePledgeEvent(bountyAddress, 1000);
		const pledge2 = makePledgeEvent(bountyAddress, 2000);

		// Wait for second emission (after both are added)
		const eventsPromise = firstValueFrom(
			store.timeline({ kinds: [PLEDGE_KIND], '#a': [bountyAddress] }).pipe(skip(2), take(1))
		);

		store.add(pledge1);
		store.add(pledge2);

		const events = await eventsPromise;
		expect(events).toHaveLength(2);
	});
});

// ── Parsing pipeline ────────────────────────────────────────────────────────

describe('Event parsing pipeline', () => {
	it('parseBountySummary extracts correct fields from bounty event', () => {
		const event = makeBountyEvent('my-bounty', 'Build a widget', 100000);
		const summary = parseBountySummary(event)!;

		expect(summary.dTag).toBe('my-bounty');
		expect(summary.title).toBe('Build a widget');
		expect(summary.rewardAmount).toBe(100000);
		expect(summary.tags).toContain('test');
		expect(summary.pubkey).toBe(PUBKEY_A);
	});

	it('parsePledge extracts amount and token from pledge event', () => {
		const bountyAddress = `${BOUNTY_KIND}:${PUBKEY_A}:test-1`;
		const event = makePledgeEvent(bountyAddress, 5000);
		const pledge = parsePledge(event)!;

		expect(pledge.amount).toBe(5000);
		expect(pledge.bountyAddress).toBe(bountyAddress);
		expect(pledge.cashuToken).toBe('cashuA_test_token');
		expect(pledge.mintUrl).toBe('https://mint.test.com');
		expect(pledge.pubkey).toBe(PUBKEY_B);
	});

	it('parseSolution extracts description from solution event', () => {
		const bountyAddress = `${BOUNTY_KIND}:${PUBKEY_A}:test-1`;
		const event = makeSolutionEvent(bountyAddress);
		const solution = parseSolution(event)!;

		expect(solution.description).toBe('Here is my solution.');
		expect(solution.bountyAddress).toBe(bountyAddress);
		expect(solution.pubkey).toBe(PUBKEY_B);
	});

	it('parseVote extracts vote choice', () => {
		const bountyAddress = `${BOUNTY_KIND}:${PUBKEY_A}:test-1`;
		const solutionId = 'd'.repeat(64);
		const event = makeVoteEvent(bountyAddress, solutionId, 'approve');
		const vote = parseVote(event)!;

		expect(vote.choice).toBe('approve');
		expect(vote.solutionId).toBe(solutionId);
		expect(vote.bountyAddress).toBe(bountyAddress);
	});

	it('parsePayout extracts payout details', () => {
		const bountyAddress = `${BOUNTY_KIND}:${PUBKEY_A}:test-1`;
		const solutionId = 'd'.repeat(64);
		const event = makePayoutEvent(bountyAddress, solutionId);
		const payout = parsePayout(event)!;

		expect(payout.amount).toBe(10000);
		expect(payout.solutionId).toBe(solutionId);
		expect(payout.cashuToken).toBe('cashuA_payout_token');
		expect(payout.solverPubkey).toBe(PUBKEY_B);
	});
});

// ── Full detail composition ─────────────────────────────────────────────────

describe('parseBountyDetail composition', () => {
	it('composes bounty, pledges, solutions, votes, and payouts', () => {
		const bountyAddress = `${BOUNTY_KIND}:${PUBKEY_A}:compose-test`;
		const bountyEvent = makeBountyEvent('compose-test', 'Compose Test', 50000);
		const pledge1 = makePledgeEvent(bountyAddress, 10000);
		const pledge2 = makePledgeEvent(bountyAddress, 5000, PUBKEY_A);
		const solution = makeSolutionEvent(bountyAddress);
		const vote = makeVoteEvent(bountyAddress, solution.id, 'approve');

		const detail = parseBountyDetail(
			bountyEvent,
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
		const bountyAddress = `${BOUNTY_KIND}:${PUBKEY_A}:payout-test`;
		const bountyEvent = makeBountyEvent('payout-test', 'Payout Test', 25000);
		const solution = makeSolutionEvent(bountyAddress);
		const payout = makePayoutEvent(bountyAddress, solution.id);

		const detail = parseBountyDetail(
			bountyEvent,
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
		const bountyAddress = `${BOUNTY_KIND}:${PUBKEY_A}:vote-group`;
		const bountyEvent = makeBountyEvent('vote-group', 'Vote Group', 10000);
		const sol1 = makeSolutionEvent(bountyAddress, PUBKEY_B);
		const sol2 = makeSolutionEvent(bountyAddress, PUBKEY_A);
		const vote1 = makeVoteEvent(bountyAddress, sol1.id, 'approve');
		const vote2 = makeVoteEvent(bountyAddress, sol1.id, 'reject', PUBKEY_A);
		const vote3 = makeVoteEvent(bountyAddress, sol2.id, 'approve');

		const detail = parseBountyDetail(bountyEvent, [], [sol1, sol2], [vote1, vote2, vote3], [], [])!;

		expect(detail.votesBySolution.get(sol1.id)).toHaveLength(2);
		expect(detail.votesBySolution.get(sol2.id)).toHaveLength(1);
	});

	it('derives status based on events present', () => {
		const bountyEvent = makeBountyEvent('status-test', 'Status Test', 10000);
		const bountyAddress = `${BOUNTY_KIND}:${PUBKEY_A}:status-test`;

		// Open: no pledges, no solutions (published bounty)
		const draftDetail = parseBountyDetail(bountyEvent, [], [], [], [], [])!;
		expect(draftDetail.status).toBe('open');

		// Open: has pledges
		const pledge = makePledgeEvent(bountyAddress, 5000);
		const openDetail = parseBountyDetail(bountyEvent, [pledge], [], [], [], [])!;
		expect(openDetail.status).toBe('open');

		// In review: has pledges + solutions
		const solution = makeSolutionEvent(bountyAddress);
		const reviewDetail = parseBountyDetail(bountyEvent, [pledge], [solution], [], [], [])!;
		expect(reviewDetail.status).toBe('in_review');

		// Completed: has payout
		const payout = makePayoutEvent(bountyAddress, solution.id);
		const completedDetail = parseBountyDetail(bountyEvent, [pledge], [solution], [], [payout], [])!;
		expect(completedDetail.status).toBe('completed');
	});
});
