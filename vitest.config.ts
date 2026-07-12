import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		conditions: ['browser']
	},
	test: {
		include: [
			'src/tests/unit/**/*.{test,spec}.{js,ts}',
			'src/tests/integration/**/*.{test,spec}.{js,ts}'
		],
		exclude: ['src/tests/e2e/**', 'node_modules/**'],
		environment: 'jsdom',
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json-summary'],
			reportsDirectory: 'coverage',
			include: [
				'src/lib/nostr/tag-validator.ts',
				'src/lib/nostr/publish.ts',
				'src/lib/nostr/signer.svelte.ts',
				'src/lib/bounty/financial-state.ts',
				'src/lib/bounty/state-machine.ts',
				'src/lib/bounty/payout-validation.ts',
				'src/lib/bounty/retraction-validation.ts',
				'src/lib/cashu/payment-signer.ts',
				'src/lib/cashu/payment-journal.ts',
				'src/lib/cashu/payment-operation.ts',
				'src/lib/cashu/financial-verifier.ts',
				'src/lib/utils/sanitize.ts',
				'src/lib/utils/safe-event-url.ts'
			],
			thresholds: {
				statements: 84,
				branches: 83,
				functions: 86,
				lines: 84,
				'src/lib/bounty/**': { branches: 87, lines: 94 },
				'src/lib/cashu/payment-signer.ts': { branches: 95, lines: 95 },
				'src/lib/cashu/payment-journal.ts': { branches: 80, lines: 85 },
				'src/lib/cashu/payment-operation.ts': { branches: 75, lines: 85 },
				'src/lib/cashu/financial-verifier.ts': { branches: 65, lines: 80 },
				'src/lib/nostr/publish.ts': { branches: 95, lines: 95 },
				'src/lib/nostr/signer.svelte.ts': { branches: 57, lines: 67 },
				'src/lib/nostr/tag-validator.ts': { branches: 74, lines: 75 },
				'src/lib/utils/**': { branches: 90, lines: 95 }
			}
		}
	}
});
