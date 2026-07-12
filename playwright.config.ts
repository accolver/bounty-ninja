import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration for Bounty.ninja
 *
 * Runs the site against local, resettable Nostr and Cashu services. CI previews
 * the build produced by the quality job rather than rebuilding it here.
 */
export default defineConfig({
	testDir: 'src/tests/e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
	outputDir: 'test-results',
	timeout: 30_000,

	use: {
		baseURL: process.env.CI ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:5188',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
		serviceWorkers: 'block'
	},

	projects: [
		{
			name: 'chromium',
			testIgnore: '**/offline-update.spec.ts',
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'firefox',
			testIgnore: '**/offline-update.spec.ts',
			use: { ...devices['Desktop Firefox'] }
		},
		{
			name: 'webkit',
			testIgnore: '**/offline-update.spec.ts',
			use: { ...devices['Desktop Safari'] }
		},
		{
			name: 'mobile-375',
			testIgnore: '**/offline-update.spec.ts',
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 375, height: 812 },
				isMobile: true,
				hasTouch: true
			}
		},
		{
			name: 'offline-update',
			testMatch: '**/offline-update.spec.ts',
			use: {
				...devices['Desktop Chrome'],
				baseURL: 'http://127.0.0.1:4188',
				serviceWorkers: 'allow'
			}
		}
	],

	webServer: [
		{
			command: 'bun run test:e2e:services',
			url: 'http://127.0.0.1:10547/health',
			reuseExistingServer: false,
			timeout: 30_000
		},
		{
			command: `PUBLIC_PAYMENT_WRITES_ENABLED=true PUBLIC_DEFAULT_MINT=http://localhost:3338 PUBLIC_DEFAULT_RELAYS=ws://127.0.0.1:10547 bun run dev --host 127.0.0.1 --port ${process.env.CI ? '4173' : '5188'} --strictPort`,
			url: process.env.CI ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:5188',
			reuseExistingServer: false,
			timeout: 120_000
		},
		{
			command: process.env.CI
				? 'bun run preview -- --host 127.0.0.1 --port 4188 --strictPort'
				: 'PUBLIC_PAYMENT_WRITES_ENABLED=false PUBLIC_DEFAULT_MINT=http://localhost:3338 PUBLIC_DEFAULT_RELAYS=ws://127.0.0.1:10547 bun run build && bun run preview -- --host 127.0.0.1 --port 4188 --strictPort',
			url: 'http://127.0.0.1:4188',
			reuseExistingServer: false,
			timeout: 180_000
		}
	]
});
