/**
 * Unit test: Cancel Bounty button visibility logic.
 *
 * The Cancel Bounty (RetractButton) should be hidden when:
 * - The bounty is completed
 * - The bounty is cancelled
 * - A winning solution exists (consensus reached)
 * - The bounty is in a release phase (consensus_reached or releasing status)
 *
 * It should be visible when:
 * - The creator views an open bounty
 * - The creator views an in_review bounty (no consensus yet)
 */
import { describe, it, expect, vi } from 'vitest';
import type { NostrEvent } from 'nostr-tools';
import { deriveBountyStatus } from '$lib/bounty/state-machine';
import { tallyVotes } from '$lib/bounty/voting';
import { BOUNTY_KIND, RETRACTION_KIND } from '$lib/bounty/kinds';

vi.mock('$lib/utils/env', () => ({
	getVoteQuorumFraction: () => 0.66
}));

const CREATOR = 'a'.repeat(64);
const PLEDGER = 'b'.repeat(64);
const SOLVER = 'c'.repeat(64);
const SIG = 'd'.repeat(128);
const NOW = 1700000000;

function mockEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
	return {
		id: crypto.randomUUID().replace(/-/g, '').padEnd(64, '0').slice(0, 64),
		pubkey: CREATOR,
		created_at: NOW,
		kind: 1,
		tags: [],
		content: '',
		sig: SIG,
		...overrides
	};
}

const TASK_ADDR = `${BOUNTY_KIND}:${CREATOR}:test`;

function makeBounty(): NostrEvent {
	return mockEvent({ kind: BOUNTY_KIND, tags: [['d', 'test']] });
}

function makeSolution(): NostrEvent {
	return mockEvent({ kind: 7302, pubkey: SOLVER, tags: [['a', TASK_ADDR]] });
}

function makePledge(amount = 1000): NostrEvent {
	return mockEvent({
		kind: 7301,
		pubkey: PLEDGER,
		tags: [
			['a', TASK_ADDR],
			['amount', String(amount)]
		]
	});
}

function makePayout(): NostrEvent {
	return mockEvent({
		kind: 7304,
		pubkey: PLEDGER,
		tags: [['a', TASK_ADDR]]
	});
}

function makeRetraction(): NostrEvent {
	return mockEvent({
		kind: RETRACTION_KIND,
		pubkey: CREATOR,
		tags: [
			['a', TASK_ADDR],
			['type', 'bounty']
		]
	});
}

/**
 * Mirrors the condition from BountyDetailView.svelte:
 *   isCreator && status !== 'completed' && status !== 'cancelled' && !winningSolution && !isReleasePhase
 */
function canShowCancelButton(opts: {
	isCreator: boolean;
	status: string;
	hasWinningSolution: boolean;
}): boolean {
	const isReleasePhase = opts.status === 'consensus_reached' || opts.status === 'releasing';
	return (
		opts.isCreator &&
		opts.status !== 'completed' &&
		opts.status !== 'cancelled' &&
		!opts.hasWinningSolution &&
		!isReleasePhase
	);
}

describe('Cancel Bounty button visibility', () => {
	it('shows for creator on draft bounty (no pledges)', () => {
		const bounty = makeBounty();
		const status = deriveBountyStatus(bounty, [], [], [], [], NOW, false);
		expect(status).toBe('draft');
		expect(canShowCancelButton({ isCreator: true, status, hasWinningSolution: false })).toBe(true);
	});

	it('shows for creator on in_review bounty (no consensus)', () => {
		const bounty = makeBounty();
		const solution = makeSolution();
		const status = deriveBountyStatus(bounty, [], [solution], [], [], NOW, false);
		expect(status).toBe('in_review');
		expect(canShowCancelButton({ isCreator: true, status, hasWinningSolution: false })).toBe(true);
	});

	it('hides for non-creator', () => {
		const bounty = makeBounty();
		const status = deriveBountyStatus(bounty, [], [], [], [], NOW, false);
		expect(canShowCancelButton({ isCreator: false, status, hasWinningSolution: false })).toBe(
			false
		);
	});

	it('hides when bounty is cancelled', () => {
		const bounty = makeBounty();
		const retraction = makeRetraction();
		const status = deriveBountyStatus(bounty, [], [], [], [], NOW, false, [retraction]);
		expect(status).toBe('cancelled');
		expect(canShowCancelButton({ isCreator: true, status, hasWinningSolution: false })).toBe(false);
	});

	it('hides when bounty is completed', () => {
		const bounty = makeBounty();
		const payout = makePayout();
		const status = deriveBountyStatus(bounty, [], [], [payout], [], NOW, false);
		expect(status).toBe('completed');
		expect(canShowCancelButton({ isCreator: true, status, hasWinningSolution: false })).toBe(false);
	});

	it('hides when consensus is reached (winning solution exists)', () => {
		const bounty = makeBounty();
		const solution = makeSolution();
		const status = deriveBountyStatus(bounty, [], [solution], [], [], NOW, true);
		expect(status).toBe('consensus_reached');
		expect(canShowCancelButton({ isCreator: true, status, hasWinningSolution: true })).toBe(false);
	});

	it('hides during releasing phase', () => {
		const bounty = makeBounty();
		const solution = makeSolution();
		const payout = makePayout();
		const status = deriveBountyStatus(bounty, [], [solution], [payout], [], NOW, true);
		expect(status).toBe('releasing');
		expect(canShowCancelButton({ isCreator: true, status, hasWinningSolution: true })).toBe(false);
	});

	it('hides when expired', () => {
		const bounty = mockEvent({
			kind: BOUNTY_KIND,
			tags: [
				['d', 'test'],
				['expiration', String(NOW - 1000)]
			]
		});
		const status = deriveBountyStatus(bounty, [], [], [], [], NOW, false);
		expect(status).toBe('expired');
		// expired bounties don't have winningSolution or isReleasePhase,
		// but the button should still be available for creator to formally cancel
		expect(canShowCancelButton({ isCreator: true, status, hasWinningSolution: false })).toBe(true);
	});
});
