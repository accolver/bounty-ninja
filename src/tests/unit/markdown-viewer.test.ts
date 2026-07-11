import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@milkdown/crepe', () => ({
	CrepeFeature: {
		ImageBlock: 'ImageBlock',
		Latex: 'Latex',
		BlockEdit: 'BlockEdit',
		Toolbar: 'Toolbar',
		Placeholder: 'Placeholder',
		Cursor: 'Cursor'
	},
	Crepe: class {
		root: HTMLElement;
		value: string;

		constructor(options: { root: HTMLElement; defaultValue: string }) {
			this.root = options.root;
			this.value = options.defaultValue;
		}

		async create() {
			this.root.innerHTML = this.value;
		}

		setReadonly() {}
		destroy() {}
	}
}));

const { default: MarkdownViewer } = await import('$lib/components/shared/MarkdownViewer.svelte');

afterEach(() => {
	document.body.replaceChildren();
});

async function renderContent(content: string) {
	const component = mount(MarkdownViewer, { target: document.body, props: { content } });
	await vi.waitFor(() => expect(document.querySelector('.milkdown-viewer-root')).not.toBeNull());
	await vi.waitFor(() =>
		expect(document.querySelector('.milkdown-viewer-root')?.innerHTML).not.toBe('')
	);
	return component;
}

describe('MarkdownViewer sanitization boundary', () => {
	it('removes executable markup before live DOM insertion', async () => {
		const component = await renderContent(
			'<script>alert(1)</script><svg onload="alert(2)"></svg><p onclick="alert(3)">safe</p>'
		);

		expect(document.querySelector('script')).toBeNull();
		expect(document.querySelector('svg')).toBeNull();
		expect(document.querySelector('[onclick]')).toBeNull();
		expect(document.body.textContent).toContain('safe');
		await unmount(component);
	});

	it('removes unsafe URLs and hardens safe links', async () => {
		const component = await renderContent(
			'<a href="javascript:alert(1)">bad</a><a href="https://example.com/path">good</a>'
		);
		const links = document.querySelectorAll('a');

		expect(links).toHaveLength(2);
		expect(links[0].hasAttribute('href')).toBe(false);
		expect(links[1].getAttribute('href')).toBe('https://example.com/path');
		expect(links[1].getAttribute('rel')).toBe('noopener noreferrer');
		await unmount(component);
	});
});
