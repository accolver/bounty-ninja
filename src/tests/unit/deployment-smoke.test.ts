// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
	validateHtmlHeaders,
	validateRelease,
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

	it('requires complete payment-disabled release metadata', () => {
		const commit = 'a'.repeat(40);
		const release = {
			commit,
			source: { type: 'github', runId: '123', attempt: '2' },
			timestamp: '2026-07-12T00:00:00.000Z',
			paymentWritesEnabled: false,
			deploymentChannel: 'production',
			artifactDigest: {
				algorithm: 'sha256',
				scope: 'build-without-release-metadata',
				value: 'b'.repeat(64)
			}
		};
		expect(validateRelease(release, commit)).toEqual(release);
		expect(() => validateRelease({ ...release, paymentWritesEnabled: true }, commit)).toThrow(
			'payment writes'
		);
		expect(() => validateRelease({ ...release, source: undefined }, commit)).toThrow(
			'release source'
		);
	});
});
