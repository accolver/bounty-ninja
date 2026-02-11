import { describe, it, expect } from 'vitest';
import { formatSats, formatDate, formatNpub, formatHex } from '$lib/utils/format';

describe('formatSats', () => {
	it('formats zero sats', () => {
		expect(formatSats(0)).toBe('0 sats');
	});

	it('formats small amounts', () => {
		expect(formatSats(100)).toContain('100');
		expect(formatSats(100)).toContain('sats');
	});

	it('formats large amounts with separators', () => {
		const result = formatSats(50000);
		expect(result).toContain('sats');
		// The locale-aware separator varies, but the number should be present
		expect(result).toMatch(/50[,.]?000/);
	});
});

describe('formatDate', () => {
	it('formats a Unix timestamp to readable date', () => {
		// 2024-02-11 00:00:00 UTC
		const timestamp = 1707609600;
		const result = formatDate(timestamp);
		expect(result).toContain('2024');
		expect(result).toContain('Feb');
	});

	it('formats another timestamp correctly', () => {
		// Use a mid-day timestamp to avoid timezone boundary issues
		// 2023-06-15 12:00:00 UTC
		const timestamp = 1686830400;
		const result = formatDate(timestamp);
		expect(result).toContain('2023');
		expect(result).toContain('Jun');
	});
});

describe('formatNpub', () => {
	it('truncates a long npub', () => {
		const npub = 'npub1abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvw';
		const result = formatNpub(npub);
		expect(result).toMatch(/^npub1abc.*uvw$/);
		expect(result.length).toBeLessThan(npub.length);
	});

	it('returns short npub unchanged', () => {
		const short = 'npub1abc';
		expect(formatNpub(short)).toBe(short);
	});
});

describe('formatHex', () => {
	it('truncates a long hex string', () => {
		const hex = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
		const result = formatHex(hex);
		expect(result).toContain('...');
		expect(result.length).toBeLessThan(hex.length);
	});

	it('returns short hex unchanged', () => {
		const short = 'abcdef';
		expect(formatHex(short)).toBe(short);
	});
});
