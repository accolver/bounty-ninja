import { describe, expect, it } from 'vitest';

const documents = import.meta.glob(
	[
		'/SECURITY.md',
		'/docs/runbooks/payment-incident.md',
		'/docs/runbooks/service-outage.md',
		'/docs/runbooks/credential-rotation.md',
		'/docs/runbooks/release-rollback.md',
		'/docs/runbooks/recovery-drill.md'
	],
	{ eager: true, import: 'default', query: '?raw' }
) as Record<string, string>;

describe('operational runbooks', () => {
	it('covers required security and incident procedures', () => {
		expect(Object.keys(documents)).toHaveLength(6);
		expect(documents['/SECURITY.md']).toContain('private vulnerability reporting');
		expect(documents['/docs/runbooks/payment-incident.md']).toContain(
			'PUBLIC_PAYMENT_WRITES_ENABLED=false'
		);
		expect(documents['/docs/runbooks/service-outage.md']).toContain('Mint Outage');
		expect(documents['/docs/runbooks/credential-rotation.md']).toContain('CLOUDFLARE_API_TOKEN');
		expect(documents['/docs/runbooks/release-rollback.md']).toContain('sha256sum --check');
		expect(documents['/docs/runbooks/recovery-drill.md']).toContain('recovery-required');
	});

	it('forbids real bearer and identity material in incident handling', () => {
		const combined = Object.values(documents).join('\n');
		expect(combined).toMatch(/Never include\s+real private keys, tokens, proofs, or credentials/);
		expect(combined).toContain('test funds');
	});
});
