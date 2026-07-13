// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$lib/utils/env', () => ({ assertPaymentWritesEnabled: vi.fn() }));
import { IDBFactory } from 'fake-indexeddb';
import { PaymentOperationJournal, type PaymentOperationIntent } from '$lib/cashu/payment-journal';
import {
	PaymentRecoveryRequiredError,
	resumePaymentOperation,
	startPaymentOperation,
	type PaymentOperationDriver
} from '$lib/cashu/payment-operation';
import type { NostrEvent } from 'nostr-tools';

const intent: PaymentOperationIntent = {
	kind: 'release',
	sourceEventIds: ['pledge-id'],
	mintUrl: 'https://mint.example',
	amount: 10,
	requiresWalletHandoff: false
};

const event = {
	id: 'a'.repeat(64),
	pubkey: 'b'.repeat(64),
	created_at: 1,
	kind: 7304,
	tags: [],
	content: 'exact event',
	sig: 'c'.repeat(128)
} satisfies NostrEvent;

describe('payment operation orchestration', () => {
	let journal: PaymentOperationJournal;
	let driver: PaymentOperationDriver;

	beforeEach(() => {
		journal = new PaymentOperationJournal(new IDBFactory(), crypto.randomUUID());
		driver = {
			spend: vi.fn(async () => ({
				proofs: [{ id: 'keyset', amount: 10, secret: 'secret', C: 'point' }]
			})),
			sign: vi.fn(async () => structuredClone(event)),
			publish: vi.fn(async () => ({ acknowledged: true, acknowledgedAt: 5 }))
		};
	});

	it('persists every recovery boundary before invoking the next irreversible step', async () => {
		driver.spend = vi.fn(async () => {
			const [record] = await journal.listPending();
			expect(record.status).toBe('spending');
			return { proofs: [{ id: 'keyset', amount: 10, secret: 'secret', C: 'point' }] };
		});
		driver.sign = vi.fn(async () => {
			const [record] = await journal.listPending();
			expect(record.status).toBe('outputs-created');
			expect(record.recovery?.outputProofs).toHaveLength(1);
			return structuredClone(event);
		});
		driver.publish = vi.fn(async (signedEvent) => {
			const [record] = await journal.listPending();
			expect(record.status).toBe('event-signed');
			expect(record.signedEvent).toEqual(event);
			expect(signedEvent).toEqual(event);
			return { acknowledged: true, acknowledgedAt: 5 };
		});

		await expect(startPaymentOperation(intent, driver, journal)).resolves.toMatchObject({
			status: 'confirmed',
			relayAcknowledgedAt: 5
		});
	});

	it('preserves the exact signed event when all relays reject publication', async () => {
		driver.publish = vi.fn(async () => ({ acknowledged: false }));
		await expect(startPaymentOperation(intent, driver, journal)).rejects.toBeInstanceOf(
			PaymentRecoveryRequiredError
		);
		const [record] = await journal.listPending();
		expect(record).toMatchObject({ status: 'recovery-required', signedEvent: event });
	});

	it('resumes publication with the exact event without repeating spend or signing', async () => {
		driver.publish = vi
			.fn()
			.mockResolvedValueOnce({ acknowledged: false })
			.mockResolvedValueOnce({ acknowledged: true, acknowledgedAt: 7 });
		await expect(startPaymentOperation(intent, driver, journal)).rejects.toBeInstanceOf(
			PaymentRecoveryRequiredError
		);
		const [pending] = await journal.listPending();
		const spendCalls = vi.mocked(driver.spend).mock.calls.length;
		const signCalls = vi.mocked(driver.sign).mock.calls.length;

		const resumed = await resumePaymentOperation(pending.id, driver, journal);
		expect(resumed.status).toBe('confirmed');
		expect(driver.publish).toHaveBeenLastCalledWith(event);
		expect(driver.spend).toHaveBeenCalledTimes(spendCalls);
		expect(driver.sign).toHaveBeenCalledTimes(signCalls);
	});

	it('never repeats a mint call after reload with an uncertain spending state', async () => {
		const prepared = await journal.create(intent, 'uncertain');
		await journal.transition(prepared.id, 'spending');
		await expect(resumePaymentOperation(prepared.id, driver, journal)).rejects.toThrow(
			'Mint spend outcome is unknown'
		);
		expect(driver.spend).not.toHaveBeenCalled();
		expect(await journal.get(prepared.id)).toMatchObject({ status: 'recovery-required' });
	});

	it('requires wallet handoff before confirmation when requested', async () => {
		const handoffIntent = { ...intent, requiresWalletHandoff: true };
		await expect(startPaymentOperation(handoffIntent, driver, journal)).rejects.toThrow(
			'Wallet handoff is unavailable'
		);
		const [pending] = await journal.listPending();
		driver.handoff = vi.fn(async () => {});
		const completed = await resumePaymentOperation(pending.id, driver, journal);
		expect(completed.recovery?.walletHandoffConfirmedAt).toEqual(expect.any(Number));
	});

	it('classifies a failed mint spend and preserves it for recovery', async () => {
		driver.spend = vi.fn(async () => {
			throw new Error('Mint swap failed');
		});
		await expect(startPaymentOperation(intent, driver, journal)).rejects.toThrow(
			'Mint swap failed'
		);
		const [pending] = await journal.listPending();
		expect(pending).toMatchObject({ status: 'recovery-required', failureClass: 'mint' });
		expect(driver.sign).not.toHaveBeenCalled();
	});

	it('classifies signer and handoff failures without losing outputs', async () => {
		driver.sign = vi.fn(async () => {
			throw new Error('Signer rejected request');
		});
		await expect(startPaymentOperation(intent, driver, journal)).rejects.toThrow('Signer rejected');
		let [pending] = await journal.listPending();
		expect(pending).toMatchObject({ status: 'recovery-required', failureClass: 'signer' });
		expect(pending.recovery?.outputProofs).toHaveLength(1);

		journal = new PaymentOperationJournal(new IDBFactory(), crypto.randomUUID());
		driver.sign = vi.fn(async () => structuredClone(event));
		driver.handoff = vi.fn(async () => {
			throw new Error('Wallet offline');
		});
		await expect(
			startPaymentOperation({ ...intent, requiresWalletHandoff: true }, driver, journal)
		).rejects.toThrow('Wallet offline');
		[pending] = await journal.listPending();
		expect(pending).toMatchObject({ status: 'recovery-required', failureClass: 'network' });
	});

	it('supports token-only outputs and relay acknowledgements without timestamps', async () => {
		driver.spend = vi.fn(async () => ({ token: 'cashuBrecovery' }));
		driver.publish = vi.fn(async () => ({ acknowledged: true }));
		const completed = await startPaymentOperation(intent, driver, journal);
		expect(completed.status).toBe('confirmed');
		expect(completed.recovery).toEqual({ token: 'cashuBrecovery' });
		expect(completed.relayAcknowledgedAt).toEqual(expect.any(Number));
	});

	it('resumes prepared, outputs-created, event-signed, and published records', async () => {
		const prepared = await journal.create(intent, 'prepared');
		await expect(resumePaymentOperation(prepared.id, driver, journal)).resolves.toMatchObject({
			status: 'confirmed'
		});

		const outputs = await journal.create(intent, 'outputs');
		await journal.transition(outputs.id, 'spending');
		await journal.transition(outputs.id, 'outputs-created', {
			recovery: { token: 'cashuBoutputs' }
		});
		await expect(resumePaymentOperation(outputs.id, driver, journal)).resolves.toMatchObject({
			status: 'confirmed'
		});

		const signed = await journal.create(intent, 'signed');
		await journal.transition(signed.id, 'spending');
		await journal.transition(signed.id, 'outputs-created', {
			recovery: { token: 'cashuBsigned' }
		});
		await journal.transition(signed.id, 'event-signed', { signedEvent: event });
		await expect(resumePaymentOperation(signed.id, driver, journal)).resolves.toMatchObject({
			status: 'confirmed'
		});

		const published = await journal.create(intent, 'published');
		await journal.transition(published.id, 'spending');
		await journal.transition(published.id, 'outputs-created', {
			recovery: { token: 'cashuBpublished' }
		});
		await journal.transition(published.id, 'event-signed', { signedEvent: event });
		await journal.transition(published.id, 'published', { relayAcknowledgedAt: 9 });
		await expect(resumePaymentOperation(published.id, driver, journal)).resolves.toMatchObject({
			status: 'confirmed',
			relayAcknowledgedAt: 9
		});
	});

	it('returns confirmed records and rejects missing or failed operations', async () => {
		await expect(resumePaymentOperation('missing', driver, journal)).rejects.toThrow('not found');
		const failed = await journal.create(intent, 'failed');
		await journal.transition(failed.id, 'failed');
		await expect(resumePaymentOperation(failed.id, driver, journal)).rejects.toThrow(
			'cannot be resumed'
		);

		const confirmed = await startPaymentOperation(intent, driver, journal);
		expect(await resumePaymentOperation(confirmed.id, driver, journal)).toEqual(confirmed);
	});

	it('refuses recovery records that have neither outputs nor a signed event', async () => {
		const record = await journal.create(intent, 'empty-recovery');
		await journal.transition(record.id, 'spending');
		await journal.transition(record.id, 'recovery-required');
		await expect(resumePaymentOperation(record.id, driver, journal)).rejects.toThrow(
			'Recovery material is unavailable'
		);
	});
});
