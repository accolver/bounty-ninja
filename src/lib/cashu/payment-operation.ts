import type { Proof } from '@cashu/cashu-ts';
import type { NostrEvent } from 'nostr-tools';
import {
	paymentJournal,
	type PaymentOperationIntent,
	type PaymentOperationJournal,
	type PaymentOperationRecord,
	type PaymentOperationRecovery
} from './payment-journal';
import { assertPaymentWritesEnabled } from '$lib/utils/env';

export interface CreatedPaymentOutputs {
	proofs?: Proof[];
	token?: string;
}

export interface PaymentOperationDriver {
	spend(): Promise<CreatedPaymentOutputs>;
	sign(outputs: PaymentOperationRecovery): Promise<NostrEvent>;
	publish(event: NostrEvent): Promise<{ acknowledged: boolean; acknowledgedAt?: number }>;
	handoff?(outputs: PaymentOperationRecovery): Promise<void>;
}

export class PaymentRecoveryRequiredError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PaymentRecoveryRequiredError';
	}
}

function failureClass(
	error: unknown
): 'network' | 'mint' | 'signer' | 'relay' | 'validation' | 'unknown' {
	const message = error instanceof Error ? error.message : String(error);
	if (/relay|publish|acknowledg/i.test(message)) return 'relay';
	if (/sign/i.test(message)) return 'signer';
	if (/mint|proof|spend|swap/i.test(message)) return 'mint';
	if (/network|offline|connection|fetch|timeout/i.test(message)) return 'network';
	if (/invalid|validation|missing|mismatch/i.test(message)) return 'validation';
	return 'unknown';
}

async function requireRecovery(
	journal: PaymentOperationJournal,
	record: PaymentOperationRecord,
	error: unknown
): Promise<never> {
	const message = error instanceof Error ? error.message : String(error);
	const current = (await journal.get(record.id)) ?? record;
	if (current.status !== 'recovery-required') {
		await journal.transition(current.id, 'recovery-required', {
			failureClass: failureClass(error)
		});
	}
	throw new PaymentRecoveryRequiredError(message);
}

async function confirmPublished(
	journal: PaymentOperationJournal,
	record: PaymentOperationRecord,
	driver: PaymentOperationDriver
): Promise<PaymentOperationRecord> {
	let recovery = record.recovery;
	if (record.intent.requiresWalletHandoff) {
		if (!driver.handoff || !recovery) {
			return requireRecovery(journal, record, new Error('Wallet handoff is unavailable'));
		}
		try {
			await driver.handoff(recovery);
			recovery = { ...recovery, walletHandoffConfirmedAt: Date.now() };
		} catch (error) {
			return requireRecovery(journal, record, error);
		}
	}
	return journal.transition(record.id, 'confirmed', { recovery });
}

async function publishSigned(
	journal: PaymentOperationJournal,
	record: PaymentOperationRecord,
	driver: PaymentOperationDriver
): Promise<PaymentOperationRecord> {
	if (!record.signedEvent) {
		return requireRecovery(journal, record, new Error('Exact signed event is unavailable'));
	}
	let result: Awaited<ReturnType<PaymentOperationDriver['publish']>>;
	try {
		result = await driver.publish(structuredClone(record.signedEvent));
		if (!result.acknowledged) throw new Error('No relay acknowledged the exact signed event');
	} catch (error) {
		return requireRecovery(journal, record, error);
	}
	const published = await journal.transition(record.id, 'published', {
		relayAcknowledgedAt: result.acknowledgedAt ?? Date.now()
	});
	return confirmPublished(journal, published, driver);
}

async function signOutputs(
	journal: PaymentOperationJournal,
	record: PaymentOperationRecord,
	driver: PaymentOperationDriver
): Promise<PaymentOperationRecord> {
	if (!record.recovery) {
		return requireRecovery(journal, record, new Error('Created outputs are unavailable'));
	}
	let event: NostrEvent;
	try {
		event = await driver.sign(structuredClone(record.recovery));
	} catch (error) {
		return requireRecovery(journal, record, error);
	}
	const signed = await journal.transition(record.id, 'event-signed', { signedEvent: event });
	return publishSigned(journal, signed, driver);
}

async function spendPrepared(
	journal: PaymentOperationJournal,
	record: PaymentOperationRecord,
	driver: PaymentOperationDriver
): Promise<PaymentOperationRecord> {
	const spending = await journal.transition(record.id, 'spending');
	let outputs: CreatedPaymentOutputs;
	try {
		outputs = await driver.spend();
	} catch (error) {
		return requireRecovery(journal, spending, error);
	}
	const created = await journal.transition(record.id, 'outputs-created', {
		recovery: {
			outputProofs: outputs.proofs ? structuredClone(outputs.proofs) : undefined,
			token: outputs.token
		}
	});
	return signOutputs(journal, created, driver);
}

export async function startPaymentOperation(
	intent: PaymentOperationIntent,
	driver: PaymentOperationDriver,
	journal: PaymentOperationJournal = paymentJournal
): Promise<PaymentOperationRecord> {
	assertPaymentWritesEnabled();
	const prepared = await journal.create(intent);
	return spendPrepared(journal, prepared, driver);
}

export async function resumePaymentOperation(
	id: string,
	driver: PaymentOperationDriver,
	journal: PaymentOperationJournal = paymentJournal
): Promise<PaymentOperationRecord> {
	assertPaymentWritesEnabled();
	const record = await journal.get(id);
	if (!record) throw new Error(`Payment operation not found: ${id}`);
	if (record.status === 'confirmed') return record;
	if (record.status === 'failed') throw new Error('Failed payment operation cannot be resumed');
	if (record.status === 'prepared') return spendPrepared(journal, record, driver);
	if (record.status === 'spending') {
		return requireRecovery(journal, record, new Error('Mint spend outcome is unknown'));
	}
	if (record.status === 'outputs-created') return signOutputs(journal, record, driver);
	if (record.status === 'event-signed') return publishSigned(journal, record, driver);
	if (record.status === 'published') return confirmPublished(journal, record, driver);
	if (record.signedEvent) return publishSigned(journal, record, driver);
	if (record.recovery) return signOutputs(journal, record, driver);
	throw new PaymentRecoveryRequiredError('Recovery material is unavailable');
}
