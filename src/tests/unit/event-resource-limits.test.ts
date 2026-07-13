import { describe, expect, it } from 'vitest';
import type { NostrEvent } from 'nostr-tools';
import { validateEventResources } from '$lib/nostr/tag-validator';

function event(overrides: Partial<NostrEvent> = {}): NostrEvent {
	return {
		id: 'a'.repeat(64),
		pubkey: 'b'.repeat(64),
		created_at: 1,
		kind: 37300,
		content: 'Description',
		tags: [
			['d', 'bounty'],
			['title', 'Title'],
			['reward', '100'],
			['client', 'bounty.ninja']
		],
		sig: 'c'.repeat(128),
		...overrides
	};
}

describe('validateEventResources', () => {
	it('accepts a bounded domain event with the required client namespace', () => {
		expect(validateEventResources(event())).toEqual({ valid: true, errors: [] });
	});

	it('rejects unsupported kinds', () => {
		const result = validateEventResources(event({ kind: 1 }));
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Unsupported event kind: 1');
	});

	it('rejects oversized content before parsing', () => {
		const result = validateEventResources(event({ content: 'x'.repeat(50_001) }));
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Content exceeds 50000 characters');
	});

	it('rejects excessive tags, arity, and regular tag values', () => {
		const tags = Array.from({ length: 33 }, (_, index) => ['t', String(index)]);
		tags[0] = ['t', 'x'.repeat(2_049), 'a', 'b', 'c'];
		const result = validateEventResources(event({ tags }));
		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				'Tag count exceeds 32',
				'Tag arity must be between 1 and 4',
				"Tag 't' value exceeds 2048 characters"
			])
		);
	});

	it('permits a bounded Cashu token but rejects oversized tokens', () => {
		const baseTags = [
			['a', `37300:${'b'.repeat(64)}:bounty`],
			['amount', '100'],
			['mint', 'https://mint.example'],
			['client', 'bounty.ninja']
		];
		expect(
			validateEventResources(
				event({ kind: 7302, content: '', tags: [...baseTags, ['cashu', 'x'.repeat(262_144)]] })
			).valid
		).toBe(true);
		expect(
			validateEventResources(
				event({ kind: 7302, content: '', tags: [...baseTags, ['cashu', 'x'.repeat(262_145)]] })
			).valid
		).toBe(false);
	});

	it('rejects duplicate singleton tags and excessive related token tags', () => {
		const result = validateEventResources(
			event({
				kind: 7301,
				tags: [
					['client', 'bounty.ninja'],
					['r', 'https://one.example'],
					['r', 'https://two.example'],
					...Array.from({ length: 17 }, () => ['cashu', 'token'])
				]
			})
		);
		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining(["Tag 'r' must not be repeated", "Too many 'cashu' tags"])
		);
	});

	it('rejects missing or foreign client namespaces', () => {
		expect(validateEventResources(event({ tags: [] })).valid).toBe(false);
		expect(validateEventResources(event({ tags: [['client', 'another-client']] })).valid).toBe(
			false
		);
	});
});
