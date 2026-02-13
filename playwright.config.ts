import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration for Bounty.ninja
 *
 * Builds the SvelteKit static site and serves it via `vite preview`
 * before running tests against the production build.
 */
export default defineConfig({
	testDir: 'src/tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	timeout: 30_000,

	use: {
		baseURL: process.env.CI ? 'http://localhost:4173' : 'http://localhost:5188',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure'
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],

	webServer: {
		command: process.env.CI ? 'bun run build && bun run preview' : 'bun run dev --port 5188',
		url: process.env.CI ? 'http://localhost:4173' : 'http://localhost:5188',
		reuseExistingServer: true,
		timeout: 120_000
	}
});
