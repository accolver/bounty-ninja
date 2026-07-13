import { mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/nostr/relay-pool', () => ({
	pool: {
		relays: new Map([
			['wss://relay-one.example', { connected: true }],
			['wss://relay-two.example', { connected: false }]
		])
	},
	connectDefaultRelays: vi.fn()
}));

import RelayIndicator from '$lib/components/shared/RelayIndicator.svelte';

describe('availability indicator', () => {
	it('shows distinct actionable availability rows', async () => {
		const component = mount(RelayIndicator, { target: document.body });
		const trigger = document.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]');
		trigger?.click();
		await new Promise((resolve) => setTimeout(resolve, 0));

		const dialog = document.querySelector('[role="dialog"]');
		expect(trigger?.textContent).toContain('1/2 connected');
		expect(dialog?.textContent).toContain('Connection details');
		expect(dialog?.textContent).toContain('Browser');
		expect(dialog?.textContent).toContain('wss://relay-one.example');
		expect(dialog?.textContent).toContain('wss://relay-two.example');
		expect(dialog?.textContent).toContain('Connected');
		expect(dialog?.textContent).toContain('Disconnected');
		expect(dialog?.textContent).toContain('Mint');
		expect(dialog?.textContent).toContain('Cache');
		expect(dialog?.textContent).toContain('Publishing');
		expect(dialog?.textContent).toContain('Retry');
		expect(dialog?.textContent).toContain('Check');

		await unmount(component);
	});
});
