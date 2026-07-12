import { describe, expect, it } from 'vitest';

const files = import.meta.glob(
	[
		'/src/service-worker.ts',
		'/src/lib/components/layout/ServiceWorkerUpdate.svelte',
		'/src/routes/+layout.svelte'
	],
	{ eager: true, import: 'default', query: '?raw' }
) as Record<string, string>;

describe('service worker repository policy', () => {
	it('serves the cached SPA shell for failed same-origin navigations', () => {
		const source = files['/src/service-worker.ts'];
		expect(source).toContain("const APP_SHELL = '/index.html'");
		expect(source).toContain("event.request.mode === 'navigate'");
		expect(source).toContain('caches.match(APP_SHELL)');
	});

	it('activates updates only through the compatibility message protocol', () => {
		const source = files['/src/service-worker.ts'];
		expect(source).toContain("message?.type === 'ACTIVATE_UPDATE'");
		expect(source).toContain('supportsPendingPaymentSchemas(');
		expect(source.match(/self\.skipWaiting\(\)/g)).toHaveLength(1);
	});

	it('mounts an explicit update and recovery-safe activation control globally', () => {
		expect(files['/src/routes/+layout.svelte']).toContain('<ServiceWorkerUpdate />');
		const component = files['/src/lib/components/layout/ServiceWorkerUpdate.svelte'];
		expect(component).toContain('Update and reload');
		expect(component).toContain('Update blocked to preserve pending payment recovery data');
		expect(component).toContain('paymentJournal.listPending()');
	});
});
