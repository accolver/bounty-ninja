import { describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from 'nostr-tools';
import type {
	Bounty,
	FinancialProjectionInput,
	Pledge,
	Retraction,
	Solution,
	Vote
} from '$lib/bounty/types';
import type { PledgeVerification, ProofIdentity } from '$lib/cashu/types';
import type { CashuTokenVerification } from '$lib/cashu/types';

vi.mock('$lib/utils/env', () => ({ getVoteQuorumFraction: () => 0.66 }));

import { projectFinancialState } from '$lib/bounty/financial-state';

const CREATOR = 'a'.repeat(64);
const ALICE = 'b'.repeat(64);
const BOB = 'c'.repeat(64);
const ADDRESS = `37300:${CREATOR}:bounty`;
const NOW = 1_000;

function event(id: string, pubkey: string, createdAt: number): NostrEvent {
	return {
		id: id.padEnd(64, id[0] ?? '0'),
		pubkey,
		created_at: createdAt,
		kind: 1,
		tags: [],
		content: '',
		sig: 'd'.repeat(128)
	};
}

const bounty = {
	event: event('f', CREATOR, 1),
	id: 'f'.repeat(64),
	dTag: 'bounty',
	pubkey: CREATOR,
	title: 'Bounty',
	description: '',
	rewardAmount: 100,
	rewardCurrency: 'sat',
	tags: [],
	deadline: null,
	status: 'draft',
	totalPledged: 0,
	solutionCount: 0,
	createdAt: 1,
	mintUrl: 'https://mint.example',
	submissionFee: 0
} satisfies Bounty;

function pledge(id: string, pubkey: string, amount: number, createdAt: number): Pledge {
	return {
		event: event(id, pubkey, createdAt),
		id: id.padEnd(64, id[0]),
		pubkey,
		paymentPubkey: pubkey,
		bountyAddress: ADDRESS,
		amount,
		cashuToken: `token-${id}`,
		mintUrl: 'https://mint.example',
		createdAt,
		message: ''
	};
}

function verification(
	item: Pledge,
	status: PledgeVerification['status'],
	identities: string[] = [`proof-${item.id}`]
): PledgeVerification {
	return {
		pledgeId: item.id,
		status,
		policyVersion: 1,
		checkedAt: NOW,
		validUntil: NOW + 300,
		normalizedMint: 'https://mint.example',
		decodedAmount: item.amount,
		proofIdentities: identities as ProofIdentity[],
		reasons: []
	};
}

function solution(id: string, pubkey: string, createdAt = 10): Solution {
	return {
		event: event(id, pubkey, createdAt),
		id: id.padEnd(64, id[0]),
		pubkey,
		paymentPubkey: pubkey,
		bountyAddress: ADDRESS,
		description: 'solution',
		antiSpamTokens: [],
		antiSpamAmount: 0,
		deliverableUrl: null,
		createdAt,
		voteWeight: 0
	};
}

function vote(
	id: string,
	pubkey: string,
	target: Solution,
	choice: Vote['choice'],
	createdAt: number
): Vote {
	return {
		event: event(id, pubkey, createdAt),
		id: id.padEnd(64, id[0]),
		pubkey,
		bountyAddress: ADDRESS,
		solutionId: target.id,
		choice,
		pledgeAmount: 0,
		weight: 0,
		createdAt
	};
}

function retraction(
	id: string,
	pubkey: string,
	type: Retraction['type'],
	pledgeEventId: string | null,
	taskAddress = ADDRESS
): Retraction {
	return {
		event: event(id, pubkey, 20),
		id: id.padEnd(64, id[0]),
		pubkey,
		taskAddress,
		type,
		pledgeEventId,
		reason: '',
		createdAt: 20,
		hasSolutions: false
	};
}

function payout(id: string, source: Pledge, target: Solution, createdAt: number) {
	return {
		event: event(id, source.pubkey, createdAt),
		id: id.padEnd(64, id[0]),
		pubkey: source.pubkey,
		bountyAddress: ADDRESS,
		solutionId: target.id,
		solverPubkey: target.pubkey,
		paymentPubkey: target.paymentPubkey,
		amount: source.amount,
		cashuToken: `payout-${id}`,
		sourcePledgeId: source.id,
		mintUrl: source.mintUrl,
		createdAt
	};
}

function payoutVerification(item: ReturnType<typeof payout>): CashuTokenVerification {
	return {
		status: 'valid',
		policyVersion: 1,
		checkedAt: NOW,
		validUntil: NOW + 300,
		normalizedMint: 'https://mint.example',
		decodedAmount: item.amount,
		proofIdentities: [],
		p2pkTarget: `02${item.paymentPubkey}`,
		reasons: []
	};
}

function input(overrides: Partial<FinancialProjectionInput> = {}): FinancialProjectionInput {
	return {
		bounty,
		pledges: [],
		pledgeVerifications: new Map(),
		solutions: [],
		votes: [],
		payouts: [],
		payoutTokenVerifications: new Map(),
		retractions: [],
		relatedEventsComplete: true,
		now: NOW,
		...overrides
	};
}

describe('projectFinancialState', () => {
	it('counts only current valid pledge value and separates other states', () => {
		const valid = pledge('1', ALICE, 60, 1);
		const pending = pledge('2', BOB, 1000, 2);
		const unavailable = pledge('3', BOB, 2000, 3);
		const invalid = pledge('4', BOB, 3000, 4);
		const projection = projectFinancialState(
			input({
				pledges: [invalid, pending, valid, unavailable],
				pledgeVerifications: new Map([
					[valid.id, verification(valid, 'valid')],
					[unavailable.id, verification(unavailable, 'unavailable')],
					[invalid.id, verification(invalid, 'invalid')]
				])
			})
		);
		expect(projection.validatedFunding).toBe(60);
		expect(projection.activePledges).toEqual([valid]);
		expect(projection.pendingPledges).toEqual([pending]);
		expect(projection.unavailablePledges).toEqual([unavailable]);
		expect(projection.invalidPledges).toEqual([invalid]);
		expect(projection.votingPowerByPubkey.get(ALICE)).toBe(60);
	});

	it('treats stale valid verification as unavailable', () => {
		const item = pledge('1', ALICE, 100, 1);
		const stale = { ...verification(item, 'valid'), validUntil: NOW };
		const projection = projectFinancialState(
			input({ pledges: [item], pledgeVerifications: new Map([[item.id, stale]]) })
		);
		expect(projection.validatedFunding).toBe(0);
		expect(projection.unavailablePledges).toEqual([item]);
	});

	it('remains draft with zero validated funding even after the deadline', () => {
		const expiredBounty = { ...bounty, deadline: NOW - 1 };
		expect(projectFinancialState(input({ bounty: expiredBounty })).status).toBe('draft');
	});

	it('accepts at most one duplicate proof owner by createdAt then id regardless of input order', () => {
		const first = pledge('1', ALICE, 40, 10);
		const second = pledge('2', BOB, 90, 10);
		const shared = ['shared'] as ProofIdentity[];
		const values = new Map([
			[first.id, verification(first, 'valid', shared)],
			[second.id, verification(second, 'valid', shared)]
		]);
		const forward = projectFinancialState(
			input({ pledges: [first, second], pledgeVerifications: values })
		);
		const reverse = projectFinancialState(
			input({ pledges: [second, first], pledgeVerifications: values })
		);
		expect(forward.activePledges.map((item) => item.id)).toEqual([first.id]);
		expect(reverse.activePledges.map((item) => item.id)).toEqual([first.id]);
		expect(forward.validatedFunding).toBe(40);
	});

	it('applies only owner-authorized same-bounty pledge retractions', () => {
		const item = pledge('1', ALICE, 100, 1);
		const validRetraction = retraction('1', ALICE, 'pledge', item.id);
		const forged = retraction('2', BOB, 'pledge', item.id);
		const crossBounty = retraction('3', ALICE, 'pledge', item.id, `${ADDRESS}-other`);
		const projection = projectFinancialState(
			input({
				pledges: [item],
				pledgeVerifications: new Map([[item.id, verification(item, 'valid')]]),
				retractions: [forged, crossBounty, validRetraction]
			})
		);
		expect(projection.activePledges).toEqual([]);
		expect(projection.authorizedRetractions).toEqual([validRetraction]);
	});

	it('cancels only for a creator-authored exact-bounty retraction', () => {
		const forged = retraction('1', BOB, 'bounty', null);
		const wrongBounty = retraction('2', CREATOR, 'bounty', null, `${ADDRESS}-other`);
		expect(projectFinancialState(input({ retractions: [forged, wrongBounty] })).cancelled).toBe(
			false
		);
		const valid = retraction('3', CREATOR, 'bounty', null);
		const projection = projectFinancialState(input({ retractions: [valid, forged] }));
		expect(projection.cancelled).toBe(true);
		expect(projection.status).toBe('cancelled');
	});

	it('uses deterministic latest votes and reports one unique winner', () => {
		const item = pledge('1', ALICE, 100, 1);
		const candidate = solution('2', BOB);
		const earlierApprove = vote('1', ALICE, candidate, 'approve', 30);
		const laterByIdReject = vote('2', ALICE, candidate, 'reject', 30);
		const projection = projectFinancialState(
			input({
				pledges: [item],
				pledgeVerifications: new Map([[item.id, verification(item, 'valid')]]),
				solutions: [candidate],
				votes: [laterByIdReject, earlierApprove]
			})
		);
		expect(projection.consensus.state).toBe('none');

		const approved = projectFinancialState(
			input({
				pledges: [item],
				pledgeVerifications: new Map([[item.id, verification(item, 'valid')]]),
				solutions: [candidate],
				votes: [vote('3', ALICE, candidate, 'approve', 31)]
			})
		);
		expect(approved.consensus.state).toBe('unique');
		if (approved.consensus.state === 'unique') expect(approved.consensus.winner).toBe(candidate);
	});

	it('reports ambiguous consensus when multiple solutions reach quorum', () => {
		const item = pledge('1', ALICE, 100, 1);
		const one = solution('1', BOB);
		const two = solution('2', 'd'.repeat(64));
		const projection = projectFinancialState(
			input({
				pledges: [item],
				pledgeVerifications: new Map([[item.id, verification(item, 'valid')]]),
				solutions: [two, one],
				votes: [vote('1', ALICE, one, 'approve', 30), vote('2', ALICE, two, 'approve', 31)]
			})
		);
		expect(projection.consensus.state).toBe('ambiguous');
		if (projection.consensus.state === 'ambiguous') {
			expect(projection.consensus.approvedSolutionIds).toEqual([one.id, two.id]);
		}
	});

	it('fails consensus closed when related events are incomplete', () => {
		const projection = projectFinancialState(input({ relatedEventsComplete: false }));
		expect(projection.consensus.state).toBe('incomplete');
	});

	it('ignores cross-bounty pledges, solutions, and votes', () => {
		const item = { ...pledge('1', ALICE, 100, 1), bountyAddress: `${ADDRESS}-other` };
		const candidate = { ...solution('1', BOB), bountyAddress: `${ADDRESS}-other` };
		const projection = projectFinancialState(
			input({
				pledges: [item],
				pledgeVerifications: new Map([[item.id, verification(item, 'valid')]]),
				solutions: [candidate],
				votes: [vote('1', ALICE, candidate, 'approve', 30)]
			})
		);
		expect(projection.validatedFunding).toBe(0);
		expect(projection.solutions).toEqual([]);
	});

	it('tracks source-bound release progress and completes only after every active source', () => {
		const first = pledge('1', ALICE, 40, 1);
		const second = pledge('2', BOB, 60, 2);
		const candidate = solution('3', 'd'.repeat(64));
		const firstPayout = payout('4', first, candidate, 40);
		const secondPayout = payout('5', second, candidate, 50);
		const base = {
			pledges: [first, second],
			pledgeVerifications: new Map([
				[first.id, verification(first, 'valid')],
				[second.id, verification(second, 'valid')]
			]),
			solutions: [candidate],
			votes: [vote('1', ALICE, candidate, 'approve', 30), vote('2', BOB, candidate, 'approve', 31)]
		};
		const partial = projectFinancialState(
			input({
				...base,
				payouts: [firstPayout],
				payoutTokenVerifications: new Map([[firstPayout.id, payoutVerification(firstPayout)]])
			})
		);
		expect(partial.status).toBe('releasing');
		expect(partial.releaseProgress.complete).toBe(false);
		expect(partial.releaseProgress.releasedAmount).toBe(40);
		expect(
			projectFinancialState(
				input({
					...base,
					bounty: { ...bounty, deadline: NOW - 1 },
					payouts: [firstPayout],
					payoutTokenVerifications: new Map([[firstPayout.id, payoutVerification(firstPayout)]])
				})
			).status
		).toBe('releasing');

		const complete = projectFinancialState(
			input({
				...base,
				payouts: [secondPayout, firstPayout],
				payoutTokenVerifications: new Map([
					[firstPayout.id, payoutVerification(firstPayout)],
					[secondPayout.id, payoutVerification(secondPayout)]
				])
			})
		);
		expect(complete.status).toBe('completed');
		expect(complete.releaseProgress.complete).toBe(true);
		expect(complete.releaseProgress.releasedAmount).toBe(100);
	});

	it('accepts only the first deterministic valid payout per source', () => {
		const source = pledge('1', ALICE, 100, 1);
		const candidate = solution('2', BOB);
		const first = payout('3', source, candidate, 40);
		const duplicate = payout('4', source, candidate, 40);
		const projection = projectFinancialState(
			input({
				pledges: [source],
				pledgeVerifications: new Map([[source.id, verification(source, 'valid')]]),
				solutions: [candidate],
				votes: [vote('1', ALICE, candidate, 'approve', 30)],
				payouts: [duplicate, first],
				payoutTokenVerifications: new Map([
					[first.id, payoutVerification(first)],
					[duplicate.id, payoutVerification(duplicate)]
				])
			})
		);
		expect(projection.validPayouts).toEqual([first]);
		expect(projection.payoutValidations[1].reasons).toContain('duplicate_source_payout');
	});
});
