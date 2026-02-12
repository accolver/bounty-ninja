// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '$lib/utils/sanitize';

describe('sanitizeHtml', () => {
	// ── XSS Prevention ────────────────────────────────────────────────────

	describe('XSS prevention', () => {
		it('strips <script> tags completely', () => {
			const input = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
			const result = sanitizeHtml(input);
			expect(result).not.toContain('<script');
			expect(result).not.toContain('alert');
			expect(result).toContain('<p>Hello</p>');
			expect(result).toContain('<p>World</p>');
		});

		it('strips onerror attribute from img tags', () => {
			const input = '<img src="x" onerror="alert(\'xss\')">';
			const result = sanitizeHtml(input);
			expect(result).not.toContain('onerror');
			expect(result).not.toContain('alert');
		});

		it('neutralizes javascript: protocol in links', () => {
			const input = '<a href="javascript:alert(\'xss\')">Click me</a>';
			const result = sanitizeHtml(input);
			expect(result).not.toContain('javascript:');
		});

		it('removes <iframe> tags', () => {
			const input = '<iframe src="https://evil.com"></iframe>';
			const result = sanitizeHtml(input);
			expect(result).not.toContain('<iframe');
			expect(result).not.toContain('</iframe');
		});

		it('removes data-* attributes', () => {
			const input = '<p data-evil="payload" data-track="user123">Text</p>';
			const result = sanitizeHtml(input);
			expect(result).not.toContain('data-evil');
			expect(result).not.toContain('data-track');
			expect(result).toContain('Text');
		});

		it('strips <style> tags', () => {
			const input = '<style>body { background: red; }</style><p>Content</p>';
			const result = sanitizeHtml(input);
			expect(result).not.toContain('<style');
			expect(result).not.toContain('background');
			expect(result).toContain('<p>Content</p>');
		});

		it('strips onclick event handler attribute', () => {
			const input = '<p onclick="alert(\'xss\')">Click me</p>';
			const result = sanitizeHtml(input);
			expect(result).not.toContain('onclick');
			expect(result).toContain('Click me');
		});

		it('strips onmouseover event handler attribute', () => {
			const input = '<p onmouseover="alert(\'xss\')">Hover me</p>';
			const result = sanitizeHtml(input);
			expect(result).not.toContain('onmouseover');
		});

		it('strips onload event handler attribute', () => {
			const input = '<img src="x.png" onload="alert(\'xss\')">';
			const result = sanitizeHtml(input);
			expect(result).not.toContain('onload');
		});

		it('removes <object> tags', () => {
			const input = '<object data="evil.swf"></object>';
			const result = sanitizeHtml(input);
			expect(result).not.toContain('<object');
		});

		it('removes <embed> tags', () => {
			const input = '<embed src="evil.swf">';
			const result = sanitizeHtml(input);
			expect(result).not.toContain('<embed');
		});

		it('removes <form> tags', () => {
			const input = '<form action="https://evil.com"><input type="text"></form>';
			const result = sanitizeHtml(input);
			expect(result).not.toContain('<form');
			expect(result).not.toContain('<input');
		});
	});

	// ── Legitimate Markdown HTML ────────────────────────────────────────────

	describe('legitimate markdown HTML passes through', () => {
		it('preserves heading tags', () => {
			const input = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';
			const result = sanitizeHtml(input);
			expect(result).toContain('<h1>Title</h1>');
			expect(result).toContain('<h2>Subtitle</h2>');
			expect(result).toContain('<h3>Section</h3>');
		});

		it('preserves bold and italic', () => {
			const input = '<strong>bold</strong> and <em>italic</em>';
			const result = sanitizeHtml(input);
			expect(result).toContain('<strong>bold</strong>');
			expect(result).toContain('<em>italic</em>');
		});

		it('preserves code blocks', () => {
			const input = '<pre><code>const x = 1;</code></pre>';
			const result = sanitizeHtml(input);
			expect(result).toContain('<pre>');
			expect(result).toContain('<code>');
			expect(result).toContain('const x = 1;');
		});

		it('preserves inline code', () => {
			const input = 'Use <code>bun run</code> to start.';
			const result = sanitizeHtml(input);
			expect(result).toContain('<code>bun run</code>');
		});

		it('preserves links with href, target, and rel', () => {
			const input = '<a href="https://example.com" target="_blank" rel="noopener">Link</a>';
			const result = sanitizeHtml(input);
			expect(result).toContain('href="https://example.com"');
			expect(result).toContain('target="_blank"');
			expect(result).toContain('rel="noopener noreferrer"');
			expect(result).toContain('Link</a>');
		});

		it('preserves images with src and alt', () => {
			const input = '<img src="https://example.com/img.png" alt="Screenshot">';
			const result = sanitizeHtml(input);
			expect(result).toContain('src="https://example.com/img.png"');
			expect(result).toContain('alt="Screenshot"');
		});

		it('preserves unordered lists', () => {
			const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
			const result = sanitizeHtml(input);
			expect(result).toContain('<ul>');
			expect(result).toContain('<li>Item 1</li>');
			expect(result).toContain('<li>Item 2</li>');
		});

		it('preserves ordered lists', () => {
			const input = '<ol><li>First</li><li>Second</li></ol>';
			const result = sanitizeHtml(input);
			expect(result).toContain('<ol>');
			expect(result).toContain('<li>First</li>');
		});

		it('preserves tables', () => {
			const input =
				'<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>';
			const result = sanitizeHtml(input);
			expect(result).toContain('<table>');
			expect(result).toContain('<thead>');
			expect(result).toContain('<th>Header</th>');
			expect(result).toContain('<td>Cell</td>');
		});

		it('preserves blockquotes', () => {
			const input = '<blockquote>A wise quote</blockquote>';
			const result = sanitizeHtml(input);
			expect(result).toContain('<blockquote>A wise quote</blockquote>');
		});

		it('preserves <br> and <hr> tags', () => {
			const input = '<p>Line 1<br>Line 2</p><hr>';
			const result = sanitizeHtml(input);
			expect(result).toContain('<br>');
			expect(result).toContain('<hr>');
		});

		it('preserves <del> (strikethrough)', () => {
			const input = '<del>removed text</del>';
			const result = sanitizeHtml(input);
			expect(result).toContain('<del>removed text</del>');
		});

		it('preserves <details> and <summary>', () => {
			const input = '<details><summary>More info</summary><p>Details here</p></details>';
			const result = sanitizeHtml(input);
			expect(result).toContain('<details>');
			expect(result).toContain('<summary>More info</summary>');
		});

		it('preserves class and id attributes', () => {
			const input = '<p class="highlight" id="intro">Text</p>';
			const result = sanitizeHtml(input);
			expect(result).toContain('class="highlight"');
			expect(result).toContain('id="intro"');
		});
	});

	// ── Edge Cases ──────────────────────────────────────────────────────────

	describe('edge cases', () => {
		it('returns empty string for empty input', () => {
			expect(sanitizeHtml('')).toBe('');
		});

		it('returns plain text unchanged', () => {
			expect(sanitizeHtml('Just plain text')).toBe('Just plain text');
		});

		it('handles nested malicious content', () => {
			const input = '<p><a href="https://ok.com" onclick="alert(1)">Link</a></p>';
			const result = sanitizeHtml(input);
			expect(result).toContain('href="https://ok.com"');
			expect(result).not.toContain('onclick');
		});
	});
});
