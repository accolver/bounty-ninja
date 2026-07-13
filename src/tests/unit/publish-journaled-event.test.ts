// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$lib/utils/env', () => ({ assertPaymentWritesEnabled: vi.fn() }));
import { IDBFactory } from 'fake-indexeddb';
import type { NostrEvent } from 'nostr-tools';
import { PaymentOperationJournal } from '$lib/cashu/payment-journal';
import { publishJournaledEvent } from '$lib/cashu/publish-journaled-event';

const signedPledge = {
	id: 'a'.repeat(64),
	pubkey: 'b'.repeat(64),
	created_at: 1,
	kind: 73002,
	tags: [],
	content: '',
	sig: 'c'.repeat(128)
} satisfies NostrEvent;

describe('publishJournaledEvent', () => {
	let journal: PaymentOperationJournal;

	beforeEach(async () => {
		journal = new PaymentOperationJournal(new IDBFactory(), crypto.randomUUID());
		const record = await journal.create(
			{
				kind: 'pledge',
				sourceEventIds: [],
				mintUrl: 'https://mint.example',
				amount: 21,
				requiresWalletHandoff: false,
				targetPaymentPubkey: `02${'d'.repeat(64)}`,
				bountyAddress: `37300:${'e'.repeat(64)}:bounty`
			},
			'pledge',
			{ recovery: { token: 'cashuBpledge' } }
		);
		await journal.transition(record.id, 'token-verified');
		await journal.transition(record.id, 'event-signed', { signedEvent: signedPledge });
	});

	afterEach(async () => journal.close());

	it('enters recoverable state without relay acknowledgement on failure', async () => {
		const publish = vi.fn().mockResolvedValue({ success: false });
		const record = (await journal.get('pledge'))!;

		await expect(publishJournaledEvent(record, journal, publish)).rejects.toThrow(
			'No relay accepted'
		);
		const retained = await journal.get('pledge');
		expect(retained).toMatchObject({
			status: 'recovery-required',
			failureClass: 'relay',
			signedEvent: signedPledge
		});
		expect(retained?.relayAcknowledgedAt).toBeUndefined();
		await expect(publishJournaledEvent(retained!, journal, publish)).rejects.toThrow(
			'No relay accepted'
		);
		expect((await journal.get('pledge'))?.status).toBe('recovery-required');
	});

	it('retries the exact signed pledge event and confirms only after acknowledgement', async () => {
		const seen: NostrEvent[] = [];
		const publish = vi
			.fn()
			.mockImplementationOnce(async (event: NostrEvent) => {
				seen.push(event);
				return { success: false };
			})
			.mockImplementationOnce(async (event: NostrEvent) => {
				seen.push(event);
				return { success: true };
			});
		let record = (await journal.get('pledge'))!;
		await expect(publishJournaledEvent(record, journal, publish)).rejects.toThrow();
		record = (await journal.get('pledge'))!;
		await expect(publishJournaledEvent(record, journal, publish)).resolves.toMatchObject({
			status: 'confirmed',
			relayAcknowledgedAt: expect.any(Number)
		});
		expect(seen).toEqual([signedPledge, signedPledge]);
		expect(seen[0].id).toBe(seen[1].id);
		expect(seen[0].sig).toBe(seen[1].sig);
	});
});
