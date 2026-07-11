import { mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import DeliverableLink from '$lib/components/solution/DeliverableLink.svelte';

describe('DeliverableLink', () => {
	it('renders safe HTTPS URLs with external-link protections', async () => {
		const component = mount(DeliverableLink, {
			target: document.body,
			props: { url: 'https://example.com/work' }
		});
		const link = document.querySelector('a');

		expect(link?.href).toBe('https://example.com/work');
		expect(link?.rel).toBe('noopener noreferrer');
		expect(link?.target).toBe('_blank');
		await unmount(component);
	});

	it('renders unsafe URLs as text without a link', async () => {
		const component = mount(DeliverableLink, {
			target: document.body,
			props: { url: 'javascript:alert(1)' }
		});

		expect(document.querySelector('a')).toBeNull();
		expect(document.body.textContent).toContain('javascript:alert(1)');
		await unmount(component);
	});
});
