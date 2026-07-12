import { mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/nostr/relay-pool', () => ({
	pool: { relays: new Map() },
	connectDefaultRelays: vi.fn()
}));

import RelayIndicator from '$lib/components/shared/RelayIndicator.svelte';

describe('availability indicator', () => {
	it('shows distinct actionable availability rows', async () => {
		const component = mount(RelayIndicator, { target: document.body });
		const trigger = document.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]');
		trigger?.click();
		await new Promise((resolve) => setTimeout(resolve, 0));

		const dialog = document.querySelector('[aria-label="Availability status"]');
		expect(dialog?.textContent).toContain('Browser');
		expect(dialog?.textContent).toContain('Relays');
		expect(dialog?.textContent).toContain('Mint');
		expect(dialog?.textContent).toContain('Cache');
		expect(dialog?.textContent).toContain('Publishing');
		expect(dialog?.textContent).toContain('Retry');
		expect(dialog?.textContent).toContain('Check');

		await unmount(component);
	});
});
