import { nip19, type NostrEvent } from 'nostr-tools';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import {
	bountyBlueprint,
	payoutBlueprint,
	pledgeBlueprint,
	retractionBlueprint,
	solutionBlueprint,
	voteBlueprint
} from '$lib/bounty/blueprints';
import { BOUNTY_KIND, PAYOUT_KIND, PLEDGE_KIND, RETRACTION_KIND } from '$lib/bounty/kinds';
import {
	authenticateAs,
	expect,
	MINT_FIXTURE_URL,
	MINT_URL,
	TEST_PUBKEYS,
	test,
	type E2EServices
} from './helpers/test';
import type { TestRole } from './helpers/mock-nip07';

const AMOUNT = 21;

function paymentKey(secret: number): string {
	const privateKey = new Uint8Array(32);
	privateKey[31] = secret;
	return Array.from(secp256k1.getPublicKey(privateKey, true), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');
}

const PAYMENT_KEYS = {
	pledger: paymentKey(11),
	pledger2: paymentKey(12),
	solver: paymentKey(13),
	wrong: paymentKey(14)
};

function address(dTag: string): string {
	return `${BOUNTY_KIND}:${TEST_PUBKEYS.creator}:${dTag}`;
}

function detailUrl(dTag: string): string {
	return `/bounty/${nip19.naddrEncode({
		identifier: dTag,
		pubkey: TEST_PUBKEYS.creator,
		kind: BOUNTY_KIND
	})}`;
}

async function login(
	page: Parameters<typeof authenticateAs>[0],
	role: TestRole,
	route = '/'
): Promise<void> {
	await authenticateAs(page, role);
	await page.goto(route);
	await page.getByRole('button', { name: 'Login', exact: true }).first().click();
	await page.getByRole('button', { name: /Browser Extension/ }).click();
	await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
	await expect(page.getByRole('button', { name: /2 of 2 relays connected/i })).toBeVisible({
		timeout: 15_000
	});
}

async function publishBounty(services: E2EServices, dTag: string): Promise<NostrEvent> {
	return services.publish(
		'creator',
		bountyBlueprint({
			dTag,
			title: `Hermetic bounty ${dTag}`,
			description: 'A deterministic local-only browser lifecycle fixture.',
			rewardAmount: 100,
			mintUrl: MINT_URL,
			submissionFee: 0
		})
	);
}

async function publishPledge(
	services: E2EServices,
	dTag: string,
	role: 'pledger' | 'pledger2' = 'pledger',
	overrides: Partial<{ token: string; amount: number; paymentPubkey: string }> = {}
): Promise<{ event: NostrEvent; token: string }> {
	const paymentPubkey = overrides.paymentPubkey ?? PAYMENT_KEYS[role];
	const fixture = overrides.token
		? { token: overrides.token }
		: await services.token({ amount: overrides.amount ?? AMOUNT, paymentPubkey });
	const event = await services.publish(
		role,
		pledgeBlueprint({
			bountyAddress: address(dTag),
			creatorPubkey: TEST_PUBKEYS.creator,
			paymentPubkey,
			amount: overrides.amount ?? AMOUNT,
			cashuToken: fixture.token,
			mintUrl: MINT_URL
		})
	);
	return { event, token: fixture.token };
}

async function publishSolution(
	services: E2EServices,
	dTag: string,
	role: 'solver' | 'attacker' = 'solver'
): Promise<NostrEvent> {
	return services.publish(
		role,
		solutionBlueprint({
			bountyAddress: address(dTag),
			creatorPubkey: TEST_PUBKEYS.creator,
			paymentPubkey: role === 'solver' ? PAYMENT_KEYS.solver : PAYMENT_KEYS.wrong,
			description: `${role} deterministic solution`
		})
	);
}

async function publishVote(
	services: E2EServices,
	dTag: string,
	solution: NostrEvent,
	role: 'pledger' | 'pledger2' = 'pledger'
): Promise<NostrEvent> {
	return services.publish(
		role,
		voteBlueprint({
			bountyAddress: address(dTag),
			solutionId: solution.id,
			solutionAuthor: solution.pubkey,
			choice: 'approve'
		})
	);
}

async function publishPayout(
	services: E2EServices,
	dTag: string,
	pledge: NostrEvent,
	solution: NostrEvent,
	role: TestRole = 'pledger',
	overrides: Partial<{
		amount: number;
		paymentPubkey: string;
		mintUrl: string;
		sourceId: string;
	}> = {}
): Promise<{ event: NostrEvent; token: string }> {
	const paymentPubkey = overrides.paymentPubkey ?? PAYMENT_KEYS.solver;
	const amount = overrides.amount ?? AMOUNT;
	const mintUrl = overrides.mintUrl ?? MINT_URL;
	const fixture = await services.token({ amount, paymentPubkey, mintUrl });
	const event = await services.publish(
		role,
		payoutBlueprint({
			bountyAddress: address(dTag),
			solutionId: solution.id,
			sourcePledgeId: overrides.sourceId ?? pledge.id,
			solverPubkey: solution.pubkey,
			paymentPubkey,
			amount,
			cashuToken: fixture.token,
			mintUrl
		})
	);
	return { event, token: fixture.token };
}

test.describe('Hermetic bounty lifecycle', () => {
	test('creates a bounty through the browser with a valid signed relay event', async ({
		page,
		services
	}) => {
		await login(page, 'creator', '/bounty/new');
		await page.locator('#bounty-title').fill('Browser-created hermetic bounty');
		await page
			.locator('#bounty-description')
			.fill('Created entirely against the local relay fixture.');
		await page.locator('#bounty-reward').fill('100');
		await page.getByRole('button', { name: 'Advanced Settings' }).click();
		await page.locator('#bounty-mint').fill(MINT_URL);
		await page.getByRole('button', { name: 'Create Bounty' }).click();

		await expect(page).toHaveURL(/\/bounty\/naddr1/);
		await expect(
			page.getByRole('heading', { name: 'Browser-created hermetic bounty' })
		).toBeVisible();
		const bounties = await services.events(BOUNTY_KIND);
		expect(bounties).toHaveLength(1);
		expect(bounties[0].pubkey).toBe(TEST_PUBKEYS.creator);
		expect(bounties[0].sig).toMatch(/^[0-9a-f]{128}$/);
	});

	test('validates and publishes a manually-created P2PK pledge through the irreversible UI path', async ({
		page,
		services
	}) => {
		await page.setViewportSize({ width: 375, height: 667 });
		const dTag = 'manual-pledge';
		await publishBounty(services, dTag);
		const fixture = await services.token({ amount: AMOUNT, paymentPubkey: PAYMENT_KEYS.pledger });
		await login(page, 'pledger', detailUrl(dTag));
		await page.getByRole('button', { name: 'Fund this bounty' }).click();
		const pledgeDialog = page.getByRole('dialog', { name: 'Fund this bounty' });
		const dialogBounds = await pledgeDialog.boundingBox();
		expect(dialogBounds).not.toBeNull();
		expect(dialogBounds!.y).toBeGreaterThanOrEqual(0);
		expect(dialogBounds!.y + dialogBounds!.height).toBeLessThanOrEqual(667);
		await expect(pledgeDialog).toHaveCSS('overflow-y', 'auto');
		await page.locator('#pledge-payment-key').fill(PAYMENT_KEYS.pledger);
		await page.locator('#pledge-amount').fill(String(AMOUNT));
		await page.locator('#pledge-token').fill(fixture.token);
		await page.locator('.pledge-checkbox').check();
		await page.getByRole('button', { name: `Pledge ${AMOUNT} sats` }).click();

		await expect(page.getByText(`Pledge of ${AMOUNT} sats submitted!`)).toBeVisible();
		const pledges = await services.events(PLEDGE_KIND);
		expect(pledges).toHaveLength(1);
		expect(pledges[0].tags).toContainEqual(['payment', 'cashu', PAYMENT_KEYS.pledger]);
		expect(pledges[0].tags).toContainEqual(['cashu', fixture.token]);
	});

	test('submits a solution with its payment key in the browser', async ({ page, services }) => {
		const dTag = 'solve-vote';
		await publishBounty(services, dTag);
		await publishPledge(services, dTag);

		await login(page, 'solver', detailUrl(dTag));
		await page.getByRole('button', { name: 'Submit a solution' }).click();
		await page.locator('#solution-description').fill('Browser-submitted deterministic solution.');
		await page.locator('#solution-payment-key').fill(PAYMENT_KEYS.solver);
		await page.getByRole('button', { name: 'Submit solution' }).click();
		await expect(page.getByText('Solution submitted successfully!')).toBeVisible();

		const solution = (await services.events()).find((event) => event.kind === 7301);
		expect(solution?.tags).toContainEqual(['payment', 'cashu', PAYMENT_KEYS.solver]);
	});

	test('casts a weighted vote that produces one unique winner', async ({ page, services }) => {
		const dTag = 'unique-vote';
		await publishBounty(services, dTag);
		await publishPledge(services, dTag);
		await publishSolution(services, dTag);
		await login(page, 'pledger', detailUrl(dTag));
		await page
			.getByRole('heading', { name: /Profile:/ })
			.getByRole('button')
			.click();
		await page.getByRole('button', { name: 'Approve solution' }).click();
		await expect(page.getByText('Vote submitted!')).toBeVisible();
		await expect(page.getByText(/Consensus reached/i)).toBeVisible();
	});

	test('releases one source pledge only after Minibits spent it and exposes solver claim handoff', async ({
		page,
		services,
		context
	}) => {
		const dTag = 'release-claim';
		await publishBounty(services, dTag);
		const source = await publishPledge(services, dTag);
		const solution = await publishSolution(services, dTag);
		await publishVote(services, dTag, solution);
		await login(page, 'pledger', detailUrl(dTag));
		await page.getByRole('button', { name: `Release ${AMOUNT} sats` }).click();
		await services.spend(source.token);
		const replacement = await services.token({
			amount: AMOUNT,
			paymentPubkey: PAYMENT_KEYS.solver
		});

		await page.getByLabel('Solver-locked Minibits payout token').fill(replacement.token);
		await page.getByRole('button', { name: 'Verify and publish payout' }).click();
		await expect(page.getByText('Source-bound payout published')).toBeVisible();

		const payouts = await services.events(PAYOUT_KIND);
		expect(payouts).toHaveLength(1);
		expect(payouts[0].tags).toContainEqual(['e', source.event.id, '', 'source']);
		const stats = await context.request
			.get(`${MINT_FIXTURE_URL}/fixtures/stats`)
			.then((response) => response.json());
		expect(stats.swapCalls).toBe(0);
	});

	test('hands the exact source-bound token to the authenticated solver', async ({
		page,
		services
	}) => {
		const dTag = 'solver-claim';
		await publishBounty(services, dTag);
		const source = await publishPledge(services, dTag);
		const solution = await publishSolution(services, dTag);
		await publishVote(services, dTag, solution);
		await services.spend(source.token);
		const payout = await publishPayout(services, dTag, source.event, solution);
		await page.addInitScript(() => {
			let copiedText = '';
			Object.defineProperty(navigator, 'clipboard', {
				configurable: true,
				value: {
					writeText: async (text: string) => {
						copiedText = text;
					},
					readText: async () => copiedText
				}
			});
		});
		await login(page, 'solver', detailUrl(dTag));
		await expect(page.getByText(`You have been awarded ${AMOUNT} sats!`)).toBeVisible();
		await page.getByRole('button', { name: 'Copy Cashu token to clipboard' }).click();
		await expect(page.getByRole('button', { name: 'Token copied to clipboard' })).toBeVisible();
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(payout.token);
	});

	test('reclaims the source in Minibits before publishing a pledge retraction', async ({
		page,
		services
	}) => {
		const dTag = 'reclaim-retract';
		await publishBounty(services, dTag);
		const source = await publishPledge(services, dTag);
		await services.spend(source.token);
		await login(page, 'pledger', detailUrl(dTag));
		await page.getByRole('button', { name: 'Reclaim and retract pledge' }).click();
		await page.getByRole('button', { name: 'Verify Revert and retract' }).click();
		await expect.poll(async () => (await services.events(RETRACTION_KIND)).length).toBe(1);
		const [retraction] = await services.events(RETRACTION_KIND);
		expect(retraction.pubkey).toBe(TEST_PUBKEYS.pledger);
		expect(retraction.tags).toContainEqual(['e', source.event.id]);
	});
});

test.describe('Adversarial payment and crash boundaries', () => {
	test('rejects wrong payment key, amount, mint, and duplicate proofs in the manual pledge UI', async ({
		page,
		services
	}) => {
		const dTag = 'invalid-manual-pledges';
		await publishBounty(services, dTag);
		const correct = await services.token({ amount: AMOUNT, paymentPubkey: PAYMENT_KEYS.pledger });
		const wrongKey = await services.token({ amount: AMOUNT, paymentPubkey: PAYMENT_KEYS.wrong });
		const wrongMint = await services.token({
			amount: AMOUNT,
			paymentPubkey: PAYMENT_KEYS.pledger,
			mintUrl: `${MINT_URL}/wrong`
		});
		const duplicate = await services.token({
			amount: AMOUNT,
			paymentPubkey: PAYMENT_KEYS.pledger,
			duplicateProof: true
		});
		await login(page, 'pledger', detailUrl(dTag));
		await page.getByRole('button', { name: 'Fund this bounty' }).click();
		const pledgeForm = page.getByRole('form', { name: 'Pledge form' });
		await page.locator('#pledge-payment-key').fill(PAYMENT_KEYS.pledger);
		await page.locator('#pledge-amount').fill(String(AMOUNT));
		await page.locator('.pledge-checkbox').check();

		await page.locator('#pledge-token').fill(wrongKey.token);
		await page.getByRole('button', { name: `Pledge ${AMOUNT} sats` }).click();
		await expect(
			pledgeForm.getByRole('alert').filter({ hasText: /not locked to the entered/i })
		).toBeVisible();

		await page.locator('#pledge-token').fill(correct.token);
		await page.locator('#pledge-amount').fill('20');
		await page.getByRole('button', { name: 'Pledge 21 sats' }).click();
		await expect(pledgeForm.getByRole('alert').filter({ hasText: /exactly 20/i })).toBeVisible();

		await page.locator('#pledge-amount').fill(String(AMOUNT));
		await page.locator('#pledge-token').fill(wrongMint.token);
		await expect(
			pledgeForm.getByRole('alert').filter({ hasText: /does not match bounty mint/i })
		).toBeVisible();

		await page.locator('#pledge-amount').fill(String(AMOUNT * 2));
		await page.locator('#pledge-token').fill(duplicate.token);
		await page.getByRole('button', { name: `Pledge ${AMOUNT * 2} sats` }).click();
		await expect(
			pledgeForm.getByRole('alert').filter({ hasText: /duplicate proofs/i })
		).toBeVisible();
		expect(await services.events(PLEDGE_KIND)).toHaveLength(0);
	});

	test('counts replayed source proofs once and ignores duplicate source payouts', async ({
		page,
		services
	}) => {
		const dTag = 'proof-replay';
		await publishBounty(services, dTag);
		const token = await services.token({ amount: AMOUNT, paymentPubkey: PAYMENT_KEYS.pledger });
		const first = await publishPledge(services, dTag, 'pledger', { token: token.token });
		await publishPledge(services, dTag, 'pledger', { token: token.token });
		const solution = await publishSolution(services, dTag);
		await publishVote(services, dTag, solution);
		await services.spend(token.token);
		await publishPayout(services, dTag, first.event, solution);
		await publishPayout(services, dTag, first.event, solution);

		await login(page, 'solver', detailUrl(dTag));
		const fundedStat = page.getByText('Funded', { exact: true }).locator('..').locator('..');
		await expect(fundedStat.getByRole('button', { name: `${AMOUNT} sats` })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Copy Cashu token to clipboard' })).toHaveCount(
			1
		);
	});

	test('blocks release when two solutions have ambiguous quorum winners', async ({
		page,
		services
	}) => {
		const dTag = 'ambiguous-winner';
		await publishBounty(services, dTag);
		await publishPledge(services, dTag);
		const first = await publishSolution(services, dTag);
		const second = await publishSolution(services, dTag, 'attacker');
		await publishVote(services, dTag, first);
		await publishVote(services, dTag, second);
		await login(page, 'pledger', detailUrl(dTag));
		await expect(page.getByRole('button', { name: `Release ${AMOUNT} sats` })).toHaveCount(0);
		await expect(page.getByText(/Releasing Funds|Consensus Reached/)).toHaveCount(0);
	});

	test('ignores unauthorized payout redirection, wrong mint/amount, and bounty retraction', async ({
		page,
		services
	}) => {
		const dTag = 'unauthorized-events';
		await publishBounty(services, dTag);
		const source = await publishPledge(services, dTag);
		const solution = await publishSolution(services, dTag);
		await publishVote(services, dTag, solution);
		await publishPayout(services, dTag, source.event, solution, 'attacker');
		await publishPayout(services, dTag, source.event, solution, 'pledger', {
			amount: AMOUNT + 1
		});
		await publishPayout(services, dTag, source.event, solution, 'pledger', {
			paymentPubkey: PAYMENT_KEYS.wrong
		});
		await publishPayout(services, dTag, source.event, solution, 'pledger', {
			mintUrl: `${MINT_URL}/wrong`
		});
		await services.publish(
			'attacker',
			retractionBlueprint({
				taskAddress: address(dTag),
				type: 'bounty',
				creatorPubkey: TEST_PUBKEYS.creator,
				reason: 'unauthorized cancellation'
			})
		);

		await login(page, 'pledger', detailUrl(dTag));
		await expect(page.getByRole('heading', { name: 'Retraction History' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: `Release ${AMOUNT} sats` })).toBeVisible();
		await expect(page.getByText(/0 of 1 pledger released/)).toBeVisible();
	});

	test('does not publish a release while the source proof remains unspent', async ({
		page,
		services
	}) => {
		const dTag = 'source-unspent';
		await publishBounty(services, dTag);
		const source = await publishPledge(services, dTag);
		const solution = await publishSolution(services, dTag);
		await publishVote(services, dTag, solution);
		const replacement = await services.token({
			amount: AMOUNT,
			paymentPubkey: PAYMENT_KEYS.solver
		});
		await login(page, 'pledger', detailUrl(dTag));
		await page.getByRole('button', { name: `Release ${AMOUNT} sats` }).click();
		await page.getByLabel('Solver-locked Minibits payout token').fill(replacement.token);
		await page.getByRole('button', { name: 'Verify and publish payout' }).click();
		await expect(
			page
				.getByRole('alert')
				.filter({ hasText: /Revert is not complete/i })
				.first()
		).toBeVisible();
		expect(await services.events(PAYOUT_KIND)).toHaveLength(0);
		expect((await services.events(PLEDGE_KIND))[0].id).toBe(source.event.id);
	});

	test('reloads after relay rejection and retries the exact signed payout without another mint spend', async ({
		page,
		services,
		context
	}) => {
		const dTag = 'relay-recovery';
		await publishBounty(services, dTag);
		const source = await publishPledge(services, dTag);
		const solution = await publishSolution(services, dTag);
		await publishVote(services, dTag, solution);
		await login(page, 'pledger', detailUrl(dTag));
		await page.getByRole('button', { name: `Release ${AMOUNT} sats` }).click();
		await services.spend(source.token);
		const replacement = await services.token({
			amount: AMOUNT,
			paymentPubkey: PAYMENT_KEYS.solver
		});
		await page.getByLabel('Solver-locked Minibits payout token').fill(replacement.token);
		await services.rejectRelay(true);
		await page.getByRole('button', { name: 'Verify and publish payout' }).click();
		await expect(
			page
				.getByLabel('Notifications')
				.getByRole('alert')
				.filter({ hasText: 'No relay accepted the event' })
		).toBeVisible();
		await page.reload();
		await page.getByRole('button', { name: 'Login', exact: true }).first().click();
		await page.getByRole('button', { name: /Browser Extension/ }).click();
		await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
		await expect(page.getByText('Status: recovery-required')).toBeVisible();
		await services.rejectRelay(false);
		await page.getByRole('button', { name: 'Retry exact signed event' }).click();
		await expect.poll(async () => (await services.events(PAYOUT_KIND)).length).toBe(1);
		const stats = await context.request
			.get(`${MINT_FIXTURE_URL}/fixtures/stats`)
			.then((response) => response.json());
		expect(stats.swapCalls).toBe(0);
	});

	test('preserves every nonterminal payment journal stage across reload', async ({ page }) => {
		await page.goto('/');
		const statuses = [
			'prepared',
			'awaiting-wallet',
			'token-verified',
			'source-spent',
			'spending',
			'outputs-created',
			'event-signed',
			'published',
			'recovery-required'
		];
		await page.evaluate(async (journalStatuses) => {
			const request = indexedDB.open('bounty.ninja:payment-journal', 2);
			const database = await new Promise<IDBDatabase>((resolve, reject) => {
				request.onupgradeneeded = () => {
					if (!request.result.objectStoreNames.contains('operations')) {
						request.result.createObjectStore('operations', { keyPath: 'id' });
					}
				};
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			const transaction = database.transaction('operations', 'readwrite');
			for (const status of journalStatuses) {
				transaction.objectStore('operations').put({
					id: `reload-${status}`,
					schemaVersion: 2,
					status,
					intent: {
						kind: 'release',
						sourceEventIds: ['a'.repeat(64)],
						mintUrl: 'http://localhost:3338',
						amount: 1,
						requiresWalletHandoff: false
					},
					createdAt: 1,
					updatedAt: 1
				});
			}
			await new Promise<void>((resolve, reject) => {
				transaction.oncomplete = () => resolve();
				transaction.onerror = () => reject(transaction.error);
			});
			database.close();
		}, statuses);
		await page.reload();
		await expect(page.getByRole('heading', { name: 'Payment recovery required' })).toBeVisible();
		for (const status of statuses) {
			await expect(page.getByText(`Status: ${status}`, { exact: true })).toBeVisible();
		}
	});
});
