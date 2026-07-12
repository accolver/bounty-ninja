// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { finalizeEvent } from 'nostr-tools';
import { payoutBlueprint } from '$lib/bounty/blueprints';
import { PaymentOperationJournal } from '$lib/cashu/payment-journal';

describe('manual source-bound payment workflow', () => {
	it('survives reload with the exact signed payout and source pledge reference', async () => {
		const factory = new IDBFactory();
		const dbName = 'manual-payment-integration';
		const sourcePledgeId = '1'.repeat(64);
		const solutionId = '2'.repeat(64);
		const solverPubkey = '3'.repeat(64);
		const paymentPubkey = '4'.repeat(64);
		let journal = new PaymentOperationJournal(factory, dbName);

		const prepared = await journal.create(
			{
				kind: 'release',
				sourceEventIds: [sourcePledgeId],
				mintUrl: 'https://mint.example',
				amount: 21,
				requiresWalletHandoff: false,
				targetPaymentPubkey: paymentPubkey
			},
			'manual-release'
		);
		await journal.transition(prepared.id, 'awaiting-wallet');
		await journal.transition(prepared.id, 'token-verified', {
			recovery: { token: 'cashuBsolverlocked' }
		});
		await journal.transition(prepared.id, 'source-spent');

		const event = finalizeEvent(
			payoutBlueprint({
				bountyAddress: `37300:${'5'.repeat(64)}:bounty`,
				solutionId,
				sourcePledgeId,
				solverPubkey,
				paymentPubkey,
				amount: 21,
				cashuToken: 'cashuBsolverlocked',
				mintUrl: 'https://mint.example'
			}),
			new Uint8Array(32).fill(7)
		);
		await journal.transition(prepared.id, 'event-signed', { signedEvent: event });
		await journal.close();

		journal = new PaymentOperationJournal(factory, dbName);
		const recovered = await journal.get(prepared.id);
		expect(JSON.stringify(recovered?.signedEvent)).toBe(JSON.stringify(event));
		expect(recovered?.recovery?.token).toBe('cashuBsolverlocked');
		expect(event.tags).toContainEqual(['e', sourcePledgeId, '', 'source']);
		expect(event.tags).toContainEqual(['payment', 'cashu', paymentPubkey]);

		await journal.transition(prepared.id, 'published', { relayAcknowledgedAt: Date.now() });
		await expect(journal.transition(prepared.id, 'confirmed')).resolves.toMatchObject({
			status: 'confirmed',
			signedEvent: event
		});
		await journal.close();
	});
});
