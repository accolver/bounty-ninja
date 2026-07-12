import { describe, expect, it } from 'vitest';

const forbidden = [
	/type=["']password["']/i,
	/loginWithNsec/,
	/setNsecSigner/,
	/clearNsecSigner/,
	/PrivateKeySigner/,
	/(?:bind:value|placeholder|for)=["'][^"']*(?:nsec|private[- ]?key|secret[- ]?key)/i
];

const sourceFiles = import.meta.glob(
	[
		'/src/lib/components/**/*.{svelte,ts}',
		'/src/lib/cashu/**/*.ts',
		'/src/lib/nostr/**/*.ts',
		'/src/routes/**/*.{svelte,ts}'
	],
	{ eager: true, import: 'default', query: '?raw' }
) as Record<string, string>;

describe('production identity-key boundary', () => {
	it('contains no direct identity secret inputs or private signers', () => {
		const violations: string[] = [];

		for (const [file, source] of Object.entries(sourceFiles)) {
			for (const pattern of forbidden) {
				if (pattern.test(source)) violations.push(`${file}: ${pattern}`);
			}
		}

		expect(violations).toEqual([]);
	});

	it('contains no raw payment private-key interfaces', () => {
		const violations = Object.entries(sourceFiles)
			.filter(([file]) => file.startsWith('/src/lib/cashu/'))
			.filter(([, source]) => /\bprivkey\b|\bprivateKey\b/.test(source))
			.map(([file]) => file);

		expect(violations).toEqual([]);
	});
});
