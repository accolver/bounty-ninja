import { defineConfig, devices } from '@playwright/test';

const browserRuntimeRoot = process.env.PLAYWRIGHT_BROWSER_RUNTIME_ROOT;
const browserLibraryPath =
	process.env.PLAYWRIGHT_BROWSER_LIBRARY_PATH ??
	(browserRuntimeRoot ? `${browserRuntimeRoot}/usr/lib/x86_64-linux-gnu` : undefined);

if (browserLibraryPath) {
	process.env.LD_LIBRARY_PATH = browserLibraryPath;
	// The scoped runtime is verified independently because Playwright's libx264
	// check only consults the system ldconfig cache, not LD_LIBRARY_PATH.
	process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
}

const browserEnvironment = browserLibraryPath
	? {
			...process.env,
			LD_LIBRARY_PATH: browserLibraryPath,
			PLAYWRIGHT_BROWSER_LIBRARY_PATH: browserLibraryPath,
			...(browserRuntimeRoot
				? {
						FONTCONFIG_PATH: `${browserRuntimeRoot}/etc/fonts`,
						FONTCONFIG_FILE: 'fonts.conf',
						XDG_DATA_DIRS: `${browserRuntimeRoot}/usr/share`,
						LIBGL_ALWAYS_SOFTWARE: '1',
						LIBGL_DRIVERS_PATH: `${browserRuntimeRoot}/usr/lib/x86_64-linux-gnu/dri`,
						__EGL_VENDOR_LIBRARY_DIRS: `${browserRuntimeRoot}/usr/share/glvnd/egl_vendor.d`,
						WPE_FDO_USE_HEADLESS: '1'
					}
				: {})
		}
	: undefined;

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
		launchOptions: browserEnvironment ? { env: browserEnvironment } : undefined,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
		serviceWorkers: 'block'
	},

	projects: [
		{
			name: 'chromium',
			testIgnore: '**/offline-cache.spec.ts',
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'firefox',
			testIgnore: '**/offline-cache.spec.ts',
			use: { ...devices['Desktop Firefox'] }
		},
		{
			name: 'webkit',
			testIgnore: '**/offline-cache.spec.ts',
			use: { ...devices['Desktop Safari'] }
		},
		{
			name: 'mobile-375',
			testIgnore: '**/offline-cache.spec.ts',
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 375, height: 812 },
				isMobile: true,
				hasTouch: true
			}
		},
		{
			name: 'offline-cache',
			testMatch: '**/offline-cache.spec.ts',
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
			command: `PUBLIC_PAYMENT_WRITES_ENABLED=true PUBLIC_DEFAULT_MINT=https://mint.minibits.cash/Bitcoin PUBLIC_DEFAULT_RELAYS=ws://127.0.0.1:10547,ws://127.0.0.1:10548 bun run dev --host 127.0.0.1 --port ${process.env.CI ? '4173' : '5188'} --strictPort`,
			url: process.env.CI ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:5188',
			reuseExistingServer: false,
			timeout: 120_000
		},
		{
			command: process.env.CI
				? 'bun run scripts/e2e-preview.ts'
				: 'PUBLIC_PAYMENT_WRITES_ENABLED=false PUBLIC_DEFAULT_MINT=https://mint.minibits.cash/Bitcoin PUBLIC_DEFAULT_RELAYS=ws://127.0.0.1:10547,ws://127.0.0.1:10548 bun run build && bun run scripts/e2e-preview.ts',
			url: 'http://127.0.0.1:4188',
			reuseExistingServer: false,
			timeout: 180_000
		}
	]
});
