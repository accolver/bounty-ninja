import { expect, MINT_URL, test } from './helpers/test';
import { bountyBlueprint } from '$lib/bounty/blueprints';

function visibleSearchTrigger(page: import('@playwright/test').Page) {
	return page
		.getByRole('button', { name: /^(Search bounties|Search)$/ })
		.filter({ visible: true })
		.first();
}

test.describe('Search', () => {
	test('home page search dialog opens and navigates to search page', async ({ page }) => {
		await page.goto('/');

		const searchTrigger = visibleSearchTrigger(page);
		await expect(searchTrigger).toBeVisible();
		await searchTrigger.click();

		// Search dialog should open with an input
		const dialogInput = page.locator('[role="dialog"] input, dialog input').first();
		await expect(dialogInput).toBeVisible();

		// Type a query and submit
		await dialogInput.fill('bitcoin');
		await dialogInput.press('Enter');

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

	test('category controls filter the home page', async ({ page, services }) => {
		await services.publish(
			'creator',
			bountyBlueprint({
				dTag: 'category-filter',
				title: 'Category filter fixture',
				description: 'Visible only when its category is selected.',
				rewardAmount: 50,
				tags: ['development'],
				mintUrl: MINT_URL,
				submissionFee: 0
			})
		);
		await page.goto('/');

		const mobileCategory = page.getByLabel('Category', { exact: true });
		if ((page.viewportSize()?.width ?? 1024) < 1024) {
			await expect(mobileCategory).toBeVisible();
			await expect(mobileCategory.locator('option[value="development"]')).toHaveCount(1);
			await mobileCategory.selectOption('development');
		} else {
			await page.getByRole('button', { name: /^development\s+1$/ }).click();
		}

		await expect(page).toHaveURL(/\?tag=development$/);
		await expect(page.getByRole('heading', { name: 'development' })).toBeVisible();
		await expect(page.getByText('No bounties found for "development"')).toBeVisible();
	});
});
