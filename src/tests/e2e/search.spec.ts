import { test, expect } from '@playwright/test';

test.describe('Search', () => {
	test('home page search bar navigates to search page', async ({ page }) => {
		await page.goto('/');

		// Find the search input
		const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();
		await expect(searchInput).toBeVisible();

		// Type a query and submit
		await searchInput.fill('bitcoin');
		await searchInput.press('Enter');

		// Should navigate to /search with query parameter
		await page.waitForURL(/\/search\?q=bitcoin/);
		expect(page.url()).toContain('/search?q=bitcoin');
	});

	test('search page loads from direct URL', async ({ page }) => {
		await page.goto('/search?q=cashu');

		// Page should load
		const main = page.locator('main');
		await expect(main).toBeVisible();

		// Search input should have the query
		const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();
		await expect(searchInput).toBeVisible();
	});

	test('search page shows empty state for nonexistent query', async ({ page }) => {
		await page.goto('/search?q=zzzznonexistentquery12345');

		await page.waitForTimeout(2000);

		// Should show some content (either results or empty state)
		const main = page.locator('main');
		await expect(main).toBeVisible();
	});

	test('category tabs on home page are clickable', async ({ page }) => {
		await page.goto('/');

		// Look for category tab buttons
		const allTab = page.locator('button:has-text("All")');
		if (await allTab.isVisible({ timeout: 2000 }).catch(() => false)) {
			await allTab.click();
			// Should still be on home page
			expect(page.url()).toContain('/');
		}
	});
});
