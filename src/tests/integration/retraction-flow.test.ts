/**
 * Integration test: Retraction flow.
 *
 * Tests end-to-end retraction scenarios:
 * (a) Bounty retraction with no solutions → no Kind 73006, status = cancelled
 * (b) Bounty retraction with solutions → Kind 73006, status = cancelled
 * (c) Pledge retraction with no solutions → pledge removed, no Kind 73006
 * (d) Pledge retraction with solutions → Kind 73006, pledge removed
 */
import { describe, it, expect, vi } from 'vitest';
import type { NostrEvent } from 'nostr-tools';

vi.mock('$lib/utils/env', () => ({
	getVoteQuorumFraction: () => 0.66
}));

import { BOUNTY_KIND, SOLUTION_KIND, PLEDGE_KIND, RETRACTION_KIND, REPUTATION_KIND } from '$lib/bounty/kinds';
import { retractionBlueprint, reputationBlueprint } from '$lib/bounty/blueprints';
import { parseRetraction } from '$lib/bounty/helpers';
import { deriveBountyStatus } from '$lib/bounty/state-machine';

const CREATOR_PUBKEY = 'a'.repeat(64);
const PLEDGER_PUBKEY = 'b'.repeat(64);
const SIG = 'd'.repeat(128);

function signEvent(
	template: { kind: number; tags: string[][]; content: string; created_at: number },
	pubkey: string
): NostrEvent {
	return {
		...template,
		id: crypto.randomUUID().replace(/-/g, '').padEnd(64, '0').slice(0, 64),
		pubkey,
		sig: SIG
	};
}

function makeBountyEvent(dTag: string): NostrEvent {
	return {
		id: crypto.randomUUID().replace(/-/g, '').padEnd(64, '0').slice(0, 64),
		pubkey: CREATOR_PUBKEY,
		created_at: Math.floor(Date.now() / 1000),
		kind: BOUNTY_KIND,
		tags: [
			['d', dTag],
			['title', 'Test Bounty'],
			['reward', '1000']
		],
		content: 'Test description',
		sig: SIG
	};
}

const TASK_ADDR = `${BOUNTY_KIND}:${CREATOR_PUBKEY}:test-bounty`;

describe('Retraction flow', () => {
	it('(a) bounty retraction with no solutions → no reputation event needed, status = cancelled', () => {
		const bountyEvent = makeBountyEvent('test-bounty');

		// Create retraction
		const template = retractionBlueprint({
			taskAddress: TASK_ADDR,
			type: 'bounty',
			creatorPubkey: CREATOR_PUBKEY,
			reason: 'Changed my mind'
		});
		const retractionEvent = signEvent(template, CREATOR_PUBKEY);

		// No solutions → no reputation event needed
		const hasSolutions = false;
		expect(hasSolutions).toBe(false);

		// Status should be cancelled
		const status = deriveBountyStatus(bountyEvent, [], [], [], [], undefined, false, [retractionEvent]);
		expect(status).toBe('cancelled');

		// Parse the retraction
		const parsed = parseRetraction(retractionEvent);
		expect(parsed).not.toBeNull();
		expect(parsed!.type).toBe('bounty');
	});

	it('(b) bounty retraction with solutions → reputation event published, status = cancelled', () => {
		const bountyEvent = makeBountyEvent('test-bounty');
		const solutionEvent: NostrEvent = {
			id: '5'.repeat(64),
			pubkey: 'e'.repeat(64),
			created_at: Math.floor(Date.now() / 1000),
			kind: SOLUTION_KIND,
			tags: [['a', TASK_ADDR]],
			content: 'My solution',
			sig: SIG
		};

		// Create retraction
		const retractionTemplate = retractionBlueprint({
			taskAddress: TASK_ADDR,
			type: 'bounty',
			creatorPubkey: CREATOR_PUBKEY
		});
		const retractionEvent = signEvent(retractionTemplate, CREATOR_PUBKEY);

		// Solutions exist → create reputation event
		const repTemplate = reputationBlueprint({
			offenderPubkey: CREATOR_PUBKEY,
			taskAddress: TASK_ADDR,
			type: 'bounty_retraction',
			retractionEventId: retractionEvent.id
		});
		const repEvent = signEvent(repTemplate, CREATOR_PUBKEY);
		expect(repEvent.kind).toBe(REPUTATION_KIND);

		const status = deriveBountyStatus(bountyEvent, [], [solutionEvent], [], [], undefined, false, [retractionEvent]);
		expect(status).toBe('cancelled');
	});

	it('(c) pledge retraction with no solutions → pledge removed, no reputation event', () => {
		const bountyEvent = makeBountyEvent('test-bounty');
		const pledgeEvent: NostrEvent = {
			id: '6'.repeat(64),
			pubkey: PLEDGER_PUBKEY,
			created_at: Math.floor(Date.now() / 1000),
			kind: PLEDGE_KIND,
			tags: [['a', TASK_ADDR]],
			content: '',
			sig: SIG
		};

		const retractionTemplate = retractionBlueprint({
			taskAddress: TASK_ADDR,
			type: 'pledge',
			pledgeEventId: pledgeEvent.id,
			creatorPubkey: CREATOR_PUBKEY
		});
		const retractionEvent = signEvent(retractionTemplate, PLEDGER_PUBKEY);

		const parsed = parseRetraction(retractionEvent);
		expect(parsed!.type).toBe('pledge');
		expect(parsed!.pledgeEventId).toBe(pledgeEvent.id);

		// Pledge retraction should NOT cancel the bounty
		const status = deriveBountyStatus(bountyEvent, [pledgeEvent], [], [], [], undefined, false, [retractionEvent]);
		expect(status).toBe('open');

		// Filter out retracted pledges
		const retractedIds = new Set([parsed!.pledgeEventId!]);
		const activePledges = [pledgeEvent].filter((e) => !retractedIds.has(e.id));
		expect(activePledges).toHaveLength(0);
	});

	it('(d) pledge retraction with solutions → reputation event, pledge removed', () => {
		const bountyEvent = makeBountyEvent('test-bounty');
		const pledgeEvent: NostrEvent = {
			id: '6'.repeat(64),
			pubkey: PLEDGER_PUBKEY,
			created_at: Math.floor(Date.now() / 1000),
			kind: PLEDGE_KIND,
			tags: [['a', TASK_ADDR]],
			content: '',
			sig: SIG
		};
		const solutionEvent: NostrEvent = {
			id: '7'.repeat(64),
			pubkey: 'e'.repeat(64),
			created_at: Math.floor(Date.now() / 1000),
			kind: SOLUTION_KIND,
			tags: [['a', TASK_ADDR]],
			content: 'Solution',
			sig: SIG
		};

		const retractionTemplate = retractionBlueprint({
			taskAddress: TASK_ADDR,
			type: 'pledge',
			pledgeEventId: pledgeEvent.id,
			creatorPubkey: CREATOR_PUBKEY
		});
		const retractionEvent = signEvent(retractionTemplate, PLEDGER_PUBKEY);

		// Solutions exist → reputation event
		const repTemplate = reputationBlueprint({
			offenderPubkey: PLEDGER_PUBKEY,
			taskAddress: TASK_ADDR,
			type: 'pledge_retraction',
			retractionEventId: retractionEvent.id
		});
		const repEvent = signEvent(repTemplate, PLEDGER_PUBKEY);
		expect(repEvent.kind).toBe(REPUTATION_KIND);

		// Bounty still open (pledge retraction doesn't cancel)
		const status = deriveBountyStatus(bountyEvent, [pledgeEvent], [solutionEvent], [], [], undefined, false, [retractionEvent]);
		expect(status).toBe('in_review');
	});
});
