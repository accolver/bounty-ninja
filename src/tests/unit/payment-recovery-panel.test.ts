import { describe, expect, it } from 'vitest';

const modules = import.meta.glob(
	['/src/lib/components/payment/PaymentRecoveryPanel.svelte', '/src/routes/+layout.svelte'],
	{ eager: true, import: 'default', query: '?raw' }
) as Record<string, string>;

describe('PaymentRecoveryPanel', () => {
	it('is mounted globally and has no ordinary dismiss control', () => {
		expect(modules['/src/routes/+layout.svelte']).toContain('<PaymentRecoveryPanel />');
		const source = modules['/src/lib/components/payment/PaymentRecoveryPanel.svelte'];
		expect(source).toContain('This notice cannot be dismissed normally.');
		expect(source).not.toMatch(/>Dismiss<|close\(/);
	});

	it('requires export and explicit bearer-value acknowledgement before hiding', () => {
		const source = modules['/src/lib/components/payment/PaymentRecoveryPanel.svelte'];
		expect(source).toContain('Export recovery file');
		expect(source).toContain('accept responsibility for its bearer value');
		expect(source).toContain(
			'disabled={!exportedIds.has(operation.id) || !acknowledgedIds.has(operation.id)}'
		);
	});
});
