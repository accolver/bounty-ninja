import { describe, it, expect, vi } from 'vitest';
import type { NostrEvent } from 'nostr-tools';

// Mock env before importing helpers (which transitively imports voting → env)
vi.mock('$lib/utils/env', () => ({
	getVoteQuorumFraction: () => 0.66
}));

import { parseRetraction, parseReputationEvent } from '$lib/bounty/helpers';
import { retractionBlueprint, reputationBlueprint } from '$lib/bounty/blueprints';
import { RETRACTION_KIND, REPUTATION_KIND } from '$lib/bounty/kinds';

const PUBKEY_A = 'a'.repeat(64);
const PUBKEY_B = 'b'.repeat(64);
const EVENT_ID_1 = '1'.repeat(64);
const SIG = 'c'.repeat(128);
const VALID_TASK_ADDR = `37300:${PUBKEY_B}:bounty-123`;

function mockEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
	return {
		id: PUBKEY_A,
		pubkey: PUBKEY_B,
		created_at: Math.floor(Date.now() / 1000),
		kind: RETRACTION_KIND,
		tags: [],
		content: '',
		sig: SIG,
		...overrides
	};
}

describe('parseRetraction', () => {
	it('parses a valid bounty retraction', () => {
		const event = mockEvent({
			kind: RETRACTION_KIND,
			tags: [
				['a', VALID_TASK_ADDR],
				['type', 'bounty'],
				['p', PUBKEY_A]
			],
			content: 'Changed my mind'
		});
		const result = parseRetraction(event);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('bounty');
		expect(result!.taskAddress).toBe(VALID_TASK_ADDR);
		expect(result!.reason).toBe('Changed my mind');
		expect(result!.pledgeEventId).toBeNull();
	});

	it('parses a valid pledge retraction', () => {
		const event = mockEvent({
			kind: RETRACTION_KIND,
			tags: [
				['a', VALID_TASK_ADDR],
				['type', 'pledge'],
				['e', EVENT_ID_1],
				['p', PUBKEY_A]
			]
		});
		const result = parseRetraction(event);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('pledge');
		expect(result!.pledgeEventId).toBe(EVENT_ID_1);
	});

	it('returns null for missing type tag', () => {
		const event = mockEvent({
			tags: [['a', VALID_TASK_ADDR]]
		});
		expect(parseRetraction(event)).toBeNull();
	});

	it('returns null for missing a tag', () => {
		const event = mockEvent({
			tags: [['type', 'bounty']]
		});
		expect(parseRetraction(event)).toBeNull();
	});

	it('returns null for pledge retraction without e tag', () => {
		const event = mockEvent({
			tags: [
				['a', VALID_TASK_ADDR],
				['type', 'pledge']
			]
		});
		expect(parseRetraction(event)).toBeNull();
	});

	it('returns null for invalid type value', () => {
		const event = mockEvent({
			tags: [
				['a', VALID_TASK_ADDR],
				['type', 'invalid']
			]
		});
		expect(parseRetraction(event)).toBeNull();
	});
});

describe('parseReputationEvent', () => {
	it('parses a valid bounty_retraction reputation event', () => {
		const event = mockEvent({
			kind: REPUTATION_KIND,
			tags: [
				['p', PUBKEY_A],
				['a', VALID_TASK_ADDR],
				['type', 'bounty_retraction'],
				['e', EVENT_ID_1]
			],
			content: 'Cancelled bounty after solutions submitted'
		});
		const result = parseReputationEvent(event);
		expect(result).not.toBeNull();
		expect(result!.offenderPubkey).toBe(PUBKEY_A);
		expect(result!.type).toBe('bounty_retraction');
		expect(result!.retractionEventId).toBe(EVENT_ID_1);
	});

	it('parses a valid pledge_retraction reputation event', () => {
		const event = mockEvent({
			kind: REPUTATION_KIND,
			tags: [
				['p', PUBKEY_A],
				['a', VALID_TASK_ADDR],
				['type', 'pledge_retraction'],
				['e', EVENT_ID_1]
			]
		});
		const result = parseReputationEvent(event);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('pledge_retraction');
	});

	it('returns null for missing p tag', () => {
		const event = mockEvent({
			kind: REPUTATION_KIND,
			tags: [
				['a', VALID_TASK_ADDR],
				['type', 'bounty_retraction'],
				['e', EVENT_ID_1]
			]
		});
		expect(parseReputationEvent(event)).toBeNull();
	});

	it('returns null for missing a tag', () => {
		const event = mockEvent({
			kind: REPUTATION_KIND,
			tags: [
				['p', PUBKEY_A],
				['type', 'bounty_retraction'],
				['e', EVENT_ID_1]
			]
		});
		expect(parseReputationEvent(event)).toBeNull();
	});

	it('returns null for missing e tag', () => {
		const event = mockEvent({
			kind: REPUTATION_KIND,
			tags: [
				['p', PUBKEY_A],
				['a', VALID_TASK_ADDR],
				['type', 'bounty_retraction']
			]
		});
		expect(parseReputationEvent(event)).toBeNull();
	});

	it('returns null for invalid type', () => {
		const event = mockEvent({
			kind: REPUTATION_KIND,
			tags: [
				['p', PUBKEY_A],
				['a', VALID_TASK_ADDR],
				['type', 'unknown'],
				['e', EVENT_ID_1]
			]
		});
		expect(parseReputationEvent(event)).toBeNull();
	});
});

describe('retractionBlueprint', () => {
	it('creates correct bounty retraction event', () => {
		const template = retractionBlueprint({
			taskAddress: VALID_TASK_ADDR,
			type: 'bounty',
			creatorPubkey: PUBKEY_A,
			reason: 'No longer needed'
		});
		expect(template.kind).toBe(RETRACTION_KIND);
		expect(template.content).toBe('No longer needed');
		expect(template.tags).toContainEqual(['a', VALID_TASK_ADDR]);
		expect(template.tags).toContainEqual(['type', 'bounty']);
		expect(template.tags).toContainEqual(['p', PUBKEY_A]);
		expect(template.tags).toContainEqual(['client', 'bounty.ninja']);
		// No 'e' tag for bounty retractions
		expect(template.tags.find((t) => t[0] === 'e')).toBeUndefined();
	});

	it('creates correct pledge retraction event with e tag', () => {
		const template = retractionBlueprint({
			taskAddress: VALID_TASK_ADDR,
			type: 'pledge',
			pledgeEventId: EVENT_ID_1,
			creatorPubkey: PUBKEY_A
		});
		expect(template.kind).toBe(RETRACTION_KIND);
		expect(template.tags).toContainEqual(['type', 'pledge']);
		expect(template.tags).toContainEqual(['e', EVENT_ID_1]);
	});

	it('defaults content to empty string when no reason provided', () => {
		const template = retractionBlueprint({
			taskAddress: VALID_TASK_ADDR,
			type: 'bounty',
			creatorPubkey: PUBKEY_A
		});
		expect(template.content).toBe('');
	});
});

describe('reputationBlueprint', () => {
	it('creates correct reputation event', () => {
		const template = reputationBlueprint({
			offenderPubkey: PUBKEY_A,
			taskAddress: VALID_TASK_ADDR,
			type: 'bounty_retraction',
			retractionEventId: EVENT_ID_1,
			description: 'Cancelled with 3 solutions'
		});
		expect(template.kind).toBe(REPUTATION_KIND);
		expect(template.content).toBe('Cancelled with 3 solutions');
		expect(template.tags).toContainEqual(['p', PUBKEY_A]);
		expect(template.tags).toContainEqual(['a', VALID_TASK_ADDR]);
		expect(template.tags).toContainEqual(['type', 'bounty_retraction']);
		expect(template.tags).toContainEqual(['e', EVENT_ID_1]);
		expect(template.tags).toContainEqual(['client', 'bounty.ninja']);
	});

	it('defaults content to empty string', () => {
		const template = reputationBlueprint({
			offenderPubkey: PUBKEY_A,
			taskAddress: VALID_TASK_ADDR,
			type: 'pledge_retraction',
			retractionEventId: EVENT_ID_1
		});
		expect(template.content).toBe('');
	});
});
