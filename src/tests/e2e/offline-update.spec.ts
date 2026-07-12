import { nip19 } from 'nostr-tools';
import { bountyBlueprint } from '$lib/bounty/blueprints';
import { BOUNTY_KIND } from '$lib/bounty/kinds';
import { expect, MINT_URL, TEST_PUBKEYS, test } from './helpers/test';

test.describe('Service worker offline and payment update safety', () => {
	test('serves an offline cached deep link and preserves pending payment recovery', async ({
		page,
		context,
		services
	}) => {
		const dTag = 'offline-deep-link';
		const title = 'Verified offline deep link bounty';
		await services.publish(
			'creator',
			bountyBlueprint({
				dTag,
				title,
				description: 'This fixture must remain available without relay or document traffic.',
				rewardAmount: 50,
				mintUrl: MINT_URL,
				submissionFee: 0
			})
		);
		const url = `/bounty/${nip19.naddrEncode({
			identifier: dTag,
			pubkey: TEST_PUBKEYS.creator,
			kind: BOUNTY_KIND
		})}`;

		await page.goto(url);
		await expect(page.getByRole('heading', { name: title })).toBeVisible();
		await page.evaluate(async () => navigator.serviceWorker.ready);
		await page.evaluate(async () => {
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
			transaction.objectStore('operations').put({
				id: 'pending-across-service-worker-update',
				schemaVersion: 2,
				status: 'recovery-required',
				intent: {
					kind: 'release',
					sourceEventIds: ['a'.repeat(64)],
					mintUrl: 'http://localhost:3338',
					amount: 21,
					requiresWalletHandoff: false
				},
				createdAt: 1,
				updatedAt: 1,
				recovery: { token: 'cashuB-local-fixture-only' }
			});
			await new Promise<void>((resolve, reject) => {
				transaction.oncomplete = () => resolve();
				transaction.onerror = () => reject(transaction.error);
			});
			database.close();
			const registration = await navigator.serviceWorker.ready;
			await registration.update();
		});

		await context.setOffline(true);
		await page.goto(`${url}?offline=1`);
		await expect(page.getByRole('heading', { name: title })).toBeVisible();
		await expect(
			page.getByText('Showing verified cached bounty data while relays reconnect.')
		).toBeVisible();
		await expect(page.getByText('Status: recovery-required')).toBeVisible();
		const pendingId = await page.evaluate(async () => {
			const request = indexedDB.open('bounty.ninja:payment-journal', 2);
			const database = await new Promise<IDBDatabase>((resolve, reject) => {
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			const transaction = database.transaction('operations', 'readonly');
			const get = transaction.objectStore('operations').get('pending-across-service-worker-update');
			const record = await new Promise<{ id?: string } | undefined>((resolve, reject) => {
				get.onsuccess = () => resolve(get.result);
				get.onerror = () => reject(get.error);
			});
			database.close();
			return record?.id;
		});
		expect(pendingId).toBe('pending-across-service-worker-update');
	});
});
