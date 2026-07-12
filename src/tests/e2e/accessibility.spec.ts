import { expect, test } from './helpers/test';

async function expectAccessiblePage(page: import('@playwright/test').Page): Promise<void> {
	await expect(page.locator('main')).toHaveCount(1);
	await expect(page.locator('nav[aria-label]')).toHaveCount(1);

	const missingAlternatives = await page.locator('img:not([alt])').count();
	expect(missingAlternatives, 'all images must have alt attributes').toBe(0);

	const unlabeledControls = await page.locator('input, select, textarea').evaluateAll(
		(controls) =>
			controls.filter((control) => {
				const id = control.getAttribute('id');
				return !(
					control.getAttribute('aria-label') ||
					control.getAttribute('aria-labelledby') ||
					(id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
					control.closest('label')
				);
			}).length
	);
	expect(unlabeledControls, 'all form controls must have accessible labels').toBe(0);
}

test.describe('Critical route accessibility', () => {
	for (const route of ['/', '/search?q=accessibility', '/settings', '/bounty/new']) {
		test(`${route} has landmarks, image alternatives, and labelled controls`, async ({ page }) => {
			await page.goto(route);
			await expectAccessiblePage(page);
		});
	}

	test('search dialog receives keyboard focus', async ({ page }) => {
		await page.goto('/');
		await page.locator('button[aria-label="Search bounties"]').first().focus();
		await page.keyboard.press('Enter');
		await expect(page.locator('[role="dialog"] input').first()).toBeFocused();
	});

	test('public HTTP and WebSocket traffic is blocked', async ({ page }) => {
		await page.goto('/');
		const httpBlocked = await page.evaluate(async () => {
			try {
				await fetch('https://example.com/e2e-network-guard');
				return false;
			} catch {
				return true;
			}
		});
		expect(httpBlocked).toBe(true);

		const websocketBlocked = await page.evaluate(
			() =>
				new Promise<boolean>((resolve) => {
					const socket = new WebSocket('wss://example.com/e2e-network-guard');
					const timeout = window.setTimeout(() => resolve(false), 1_000);
					socket.addEventListener('open', () => {
						window.clearTimeout(timeout);
						resolve(false);
					});
					socket.addEventListener('close', () => {
						window.clearTimeout(timeout);
						resolve(true);
					});
				})
		);
		expect(websocketBlocked).toBe(true);
	});

	test('default mint traffic is served by the deterministic local mock', async ({ page }) => {
		await page.goto('/');
		const mintInfo = await page.evaluate(async () => {
			const response = await fetch('https://mint.minibits.cash/Bitcoin/v1/info');
			return (await response.json()) as { name: string; version: string };
		});
		expect(mintInfo).toEqual({
			name: 'Bounty.ninja deterministic test mint',
			version: 'Nutshell/0.0.0-test'
		});
	});
});
