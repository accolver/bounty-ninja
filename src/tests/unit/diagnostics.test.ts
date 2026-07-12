import { describe, expect, it } from 'vitest';
import {
	browserFamily,
	createDiagnosticExport,
	routeCategory,
	sanitizeDiagnosticText
} from '$lib/diagnostics';

describe('privacy-preserving diagnostics', () => {
	it('fully redacts identity, bearer, and URL material', () => {
		const sensitive = [
			'a'.repeat(64),
			`npub1${'q'.repeat(58)}`,
			'cashuBeyJ0b2tlbiI6InNlY3JldCJ9',
			'https://relay.example/path?token=secret',
			'wss://relay.example/private?auth=secret'
		].join(' ');
		const sanitized = sanitizeDiagnosticText(sensitive);
		expect(sanitized).not.toContain('aaaaaaaa');
		expect(sanitized).not.toContain('npub1');
		expect(sanitized).not.toContain('cashuB');
		expect(sanitized).not.toContain('relay.example');
	});

	it('exports only bounded categories and coarse failure classes', () => {
		const secret = `cashuBsecret ${'b'.repeat(64)} event content`;
		const diagnostics = createDiagnosticExport([{ timestamp: 1, type: 'error', message: secret }], {
			releaseId: 'c'.repeat(40),
			pathname: '/bounty/private-address',
			userAgent: 'Mozilla/5.0 Chrome/120.0',
			now: new Date('2026-01-01T00:00:00Z')
		});
		const serialized = JSON.stringify(diagnostics);
		expect(diagnostics.routeCategory).toBe('bounty');
		expect(diagnostics.browserFamily).toBe('chromium');
		expect(diagnostics.errorCounts.error).toBe(1);
		expect(serialized).not.toContain(secret);
		expect(serialized).not.toContain('private-address');
	});

	it('categorizes routes and browser families without retaining raw values', () => {
		expect(routeCategory('/profile/npub-secret')).toBe('profile');
		expect(routeCategory('/unknown/value')).toBe('other');
		expect(browserFamily('Mozilla Firefox/120')).toBe('firefox');
		expect(browserFamily('Mozilla AppleWebKit/605.1 Safari/605.1')).toBe('webkit');
	});
});
