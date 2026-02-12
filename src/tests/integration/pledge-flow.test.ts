/**
 * Integration test: Pledge creation flow.
 *
 * Tests the pledge creation pipeline:
 * 1. Blueprint produces correct Kind 73002 event structure
 * 2. Event inserted into EventStore is retrievable
 * 3. Parsed pledge has correct fields
 * 4. Status transitions work (draft → open on first pledge)
 * 5. totalPledged reflects new pledges
 *
 * Uses real EventStore with no relay connections.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { firstValueFrom, skip, take } from 'rxjs';
import { EventStore } from 'applesauce-core';
import type { NostrEvent } from 'nostr-tools';
import { TASK_KIND, PLEDGE_KIND } from '$lib/task/kinds';
import { pledgeBlueprint } from '$lib/task/blueprints';
import { parsePledge, parseTaskDetail } from '$lib/task/helpers';
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

function makeTaskEvent(dTag: string): NostrEvent {
	return {
		id: crypto.randomUUID().replace(/-/g, '').padEnd(64, '0').slice(0, 64),
		pubkey: CREATOR_PUBKEY,
		created_at: Math.floor(Date.now() / 1000),
		kind: TASK_KIND,
		tags: [
			['d', dTag],
			['title', 'Test Task'],
			['reward', '50000'],
			['client', 'tasks.fyi']
		],
		content: 'Task description',
		sig: SIG
	};
}

// ── Blueprint validation ────────────────────────────────────────────────────

describe('Pledge blueprint produces correct event structure', () => {
	const taskAddress = `${TASK_KIND}:${CREATOR_PUBKEY}:test-task`;

	it('creates Kind 73002 event template', () => {
		const template = pledgeBlueprint({
			taskAddress,
			creatorPubkey: CREATOR_PUBKEY,
			amount: 10000,
			cashuToken: 'cashuA_test_123',
			mintUrl: 'https://mint.test.com',
			message: 'Funding this task!'
		});

		expect(template.kind).toBe(PLEDGE_KIND);
		expect(template.content).toBe('Funding this task!');
		expect(template.created_at).toBeGreaterThan(0);
	});

	it('includes all required tags', () => {
		const template = pledgeBlueprint({
			taskAddress,
			creatorPubkey: CREATOR_PUBKEY,
			amount: 5000,
			cashuToken: 'cashuA_abc',
			mintUrl: 'https://mint.test.com'
		});

		const tagMap = new Map(template.tags.map((t) => [t[0], t[1]]));
		expect(tagMap.get('a')).toBe(taskAddress);
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
	const taskAddress = `${TASK_KIND}:${CREATOR_PUBKEY}:${dTag}`;

	beforeEach(() => {
		store = new EventStore();
		// Disable signature verification for test events with mock signatures
		store.verifyEvent = () => true;
	});

	it('is retrievable via timeline filter', async () => {
		const template = pledgeBlueprint({
			taskAddress,
			creatorPubkey: CREATOR_PUBKEY,
			amount: 10000,
			cashuToken: 'cashuA_test',
			mintUrl: 'https://mint.test.com'
		});

		const pledgeEvent = signEvent(template, PLEDGER_PUBKEY);

		// Set up timeline subscription before adding
		const eventsPromise = firstValueFrom(
			store.timeline({ kinds: [PLEDGE_KIND], '#a': [taskAddress] }).pipe(skip(1), take(1))
		);

		store.add(pledgeEvent);

		const events = await eventsPromise;
		expect(events).toHaveLength(1);
		expect(events[0].id).toBe(pledgeEvent.id);
		expect(events[0].kind).toBe(PLEDGE_KIND);
	});

	it('parses correctly after retrieval', async () => {
		const template = pledgeBlueprint({
			taskAddress,
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
		expect(pledge.taskAddress).toBe(taskAddress);
		expect(pledge.cashuToken).toBe('cashuA_parsed');
		expect(pledge.mintUrl).toBe('https://mint.test.com');
		expect(pledge.message).toBe('Great project!');
		expect(pledge.pubkey).toBe(PLEDGER_PUBKEY);
	});
});

// ── Status transitions ──────────────────────────────────────────────────────

describe('Task status transitions on pledge', () => {
	it('transitions from draft to open on first pledge', () => {
		const dTag = 'status-transition';
		const taskAddress = `${TASK_KIND}:${CREATOR_PUBKEY}:${dTag}`;
		const taskEvent = makeTaskEvent(dTag);

		// No pledges = draft
		const draftDetail = parseTaskDetail(taskEvent, [], [], [], [], [])!;
		expect(draftDetail.status).toBe('draft');

		// Add first pledge
		const pledgeTemplate = pledgeBlueprint({
			taskAddress,
			creatorPubkey: CREATOR_PUBKEY,
			amount: 10000,
			cashuToken: 'cashuA_first',
			mintUrl: 'https://mint.test.com'
		});
		const pledgeEvent = signEvent(pledgeTemplate, PLEDGER_PUBKEY);

		// With pledge = open
		const openDetail = parseTaskDetail(taskEvent, [pledgeEvent], [], [], [], [])!;
		expect(openDetail.status).toBe('open');
	});

	it('remains open with multiple pledges', () => {
		const dTag = 'multi-pledge';
		const taskAddress = `${TASK_KIND}:${CREATOR_PUBKEY}:${dTag}`;
		const taskEvent = makeTaskEvent(dTag);

		const pledge1 = signEvent(
			pledgeBlueprint({
				taskAddress,
				creatorPubkey: CREATOR_PUBKEY,
				amount: 5000,
				cashuToken: 'cashuA_p1',
				mintUrl: 'https://mint.test.com'
			}),
			PLEDGER_PUBKEY
		);

		const pledge2 = signEvent(
			pledgeBlueprint({
				taskAddress,
				creatorPubkey: CREATOR_PUBKEY,
				amount: 3000,
				cashuToken: 'cashuA_p2',
				mintUrl: 'https://mint.test.com'
			}),
			PLEDGER_2_PUBKEY
		);

		const detail = parseTaskDetail(taskEvent, [pledge1, pledge2], [], [], [], [])!;
		expect(detail.status).toBe('open');
	});
});

// ── totalPledged computation ────────────────────────────────────────────────

describe('totalPledged reflects pledges', () => {
	it('sums all pledge amounts', () => {
		const dTag = 'total-pledged';
		const taskAddress = `${TASK_KIND}:${CREATOR_PUBKEY}:${dTag}`;
		const taskEvent = makeTaskEvent(dTag);

		const pledge1 = signEvent(
			pledgeBlueprint({
				taskAddress,
				creatorPubkey: CREATOR_PUBKEY,
				amount: 10000,
				cashuToken: 'cashuA_t1',
				mintUrl: 'https://mint.test.com'
			}),
			PLEDGER_PUBKEY
		);

		const pledge2 = signEvent(
			pledgeBlueprint({
				taskAddress,
				creatorPubkey: CREATOR_PUBKEY,
				amount: 5000,
				cashuToken: 'cashuA_t2',
				mintUrl: 'https://mint.test.com'
			}),
			PLEDGER_2_PUBKEY
		);

		const pledge3 = signEvent(
			pledgeBlueprint({
				taskAddress,
				creatorPubkey: CREATOR_PUBKEY,
				amount: 2500,
				cashuToken: 'cashuA_t3',
				mintUrl: 'https://mint.test.com'
			}),
			PLEDGER_PUBKEY
		);

		const detail = parseTaskDetail(taskEvent, [pledge1, pledge2, pledge3], [], [], [], [])!;
		expect(detail.totalPledged).toBe(17500);
	});

	it('starts at 0 with no pledges', () => {
		const taskEvent = makeTaskEvent('no-pledges');
		const detail = parseTaskDetail(taskEvent, [], [], [], [], [])!;
		expect(detail.totalPledged).toBe(0);
	});

	it('reflects single pledge amount', () => {
		const dTag = 'single-pledge';
		const taskAddress = `${TASK_KIND}:${CREATOR_PUBKEY}:${dTag}`;
		const taskEvent = makeTaskEvent(dTag);

		const pledge = signEvent(
			pledgeBlueprint({
				taskAddress,
				creatorPubkey: CREATOR_PUBKEY,
				amount: 42000,
				cashuToken: 'cashuA_single',
				mintUrl: 'https://mint.test.com'
			}),
			PLEDGER_PUBKEY
		);

		const detail = parseTaskDetail(taskEvent, [pledge], [], [], [], [])!;
		expect(detail.totalPledged).toBe(42000);
	});
});
