/**
 * Integration test: Pledge creation flow.
 *
 * Tests the pledge creation pipeline:
 * 1. Blueprint produces correct Kind 73002 event structure
 * 2. Event inserted into EventStore is retrievable
 * 3. Parsed pledge has correct fields
 * 4. Bounty stays open with or without pledges
 * 5. totalPledged reflects new pledges
 *
 * Uses real EventStore with no relay connections.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { firstValueFrom, skip, take } from 'rxjs';
import { EventStore } from 'applesauce-core';
import type { NostrEvent } from 'nostr-tools';
import { BOUNTY_KIND, PLEDGE_KIND } from '$lib/bounty/kinds';
import { pledgeBlueprint } from '$lib/bounty/blueprints';
import { parsePledge, parseBountyDetail } from '$lib/bounty/helpers';
import { CLIENT_TAG } from '$lib/utils/constants';

const CREATOR_PUBKEY = 'a'.repeat(64);
const PLEDGER_PUBKEY = 'b'.repeat(64);
const PLEDGER_2_PUBKEY = 'c'.repeat(64);
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
			['reward', '50000'],
			['client', 'bounty.ninja']
		],
		content: 'Bounty description',
		sig: SIG
	};
}

// ── Blueprint validation ────────────────────────────────────────────────────

describe('Pledge blueprint produces correct event structure', () => {
	const bountyAddress = `${BOUNTY_KIND}:${CREATOR_PUBKEY}:test-bounty`;

	it('creates Kind 73002 event template', () => {
		const template = pledgeBlueprint({
			bountyAddress,
			creatorPubkey: CREATOR_PUBKEY,
			amount: 10000,
			cashuToken: 'cashuA_test_123',
			mintUrl: 'https://mint.test.com',
			message: 'Funding this bounty!'
		});

		expect(template.kind).toBe(PLEDGE_KIND);
		expect(template.content).toBe('Funding this bounty!');
		expect(template.created_at).toBeGreaterThan(0);
	});

	it('includes all required tags', () => {
		const template = pledgeBlueprint({
			bountyAddress,
			creatorPubkey: CREATOR_PUBKEY,
			amount: 5000,
			cashuToken: 'cashuA_abc',
			mintUrl: 'https://mint.test.com'
		});

		const tagMap = new Map(template.tags.map((t) => [t[0], t[1]]));
		expect(tagMap.get('a')).toBe(bountyAddress);
		expect(tagMap.get('p')).toBe(CREATOR_PUBKEY);
		expect(tagMap.get('amount')).toBe('5000');
		expect(tagMap.get('cashu')).toBe('cashuA_abc');
		expect(tagMap.get('mint')).toBe('https://mint.test.com');
		expect(tagMap.get('client')).toBe(CLIENT_TAG);
	});
});

// ── EventStore insert and retrieve ──────────────────────────────────────────

describe('Pledge event inserted into EventStore', () => {
	let store: EventStore;
	const dTag = 'pledge-flow-test';
	const bountyAddress = `${BOUNTY_KIND}:${CREATOR_PUBKEY}:${dTag}`;

	beforeEach(() => {
		store = new EventStore();
		// Disable signature verification for test events with mock signatures
		store.verifyEvent = () => true;
	});

	it('is retrievable via timeline filter', async () => {
		const template = pledgeBlueprint({
			bountyAddress,
			creatorPubkey: CREATOR_PUBKEY,
			amount: 10000,
			cashuToken: 'cashuA_test',
			mintUrl: 'https://mint.test.com'
		});

		const pledgeEvent = signEvent(template, PLEDGER_PUBKEY);

		// Set up timeline subscription before adding
		const eventsPromise = firstValueFrom(
			store.timeline({ kinds: [PLEDGE_KIND], '#a': [bountyAddress] }).pipe(skip(1), take(1))
		);

		store.add(pledgeEvent);

		const events = await eventsPromise;
		expect(events).toHaveLength(1);
		expect(events[0].id).toBe(pledgeEvent.id);
		expect(events[0].kind).toBe(PLEDGE_KIND);
	});

	it('parses correctly after retrieval', async () => {
		const template = pledgeBlueprint({
			bountyAddress,
			creatorPubkey: CREATOR_PUBKEY,
			amount: 7500,
			cashuToken: 'cashuA_parsed',
			mintUrl: 'https://mint.test.com',
			message: 'Great project!'
		});

		const pledgeEvent = signEvent(template, PLEDGER_PUBKEY);
		store.add(pledgeEvent);

		const pledge = parsePledge(pledgeEvent)!;
		expect(pledge.amount).toBe(7500);
		expect(pledge.bountyAddress).toBe(bountyAddress);
		expect(pledge.cashuToken).toBe('cashuA_parsed');
		expect(pledge.mintUrl).toBe('https://mint.test.com');
		expect(pledge.message).toBe('Great project!');
		expect(pledge.pubkey).toBe(PLEDGER_PUBKEY);
	});
});

// ── Status transitions ──────────────────────────────────────────────────────

describe('Bounty status transitions on pledge', () => {
	it('stays open with or without pledges', () => {
		const dTag = 'status-transition';
		const bountyAddress = `${BOUNTY_KIND}:${CREATOR_PUBKEY}:${dTag}`;
		const bountyEvent = makeBountyEvent(dTag);

		// No pledges = open (published bounty)
		const unfundedDetail = parseBountyDetail(bountyEvent, [], [], [], [], [])!;
		expect(unfundedDetail.status).toBe('open');

		// Add first pledge
		const pledgeTemplate = pledgeBlueprint({
			bountyAddress,
			creatorPubkey: CREATOR_PUBKEY,
			amount: 10000,
			cashuToken: 'cashuA_first',
			mintUrl: 'https://mint.test.com'
		});
		const pledgeEvent = signEvent(pledgeTemplate, PLEDGER_PUBKEY);

		// With pledge = open
		const openDetail = parseBountyDetail(bountyEvent, [pledgeEvent], [], [], [], [])!;
		expect(openDetail.status).toBe('open');
	});

	it('remains open with multiple pledges', () => {
		const dTag = 'multi-pledge';
		const bountyAddress = `${BOUNTY_KIND}:${CREATOR_PUBKEY}:${dTag}`;
		const bountyEvent = makeBountyEvent(dTag);

		const pledge1 = signEvent(
			pledgeBlueprint({
				bountyAddress,
				creatorPubkey: CREATOR_PUBKEY,
				amount: 5000,
				cashuToken: 'cashuA_p1',
				mintUrl: 'https://mint.test.com'
			}),
			PLEDGER_PUBKEY
		);

		const pledge2 = signEvent(
			pledgeBlueprint({
				bountyAddress,
				creatorPubkey: CREATOR_PUBKEY,
				amount: 3000,
				cashuToken: 'cashuA_p2',
				mintUrl: 'https://mint.test.com'
			}),
			PLEDGER_2_PUBKEY
		);

		const detail = parseBountyDetail(bountyEvent, [pledge1, pledge2], [], [], [], [])!;
		expect(detail.status).toBe('open');
	});
});

// ── totalPledged computation ────────────────────────────────────────────────

describe('totalPledged reflects pledges', () => {
	it('sums all pledge amounts', () => {
		const dTag = 'total-pledged';
		const bountyAddress = `${BOUNTY_KIND}:${CREATOR_PUBKEY}:${dTag}`;
		const bountyEvent = makeBountyEvent(dTag);

		const pledge1 = signEvent(
			pledgeBlueprint({
				bountyAddress,
				creatorPubkey: CREATOR_PUBKEY,
				amount: 10000,
				cashuToken: 'cashuA_t1',
				mintUrl: 'https://mint.test.com'
			}),
			PLEDGER_PUBKEY
		);

		const pledge2 = signEvent(
			pledgeBlueprint({
				bountyAddress,
				creatorPubkey: CREATOR_PUBKEY,
				amount: 5000,
				cashuToken: 'cashuA_t2',
				mintUrl: 'https://mint.test.com'
			}),
			PLEDGER_2_PUBKEY
		);

		const pledge3 = signEvent(
			pledgeBlueprint({
				bountyAddress,
				creatorPubkey: CREATOR_PUBKEY,
				amount: 2500,
				cashuToken: 'cashuA_t3',
				mintUrl: 'https://mint.test.com'
			}),
			PLEDGER_PUBKEY
		);

		const detail = parseBountyDetail(bountyEvent, [pledge1, pledge2, pledge3], [], [], [], [])!;
		expect(detail.totalPledged).toBe(17500);
	});

	it('starts at 0 with no pledges', () => {
		const bountyEvent = makeBountyEvent('no-pledges');
		const detail = parseBountyDetail(bountyEvent, [], [], [], [], [])!;
		expect(detail.totalPledged).toBe(0);
	});

	it('reflects single pledge amount', () => {
		const dTag = 'single-pledge';
		const bountyAddress = `${BOUNTY_KIND}:${CREATOR_PUBKEY}:${dTag}`;
		const bountyEvent = makeBountyEvent(dTag);

		const pledge = signEvent(
			pledgeBlueprint({
				bountyAddress,
				creatorPubkey: CREATOR_PUBKEY,
				amount: 42000,
				cashuToken: 'cashuA_single',
				mintUrl: 'https://mint.test.com'
			}),
			PLEDGER_PUBKEY
		);

		const detail = parseBountyDetail(bountyEvent, [pledge], [], [], [], [])!;
		expect(detail.totalPledged).toBe(42000);
	});
});
