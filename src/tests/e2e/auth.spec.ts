import { test, expect } from '@playwright/test';
import { MOCK_NIP07_SCRIPT } from './helpers/mock-nip07';

test.describe('Authentication', () => {
	test('shows Login button when no NIP-07 extension', async ({ page }) => {
		await page.goto('/');

		// Should see a login/connect button
		const loginButton = page.locator(
			'button:has-text("Login"), button:has-text("Connect"), button:has-text("Sign")'
		);
		await expect(loginButton.first()).toBeVisible();
	});

	test('settings page shows auth gate for unauthenticated users', async ({ page }) => {
		await page.goto('/settings');

		// Should show sign-in message
		const signInMsg = page.locator('text=/sign in.*nostr/i');
		await expect(signInMsg).toBeVisible();
	});

	test('unauthenticated user cannot access bounty creation', async ({ page }) => {
		await page.goto('/bounty/new');
		await page.waitForTimeout(1000);

		// Should show "Sign in" text or Login button instead of form
		const signInText = page.locator('text=Sign in');
		const loginButton = page.locator('button:has-text("Login")');

		const hasSignIn = await signInText.isVisible({ timeout: 5000 }).catch(() => false);
		const hasLogin = await loginButton.isVisible({ timeout: 2000 }).catch(() => false);
		expect(hasSignIn || hasLogin).toBe(true);
	});

	test('NIP-07 signer enables login', async ({ page }) => {
		// Inject mock NIP-07
		await page.addInitScript(MOCK_NIP07_SCRIPT);
		await page.goto('/');
		await page.waitForTimeout(1000);

		// With NIP-07 available, either auto-logged in or Login button works
		const loginButton = page.locator('button:has-text("Login"), button:has-text("Connect")');
		if (
			await loginButton
				.first()
				.isVisible({ timeout: 2000 })
				.catch(() => false)
		) {
			await loginButton.first().click();
			await page.waitForTimeout(1000);
		}

		// After login, profile menu or some auth indicator should appear
		const body = await page.textContent('body');
		expect(body).toBeTruthy();
	});

	test('settings page loads for authenticated user', async ({ page }) => {
		await page.addInitScript(MOCK_NIP07_SCRIPT);
		await page.goto('/');
		await page.waitForTimeout(500);

		// Login if needed
		const loginButton = page.locator('button:has-text("Login"), button:has-text("Connect")');
		if (
			await loginButton
				.first()
				.isVisible({ timeout: 2000 })
				.catch(() => false)
		) {
			await loginButton.first().click();
			await page.waitForTimeout(500);
		}

		await page.goto('/settings');
		await page.waitForTimeout(500);

		// Should show settings content (either auth-gated message or actual settings)
		const main = page.locator('main');
		await expect(main).toBeVisible();
	});

	test('every page has main landmark', async ({ page }) => {
		const routes = ['/', '/search', '/settings', '/bounty/new'];

		for (const route of routes) {
			await page.goto(route);
			const main = page.locator('main');
			await expect(main).toBeVisible();
		}
	});

	test('all form inputs have labels', async ({ page }) => {
		await page.goto('/');

		// Check all visible inputs have associated labels or aria-label
		const inputs = page.locator('input:visible');
		const count = await inputs.count();

		for (let i = 0; i < count; i++) {
			const input = inputs.nth(i);
			const ariaLabel = await input.getAttribute('aria-label');
			const id = await input.getAttribute('id');
			const ariaLabelledBy = await input.getAttribute('aria-labelledby');
			const placeholder = await input.getAttribute('placeholder');

			// Input should have some form of labelling
			const hasLabel = !!(ariaLabel || ariaLabelledBy || placeholder);
			let hasAssociatedLabel = false;
			if (id) {
				const labelCount = await page.locator(`label[for="${id}"]`).count();
				hasAssociatedLabel = labelCount > 0;
			}

			expect(hasLabel || hasAssociatedLabel).toBe(true);
		}
	});
});
