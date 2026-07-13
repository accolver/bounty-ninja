import { expect, test } from './helpers/test';
import AxeBuilder from '@axe-core/playwright';
import { MOCK_NIP07_SCRIPT } from './helpers/mock-nip07';

async function expectNoWcagViolations(page: import('@playwright/test').Page): Promise<void> {
	const results = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
		.analyze();
	expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

function visibleSearchTrigger(page: import('@playwright/test').Page) {
	return page
		.getByRole('button', { name: /^(Search bounties|Search)$/ })
		.filter({ visible: true })
		.first();
}

async function login(page: import('@playwright/test').Page, route = '/'): Promise<void> {
	await page.addInitScript(MOCK_NIP07_SCRIPT);
	await page.goto('/');
	await page.getByRole('button', { name: 'Login', exact: true }).first().click();
	await page.getByRole('button', { name: /Browser Extension/ }).click();
	await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
	if (route !== '/') {
		await page.evaluate((target) => {
			const link = document.createElement('a');
			link.href = target;
			document.body.append(link);
			link.click();
			link.remove();
		}, route);
		await page.waitForURL((url) => url.pathname === route);
	}
}

async function expectAccessiblePage(page: import('@playwright/test').Page): Promise<void> {
	await expect(page.locator('main')).toHaveCount(1);
	const navigationLabels = await page
		.locator('nav[aria-label]')
		.evaluateAll((navigation) => navigation.map((element) => element.getAttribute('aria-label')));
	expect(navigationLabels.length).toBeGreaterThan(0);
	expect(new Set(navigationLabels).size, 'navigation landmarks must have unique labels').toBe(
		navigationLabels.length
	);

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

	test('public routes pass automated WCAG 2.1 A and AA rules', async ({ page }) => {
		for (const route of ['/', '/search?q=accessibility', '/settings', '/bounty/new']) {
			await page.goto(route);
			await expectNoWcagViolations(page);
		}
	});

	test('authenticated settings and bounty form pass automated WCAG rules', async ({ page }) => {
		for (const route of ['/settings', '/bounty/new']) {
			await login(page, route);
			await expectNoWcagViolations(page);
		}
	});

	test('search dialog receives keyboard focus', async ({ page }) => {
		await page.goto('/');
		const trigger = visibleSearchTrigger(page);
		await trigger.focus();
		await page.keyboard.press('Enter');
		await expect(page.locator('[role="dialog"] input').first()).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(page.getByRole('button', { name: 'Close search' })).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(trigger).toBeFocused();
	});

	test('login popup moves focus in and restores it on Escape', async ({ page }) => {
		await page.goto('/');
		const trigger = page.getByRole('button', { name: 'Login', exact: true }).first();
		await trigger.click();
		await expect(page.getByRole('button', { name: /Browser Extension/ })).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(trigger).toBeFocused();
	});

	test('tooltips use unique relationships and close with Escape', async ({ page }) => {
		await login(page, '/bounty/new');
		await page.getByRole('button', { name: 'Advanced Settings' }).click();
		const reward = page.getByRole('button', { name: 'Reward Amount' });
		const mint = page.getByRole('button', { name: 'Cashu Mint URL' });
		await reward.focus();
		const rewardId = await reward.getAttribute('aria-describedby');
		expect(rewardId).toBeTruthy();
		await mint.focus();
		const mintId = await mint.getAttribute('aria-describedby');
		expect(mintId).toBeTruthy();
		expect(mintId).not.toBe(rewardId);
		await page.keyboard.press('Escape');
		await expect(page.getByRole('tooltip')).toHaveCount(0);
	});

	test('skip link moves focus to main content', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('button', { name: /relays connected/i })).toBeVisible();
		await page.keyboard.press('Tab');
		await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page.locator('#main-content')).toBeFocused();
	});

	test('relay status opens connection details', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: /relays connected/i }).click();
		const dialog = page.getByRole('dialog', { name: 'Connection details' });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByText('ws://127.0.0.1:10547')).toBeVisible();
		await expect(dialog.getByText('ws://127.0.0.1:10548')).toBeVisible();
	});

	test('375px layout and filters do not overflow horizontally', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await expect(page.getByText('Min sats')).toBeVisible();
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
		expect(overflow).toBe(false);
	});

	test('reduced motion disables decorative animation', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/');
		const duration = await page.locator('body').evaluate(() => {
			const probe = document.createElement('div');
			probe.className = 'animate-fade-in';
			document.body.append(probe);
			const value = getComputedStyle(probe).animationName;
			probe.remove();
			return value;
		});
		expect(duration).toBe('none');
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
		expect(mintInfo).toMatchObject({
			name: 'Bounty.ninja deterministic test mint',
			version: 'Nutshell/0.0.0-test'
		});
	});
});
