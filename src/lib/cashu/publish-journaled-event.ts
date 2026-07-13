import type { NostrEvent } from 'nostr-tools';
import {
	paymentJournal,
	type PaymentOperationJournal,
	type PaymentOperationRecord
} from './payment-journal';
import { publishSignedEvent } from '$lib/nostr/signer.svelte';
import { assertPaymentWritesEnabled } from '$lib/utils/env';

type PublishSigned = (event: NostrEvent) => Promise<{ success: boolean }>;

/** Persist relay acknowledgement only after a relay accepts the exact signed event. */
export async function publishJournaledEvent(
	record: PaymentOperationRecord,
	journal: PaymentOperationJournal = paymentJournal,
	publish: PublishSigned = publishSignedEvent
): Promise<PaymentOperationRecord> {
	assertPaymentWritesEnabled();
	if (!record.signedEvent) throw new Error('The exact signed event is unavailable');

	let broadcast: { success: boolean };
	try {
		broadcast = await publish(record.signedEvent);
	} catch (error) {
		if (record.status !== 'recovery-required') {
			await journal.transition(record.id, 'recovery-required', { failureClass: 'relay' });
		}
		throw error;
	}
	if (!broadcast.success) {
		if (record.status !== 'recovery-required') {
			await journal.transition(record.id, 'recovery-required', { failureClass: 'relay' });
		}
		throw new Error('No relay accepted the event');
	}

	const published = await journal.transition(record.id, 'published', {
		relayAcknowledgedAt: Date.now()
	});
	return journal.transition(published.id, 'confirmed');
}
