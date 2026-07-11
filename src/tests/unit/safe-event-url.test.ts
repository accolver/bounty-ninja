import { describe, expect, it } from 'vitest';
import { safeEventUrl } from '$lib/utils/safe-event-url';

describe('safeEventUrl', () => {
	it('normalizes HTTPS links', () => {
		expect(safeEventUrl('  HTTPS://Example.COM/path  ', 'external-link')).toBe(
			'https://example.com/path'
		);
	});

	it.each([
		'javascript:alert(1)',
		'JaVaScRiPt:alert(1)',
		'java\nscript:alert(1)',
		'data:text/html,<script>alert(1)</script>',
		'data:image/svg+xml,<svg onload=alert(1)>',
		'blob:https://example.com/id',
		'file:///etc/passwd',
		'vbscript:msgbox(1)',
		'http://example.com',
		'//example.com/path',
		'/relative',
		'https://user:pass@example.com'
	])('rejects unsafe URL %s', (value) => {
		expect(safeEventUrl(value, 'external-link')).toBeNull();
	});

	it('rejects malformed, non-string, and oversized input', () => {
		expect(safeEventUrl('not a url', 'external-link')).toBeNull();
		expect(safeEventUrl(null, 'external-link')).toBeNull();
		expect(safeEventUrl(`https://example.com/${'a'.repeat(2048)}`, 'image')).toBeNull();
	});
});
