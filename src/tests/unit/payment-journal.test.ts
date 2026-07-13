// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
	PAYMENT_JOURNAL_SCHEMA_VERSION,
	PaymentOperationJournal,
	type PaymentOperationIntent
} from '$lib/cashu/payment-journal';
import type { NostrEvent } from 'nostr-tools';

const intent: PaymentOperationIntent = {
	kind: 'release',
	sourceEventIds: ['pledge-id'],
	mintUrl: 'https://mint.example',
	amount: 21,
	requiresWalletHandoff: true
};

const signedEvent = {
	id: 'a'.repeat(64),
	pubkey: 'b'.repeat(64),
	created_at: 1,
	kind: 7304,
	tags: [],
	content: '',
	sig: 'c'.repeat(128)
} satisfies NostrEvent;

describe('PaymentOperationJournal', () => {
	let factory: IDBFactory;
	let journal: PaymentOperationJournal;

	beforeEach(() => {
		factory = new IDBFactory();
		journal = new PaymentOperationJournal(factory, 'payment-journal-test');
	});

	afterEach(async () => journal.close());

	it('persists versioned prepared intent across journal instances', async () => {
		const created = await journal.create(intent, 'operation-1');
		expect(created).toMatchObject({
			id: 'operation-1',
			schemaVersion: PAYMENT_JOURNAL_SCHEMA_VERSION,
			status: 'prepared',
			intent
		});

		await journal.close();
		journal = new PaymentOperationJournal(factory, 'payment-journal-test');
		expect(await journal.get('operation-1')).toEqual(created);
	});

	it('persists manual external-wallet stages and target key across reload', async () => {
		const manualIntent = { ...intent, targetPaymentPubkey: `02${'a'.repeat(64)}` };
		await journal.create(manualIntent, 'manual-release');
		await journal.transition('manual-release', 'awaiting-wallet');
		await journal.transition('manual-release', 'token-verified', {
			recovery: { token: 'cashuBsolver' }
		});
		await journal.close();
		journal = new PaymentOperationJournal(factory, 'payment-journal-test');
		expect(await journal.get('manual-release')).toMatchObject({
			status: 'token-verified',
			intent: manualIntent,
			recovery: { token: 'cashuBsolver' }
		});
	});

	it('persists validated pledge token and bounty context before signing', async () => {
		const pledgeIntent: PaymentOperationIntent = {
			kind: 'pledge',
			sourceEventIds: [],
			mintUrl: 'https://mint.example',
			amount: 21,
			requiresWalletHandoff: false,
			targetPaymentPubkey: `02${'d'.repeat(64)}`,
			bountyAddress: `37300:${'e'.repeat(64)}:bounty`,
			eventContent: 'saved message'
		};
		await journal.create(pledgeIntent, 'pledge', { recovery: { token: 'cashuBpledge' } });
		await journal.transition('pledge', 'token-verified');
		await journal.close();
		journal = new PaymentOperationJournal(factory, 'payment-journal-test');

		expect(await journal.get('pledge')).toMatchObject({
			status: 'token-verified',
			intent: pledgeIntent,
			recovery: { token: 'cashuBpledge' }
		});
	});

	it('upgrades an existing version-one journal without recreating its store', async () => {
		const legacyName = 'legacy-payment-journal';
		await new Promise<void>((resolve, reject) => {
			const request = factory.open(legacyName, 1);
			request.onupgradeneeded = () => {
				request.result.createObjectStore('operations', { keyPath: 'id' });
			};
			request.onsuccess = () => {
				request.result.close();
				resolve();
			};
			request.onerror = () => reject(request.error);
		});

		const upgraded = new PaymentOperationJournal(factory, legacyName);
		await expect(upgraded.create(intent, 'after-upgrade')).resolves.toMatchObject({
			schemaVersion: PAYMENT_JOURNAL_SCHEMA_VERSION,
			status: 'prepared'
		});
		await upgraded.close();
	});

	it('enforces forward-only payment state transitions', async () => {
		await journal.create(intent, 'operation-1');
		await journal.transition('operation-1', 'spending');
		await expect(journal.transition('operation-1', 'prepared')).rejects.toThrow(
			'spending -> prepared'
		);
	});

	it('requires recovery material before recording created outputs', async () => {
		await journal.create(intent, 'operation-1');
		await journal.transition('operation-1', 'spending');
		await expect(journal.transition('operation-1', 'outputs-created')).rejects.toThrow(
			'recovery material'
		);
		const output = await journal.transition('operation-1', 'outputs-created', {
			recovery: {
				outputProofs: [{ id: 'keyset', amount: 21, secret: 'secret', C: 'point' }]
			}
		});
		expect(output.recovery?.outputProofs).toHaveLength(1);
	});

	it('stores and reuses the exact signed event', async () => {
		await journal.create(intent, 'operation-1');
		await journal.transition('operation-1', 'spending');
		await journal.transition('operation-1', 'outputs-created', {
			recovery: { token: 'cashuBrecovery' }
		});
		const signed = await journal.transition('operation-1', 'event-signed', { signedEvent });
		expect(signed.signedEvent).toEqual(signedEvent);
		await expect(journal.transition('operation-1', 'published')).resolves.toMatchObject({
			signedEvent
		});
	});

	it('requires relay and wallet acknowledgement before confirmation', async () => {
		await journal.create(intent, 'operation-1');
		await journal.transition('operation-1', 'spending');
		await journal.transition('operation-1', 'outputs-created', {
			recovery: { token: 'cashuBrecovery' }
		});
		await journal.transition('operation-1', 'event-signed', { signedEvent });
		await journal.transition('operation-1', 'published');
		await expect(journal.transition('operation-1', 'confirmed')).rejects.toThrow(
			'relay acknowledgement'
		);
		await expect(
			journal.transition('operation-1', 'confirmed', { relayAcknowledgedAt: 2 })
		).rejects.toThrow('wallet handoff');
		await expect(
			journal.transition('operation-1', 'confirmed', {
				relayAcknowledgedAt: 2,
				recovery: { token: 'cashuBrecovery', walletHandoffConfirmedAt: 3 }
			})
		).resolves.toMatchObject({ status: 'confirmed' });
	});

	it('lists every non-terminal operation in deterministic order', async () => {
		await journal.create(intent, 'b');
		await journal.create(intent, 'a');
		await journal.transition('a', 'failed', { failureClass: 'validation' });
		expect((await journal.listPending()).map((record) => record.id)).toEqual(['b']);
	});

	it('requires explicit acknowledgement and retains the terminal recovery record', async () => {
		await journal.create(intent, 'operation-1');
		const acknowledged = await journal.acknowledgeRecovery('operation-1');
		expect(acknowledged).toMatchObject({
			status: 'failed',
			recoveryAcknowledgedAt: expect.any(Number)
		});
		expect(await journal.listPending()).toEqual([]);
		expect(await journal.get('operation-1')).toEqual(acknowledged);
		await expect(journal.acknowledgeRecovery('operation-1')).rejects.toThrow(
			'cannot be acknowledged'
		);
	});

	it('rejects unsafe operation intent', async () => {
		await expect(journal.create({ ...intent, sourceEventIds: [] })).rejects.toThrow('source event');
		await expect(journal.create({ ...intent, amount: 0 })).rejects.toThrow('positive integer');
		await expect(journal.create({ ...intent, mintUrl: 'http://mint.example' })).rejects.toThrow(
			'use HTTPS'
		);
		await expect(
			journal.create({ ...intent, mintUrl: 'http://localhost:3338' }, 'localhost')
		).resolves.toMatchObject({ status: 'prepared' });
		await expect(journal.create({ ...intent, kind: 'pledge', sourceEventIds: [] })).rejects.toThrow(
			'valid bounty address'
		);
	});

	it('rejects missing records and signed states without an exact event', async () => {
		expect(await journal.get('missing')).toBeNull();
		await expect(journal.transition('missing', 'failed')).rejects.toThrow('not found');
		await expect(journal.acknowledgeRecovery('missing')).rejects.toThrow('not found');

		await journal.create(intent, 'operation-1');
		await journal.transition('operation-1', 'spending');
		await journal.transition('operation-1', 'outputs-created', {
			recovery: { token: 'cashuBrecovery' }
		});
		await expect(journal.transition('operation-1', 'event-signed')).rejects.toThrow(
			'exact signed event'
		);
	});

	it('fails closed when IndexedDB is unavailable and closes unopened journals safely', async () => {
		const unavailable = new PaymentOperationJournal(undefined, 'unavailable');
		await unavailable.close();
		await expect(unavailable.create(intent, 'operation-1')).rejects.toThrow(
			'IndexedDB is unavailable'
		);
	});

	it('reports IndexedDB open failures', async () => {
		const request = {
			error: new Error('storage denied'),
			onerror: null
		} as unknown as IDBOpenDBRequest;
		const failingFactory = {
			open: vi.fn(() => {
				queueMicrotask(() => request.onerror?.(new Event('error')));
				return request;
			})
		} as unknown as IDBFactory;
		const failing = new PaymentOperationJournal(failingFactory, 'failing');
		await expect(failing.create(intent, 'operation-1')).rejects.toThrow('storage denied');
	});

	it('preserves an existing failure classification during acknowledgement', async () => {
		await journal.create(intent, 'operation-1');
		await journal.transition('operation-1', 'spending');
		await journal.transition('operation-1', 'recovery-required', { failureClass: 'relay' });
		await expect(journal.acknowledgeRecovery('operation-1')).resolves.toMatchObject({
			status: 'failed',
			failureClass: 'relay'
		});
	});
});
