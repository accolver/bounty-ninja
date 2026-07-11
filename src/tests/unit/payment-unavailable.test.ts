import { mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import PaymentUnavailable from '$lib/components/shared/PaymentUnavailable.svelte';

describe('PaymentUnavailable', () => {
	it('renders an accessible status with the requested action', async () => {
		const component = mount(PaymentUnavailable, {
			target: document.body,
			props: { action: 'Pledging' }
		});
		const status = document.querySelector('[role="status"]');

		expect(status?.getAttribute('aria-live')).toBe('polite');
		expect(status?.textContent).toContain('Pledging temporarily unavailable');
		expect(status?.textContent).toContain('wallet signing and fund-recovery safeguards');

		await unmount(component);
	});
});
