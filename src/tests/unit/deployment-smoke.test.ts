// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
	validateHtmlHeaders,
	validateServiceWorkerHeaders
} from '../../../scripts/smoke-deployment';

describe('deployment smoke policy', () => {
	it('accepts the required production HTML headers', () => {
		const headers = new Headers({
			'content-security-policy': "default-src 'self'; script-src-attr 'none'",
			'x-content-type-options': 'nosniff',
			'x-frame-options': 'DENY',
			'strict-transport-security': 'max-age=31536000; includeSubDomains',
			'cache-control': 'no-cache, must-revalidate'
		});
		expect(validateHtmlHeaders(headers)).toEqual([]);
	});

	it('reports missing security and cache headers', () => {
		const errors = validateHtmlHeaders(new Headers());
		expect(errors).toHaveLength(5);
	});

	it('requires an uncached root-scoped service worker', () => {
		expect(
			validateServiceWorkerHeaders(
				new Headers({
					'cache-control': 'no-cache, no-store, must-revalidate',
					'service-worker-allowed': '/'
				})
			)
		).toEqual([]);
		expect(validateServiceWorkerHeaders(new Headers())).toHaveLength(2);
	});
});
