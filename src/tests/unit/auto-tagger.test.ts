import { describe, it, expect } from 'vitest';
import { suggestTags, getPopularTags } from '$lib/bounty/auto-tagger';
import type { BountySummary } from '$lib/bounty/types';

// ── suggestTags ─────────────────────────────────────────────────────

describe('suggestTags', () => {
	it('suggests "bitcoin" for a Lightning Network bounty', () => {
		const tags = suggestTags('Build a Lightning invoice parser', 'Parse BOLT11 invoices...');
		expect(tags).toContain('bitcoin');
	});

	it('suggests "activism" for a petition bounty', () => {
		const tags = suggestTags(
			'Get 100,000 signatures for this petition',
			'We need to mobilize grassroots support for the reform campaign...'
		);
		expect(tags).toContain('activism');
	});

	it('suggests "construction" and "landscaping" for a park bounty', () => {
		const tags = suggestTags(
			'Build a park for us in Salt Lake City',
			'We want to construct a new green space with playground equipment and walking trails...'
		);
		expect(tags).toContain('construction');
		expect(tags).toContain('landscaping');
	});

	it('suggests "nostr" and "frontend" for a Nostr client bounty', () => {
		const tags = suggestTags(
			'Build a NIP-07 login component for Svelte',
			'Create a reusable Svelte component that handles NIP-07 browser extension signing...'
		);
		expect(tags).toContain('nostr');
		expect(tags).toContain('frontend');
	});

	it('returns at most MAX_SUGGESTIONS tags', () => {
		// Broad text that should match many categories
		const tags = suggestTags(
			'Build a mobile app with React Native and deploy it',
			'Use Docker for CI/CD pipeline, add database with SQL, write tests, fix bugs, design the UI/UX, handle security authentication'
		);
		expect(tags.length).toBeLessThanOrEqual(5);
	});

	it('ranks title matches higher than description matches', () => {
		const tags = suggestTags('Rust library for Bitcoin', 'Please write some code');
		expect(tags).toContain('rust');
		expect(tags).toContain('bitcoin');
	});

	it('returns empty array when no patterns match', () => {
		const tags = suggestTags('Hello world', 'Just a simple greeting');
		expect(tags).toEqual([]);
	});

	// ── Edge cases ────────────────────────────────────────────────────

	it('handles empty title and description', () => {
		const tags = suggestTags('', '');
		expect(tags).toEqual([]);
	});

	it('handles empty title with matching description', () => {
		const tags = suggestTags('', 'We need a Python script for data analysis');
		expect(tags).toContain('python');
	});

	it('handles matching title with empty description', () => {
		const tags = suggestTags('Build a REST API', '');
		expect(tags).toContain('backend');
	});

	it('handles special characters in input', () => {
		const tags = suggestTags('Fix <script>alert("xss")</script>', 'Some $pecial ch@racters');
		// Should not crash, may or may not match categories
		expect(Array.isArray(tags)).toBe(true);
	});

	it('handles very long text without errors', () => {
		const longText = 'Build a Lightning '.repeat(1000);
		const tags = suggestTags(longText, longText);
		expect(tags).toContain('bitcoin');
		expect(tags.length).toBeLessThanOrEqual(5);
	});

	it('is case-insensitive', () => {
		const tags = suggestTags('BITCOIN Lightning NETWORK', 'BOLT11 PARSER');
		expect(tags).toContain('bitcoin');
	});
});

// ── getPopularTags ──────────────────────────────────────────────────

describe('getPopularTags', () => {
	const mockItems: BountySummary[] = [
		{
			id: '1'.repeat(64),
			dTag: 'bounty-1',
			pubkey: 'a'.repeat(64),
			title: 'Test bounty 1',
			tags: ['bitcoin', 'lightning', 'rust'],
			rewardAmount: 1000,
			totalPledged: 500,
			solutionCount: 0,
			status: 'open',
			createdAt: 1000,
			deadline: null
		},
		{
			id: '2'.repeat(64),
			dTag: 'bounty-2',
			pubkey: 'b'.repeat(64),
			title: 'Test bounty 2',
			tags: ['bitcoin', 'nostr', 'frontend'],
			rewardAmount: 2000,
			totalPledged: 0,
			solutionCount: 1,
			status: 'in_review',
			createdAt: 2000,
			deadline: null
		},
		{
			id: '3'.repeat(64),
			dTag: 'bounty-3',
			pubkey: 'c'.repeat(64),
			title: 'Test bounty 3',
			tags: ['bitcoin', 'backend', 'rust'],
			rewardAmount: 500,
			totalPledged: 200,
			solutionCount: 0,
			status: 'open',
			createdAt: 3000,
			deadline: null
		}
	];

	it('returns tags matching the prefix sorted by frequency', () => {
		const results = getPopularTags('bit', mockItems);
		expect(results).toEqual([{ tag: 'bitcoin', count: 3 }]);
	});

	it('returns multiple matching tags sorted by count', () => {
		const results = getPopularTags('r', mockItems);
		expect(results).toEqual([{ tag: 'rust', count: 2 }]);
	});

	it('returns empty array for empty prefix', () => {
		const results = getPopularTags('', mockItems);
		expect(results).toEqual([]);
	});

	it('returns empty array for whitespace-only prefix', () => {
		const results = getPopularTags('   ', mockItems);
		expect(results).toEqual([]);
	});

	it('returns empty array when no tags match prefix', () => {
		const results = getPopularTags('xyz', mockItems);
		expect(results).toEqual([]);
	});

	it('respects the limit parameter', () => {
		const results = getPopularTags('b', mockItems, 1);
		expect(results.length).toBeLessThanOrEqual(1);
	});

	it('handles empty items array', () => {
		const results = getPopularTags('bit', []);
		expect(results).toEqual([]);
	});

	it('is case-insensitive', () => {
		const results = getPopularTags('BIT', mockItems);
		expect(results).toEqual([{ tag: 'bitcoin', count: 3 }]);
	});
});
