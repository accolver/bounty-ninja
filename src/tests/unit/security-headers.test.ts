import { describe, expect, it } from 'vitest';

const files = import.meta.glob(['/static/_headers', '/src/app.html', '/static/theme-init.js'], {
	eager: true,
	import: 'default',
	query: '?raw'
}) as Record<string, string>;
const headers = files['/static/_headers'];
const appHtml = files['/src/app.html'];
const themeScript = files['/static/theme-init.js'];

describe('production browser security policy', () => {
	it('blocks inline script attributes and dangerous embedding capabilities', () => {
		expect(headers).toContain("script-src-attr 'none'");
		expect(headers).toContain("object-src 'none'");
		expect(headers).toContain("frame-ancestors 'none'");
		expect(headers).toContain("base-uri 'self'");
	});

	it('requires revalidation for navigation, service worker, and theme bootstrap', () => {
		expect(headers).toMatch(/\/\*\s+Cache-Control: no-cache, must-revalidate/);
		expect(headers).toMatch(
			/\/service-worker\.js\s+Cache-Control: no-cache, no-store, must-revalidate/
		);
		expect(headers).toMatch(/\/theme-init\.js\s+Cache-Control: no-cache, must-revalidate/);
		expect(headers).toMatch(
			/\/_app\/immutable\/\*\s+Cache-Control: public, max-age=31536000, immutable/
		);
	});

	it('authorizes the theme bootstrap as a same-origin external script', () => {
		expect(appHtml).toContain('<script src="%sveltekit.assets%/theme-init.js"></script>');
		const scriptTags = appHtml.match(/<script\b[^>]*>/g) ?? [];
		expect(scriptTags).not.toHaveLength(0);
		expect(scriptTags.every((tag) => /\ssrc=/.test(tag))).toBe(true);
		expect(themeScript).toContain("localStorage.getItem('bounty.ninja:theme')");
		expect(themeScript).not.toMatch(/\beval\s*\(|\bFunction\s*\(/);
	});
});
