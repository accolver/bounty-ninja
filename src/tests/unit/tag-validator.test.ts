import { describe, it, expect, vi } from 'vitest';
import type { NostrEvent } from 'nostr-tools';
import { validateEventTags } from '$lib/nostr/tag-validator';

// Suppress console.warn from the validator during tests
vi.spyOn(console, 'warn').mockImplementation(() => {});

const HEX_PUBKEY = 'b'.repeat(64);
const HEX_EVENT_ID = 'a'.repeat(64);
const VALID_A_TAG = `37300:${HEX_PUBKEY}:my-task`;
const VALID_MINT_URL = 'https://mint.example.com';

/** Helper to create a mock NostrEvent with the given kind and tags. */
function makeEvent(kind: number, tags: string[][], content = ''): NostrEvent {
	return {
		id: HEX_EVENT_ID,
		pubkey: HEX_PUBKEY,
		kind,
		created_at: Math.floor(Date.now() / 1000),
		content,
		tags,
		sig: 'c'.repeat(128)
	};
}

// ── Kind 37300 — Task ─────────────────────────────────────────────────────

describe('validateEventTags — Kind 37300 (Task)', () => {
	it('rejects task missing d tag', () => {
		const event = makeEvent(37300, [
			['title', 'Fix the bug'],
			['reward', '1000']
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("'d' tag"));
	});

	it('rejects task missing title and subject', () => {
		const event = makeEvent(37300, [
			['d', 'task-1'],
			['reward', '1000']
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("'title' or 'subject'"));
	});

	it('rejects task with invalid reward (non-positive integer)', () => {
		const event = makeEvent(37300, [
			['d', 'task-1'],
			['title', 'Fix the bug'],
			['reward', '-5']
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining('positive integer'));
	});

	it('rejects task with zero reward', () => {
		const event = makeEvent(37300, [
			['d', 'task-1'],
			['title', 'Fix the bug'],
			['reward', '0']
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining('positive integer'));
	});

	it('rejects task with non-numeric reward', () => {
		const event = makeEvent(37300, [
			['d', 'task-1'],
			['title', 'Fix the bug'],
			['reward', 'abc']
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
	});

	it('rejects task missing reward tag entirely', () => {
		const event = makeEvent(37300, [
			['d', 'task-1'],
			['title', 'Fix the bug']
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("'reward' tag"));
	});

	it('accepts valid task with title', () => {
		const event = makeEvent(37300, [
			['d', 'task-1'],
			['title', 'Fix the bug'],
			['reward', '1000']
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('accepts valid task with subject instead of title', () => {
		const event = makeEvent(37300, [
			['d', 'task-1'],
			['subject', 'Fix the bug'],
			['reward', '500']
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});
});

// ── Kind 73002 — Pledge ─────────────────────────────────────────────────────

describe('validateEventTags — Kind 73002 (Pledge)', () => {
	it('rejects pledge missing a tag', () => {
		const event = makeEvent(73002, [
			['amount', '100'],
			['cashu', 'cashuAtoken123'],
			['mint', VALID_MINT_URL]
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("'a' tag"));
	});

	it('rejects pledge with invalid a tag format', () => {
		const event = makeEvent(73002, [
			['a', 'invalid-format'],
			['amount', '100'],
			['cashu', 'cashuAtoken123'],
			['mint', VALID_MINT_URL]
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining('invalid format'));
	});

	it('rejects pledge with a tag pointing to wrong kind', () => {
		const event = makeEvent(73002, [
			['a', `1:${HEX_PUBKEY}:some-id`],
			['amount', '100'],
			['cashu', 'cashuAtoken123'],
			['mint', VALID_MINT_URL]
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
	});

	it('rejects pledge missing amount tag', () => {
		const event = makeEvent(73002, [
			['a', VALID_A_TAG],
			['cashu', 'cashuAtoken123'],
			['mint', VALID_MINT_URL]
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("'amount' tag"));
	});

	it('rejects pledge with empty cashu tag', () => {
		const event = makeEvent(73002, [
			['a', VALID_A_TAG],
			['amount', '100'],
			['cashu', ''],
			['mint', VALID_MINT_URL]
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("'cashu' tag"));
	});

	it('rejects pledge missing cashu tag', () => {
		const event = makeEvent(73002, [
			['a', VALID_A_TAG],
			['amount', '100'],
			['mint', VALID_MINT_URL]
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("'cashu' tag"));
	});

	it('rejects pledge with invalid mint URL', () => {
		const event = makeEvent(73002, [
			['a', VALID_A_TAG],
			['amount', '100'],
			['cashu', 'cashuAtoken123'],
			['mint', 'not-a-url']
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("'mint' tag must be a valid URL"));
	});

	it('rejects pledge missing mint tag', () => {
		const event = makeEvent(73002, [
			['a', VALID_A_TAG],
			['amount', '100'],
			['cashu', 'cashuAtoken123']
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("'mint' tag"));
	});

	it('accepts valid pledge event', () => {
		const event = makeEvent(73002, [
			['a', VALID_A_TAG],
			['amount', '100'],
			['cashu', 'cashuAtoken123'],
			['mint', VALID_MINT_URL]
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});
});

// ── Kind 73001 — Solution ───────────────────────────────────────────────────

describe('validateEventTags — Kind 73001 (Solution)', () => {
	it('rejects solution missing a tag', () => {
		const event = makeEvent(73001, [], 'My solution content');
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("'a' tag"));
	});

	it('rejects solution with invalid a tag format', () => {
		const event = makeEvent(73001, [['a', 'bad-format']], 'My solution content');
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining('invalid format'));
	});

	it('rejects solution with empty content', () => {
		const event = makeEvent(73001, [['a', VALID_A_TAG]], '');
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining('non-empty content'));
	});

	it('rejects solution with whitespace-only content', () => {
		const event = makeEvent(73001, [['a', VALID_A_TAG]], '   \n\t  ');
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining('non-empty content'));
	});

	it('accepts valid solution event', () => {
		const event = makeEvent(73001, [['a', VALID_A_TAG]], 'Here is my solution.');
		const result = validateEventTags(event);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});
});

// ── Kind 1018 — Vote ────────────────────────────────────────────────────────

describe('validateEventTags — Kind 1018 (Vote)', () => {
	it('rejects vote missing a tag', () => {
		const event = makeEvent(1018, [
			['e', HEX_EVENT_ID],
			['vote', 'approve']
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("'a' tag"));
	});

	it('rejects vote missing e tag', () => {
		const event = makeEvent(1018, [
			['a', VALID_A_TAG],
			['vote', 'approve']
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("'e' tag"));
	});

	it('rejects vote with invalid e tag (not 64-char hex)', () => {
		const event = makeEvent(1018, [
			['a', VALID_A_TAG],
			['e', 'short-hex'],
			['vote', 'approve']
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining('valid event ID'));
	});

	it('rejects vote with invalid vote value', () => {
		const event = makeEvent(1018, [
			['a', VALID_A_TAG],
			['e', HEX_EVENT_ID],
			['vote', 'maybe']
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("'approve' or 'reject'"));
	});

	it('rejects vote missing vote tag', () => {
		const event = makeEvent(1018, [
			['a', VALID_A_TAG],
			['e', HEX_EVENT_ID]
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("'vote' tag"));
	});

	it('accepts valid approve vote', () => {
		const event = makeEvent(1018, [
			['a', VALID_A_TAG],
			['e', HEX_EVENT_ID],
			['vote', 'approve']
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('accepts valid reject vote', () => {
		const event = makeEvent(1018, [
			['a', VALID_A_TAG],
			['e', HEX_EVENT_ID],
			['vote', 'reject']
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});
});

// ── Kind 73004 — Payout ─────────────────────────────────────────────────────

describe('validateEventTags — Kind 73004 (Payout)', () => {
	it('rejects payout missing a tag', () => {
		const event = makeEvent(73004, [
			['e', HEX_EVENT_ID],
			['p', HEX_PUBKEY]
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("'a' tag"));
	});

	it('rejects payout missing e tag', () => {
		const event = makeEvent(73004, [
			['a', VALID_A_TAG],
			['p', HEX_PUBKEY]
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("'e' tag"));
	});

	it('rejects payout with invalid e tag', () => {
		const event = makeEvent(73004, [
			['a', VALID_A_TAG],
			['e', 'not-hex'],
			['p', HEX_PUBKEY]
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining('valid event ID'));
	});

	it('rejects payout missing p tag', () => {
		const event = makeEvent(73004, [
			['a', VALID_A_TAG],
			['e', HEX_EVENT_ID]
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining("'p' tag"));
	});

	it('rejects payout with invalid p tag (not 64-char hex)', () => {
		const event = makeEvent(73004, [
			['a', VALID_A_TAG],
			['e', HEX_EVENT_ID],
			['p', 'short']
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(expect.stringContaining('valid pubkey'));
	});

	it('accepts valid payout event', () => {
		const event = makeEvent(73004, [
			['a', VALID_A_TAG],
			['e', HEX_EVENT_ID],
			['p', HEX_PUBKEY]
		]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});
});

// ── Unknown Kinds ───────────────────────────────────────────────────────────

describe('validateEventTags — Unknown kinds', () => {
	it('passes validation for kind 1 (text note) with no tags', () => {
		const event = makeEvent(1, []);
		const result = validateEventTags(event);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('passes validation for kind 0 (metadata) with no tags', () => {
		const event = makeEvent(0, []);
		const result = validateEventTags(event);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('passes validation for arbitrary unknown kind', () => {
		const event = makeEvent(99999, [['random', 'tag']]);
		const result = validateEventTags(event);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});
});
