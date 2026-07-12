import { config } from '$lib/config';
import type { Proof } from '@cashu/cashu-ts';
import type { NostrEvent } from 'nostr-tools';
import { PAYMENT_JOURNAL_SCHEMA_VERSION } from './payment-journal-version';

export { PAYMENT_JOURNAL_SCHEMA_VERSION } from './payment-journal-version';
export const PAYMENT_JOURNAL_DB_NAME = `${config.storagePrefix}:payment-journal`;

export type PaymentOperationStatus =
	| 'prepared'
	| 'awaiting-wallet'
	| 'token-verified'
	| 'source-spent'
	| 'spending'
	| 'outputs-created'
	| 'event-signed'
	| 'published'
	| 'confirmed'
	| 'recovery-required'
	| 'failed';

export type PaymentOperationKind = 'pledge' | 'release' | 'reclaim' | 'claim';

export interface PaymentOperationIntent {
	kind: PaymentOperationKind;
	sourceEventIds: string[];
	mintUrl: string;
	amount: number;
	requiresWalletHandoff: boolean;
	targetPaymentPubkey?: string;
	bountyAddress?: string;
	eventContent?: string;
}

export interface PaymentOperationRecovery {
	outputProofs?: Proof[];
	token?: string;
	walletHandoffConfirmedAt?: number;
}

export interface PaymentOperationRecord {
	id: string;
	schemaVersion: typeof PAYMENT_JOURNAL_SCHEMA_VERSION;
	status: PaymentOperationStatus;
	intent: PaymentOperationIntent;
	createdAt: number;
	updatedAt: number;
	signedEvent?: NostrEvent;
	relayAcknowledgedAt?: number;
	recoveryAcknowledgedAt?: number;
	recovery?: PaymentOperationRecovery;
	failureClass?: 'network' | 'mint' | 'signer' | 'relay' | 'validation' | 'unknown';
}

export type PaymentOperationPatch = Partial<
	Pick<
		PaymentOperationRecord,
		'signedEvent' | 'relayAcknowledgedAt' | 'recoveryAcknowledgedAt' | 'recovery' | 'failureClass'
	>
>;

const STORE_NAME = 'operations';
const TERMINAL_STATUSES = new Set<PaymentOperationStatus>(['confirmed', 'failed']);
const TRANSITIONS: Record<PaymentOperationStatus, readonly PaymentOperationStatus[]> = {
	prepared: ['awaiting-wallet', 'token-verified', 'spending', 'failed'],
	'awaiting-wallet': ['token-verified', 'source-spent', 'recovery-required', 'failed'],
	'token-verified': ['source-spent', 'event-signed', 'recovery-required', 'failed'],
	'source-spent': ['event-signed', 'recovery-required', 'failed'],
	spending: ['outputs-created', 'recovery-required', 'failed'],
	'outputs-created': ['event-signed', 'recovery-required', 'failed'],
	'event-signed': ['published', 'recovery-required', 'failed'],
	published: ['confirmed', 'recovery-required', 'failed'],
	'recovery-required': ['event-signed', 'published', 'confirmed', 'failed'],
	confirmed: [],
	failed: []
};

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
	});
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () =>
			reject(transaction.error ?? new Error('IndexedDB transaction failed'));
		transaction.onabort = () =>
			reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
	});
}

function validateIntent(intent: PaymentOperationIntent): void {
	if (intent.kind !== 'pledge' && intent.sourceEventIds.length === 0)
		throw new Error('Payment operation requires a source event');
	if (intent.kind === 'pledge') {
		const addressParts = intent.bountyAddress?.split(':') ?? [];
		if (
			addressParts.length !== 3 ||
			addressParts[0] !== '37300' ||
			!/^[0-9a-f]{64}$/i.test(addressParts[1]) ||
			!addressParts[2]
		) {
			throw new Error('Pledge operation requires a valid bounty address');
		}
		if (!intent.targetPaymentPubkey || !/^[0-9a-f]{64}$/i.test(intent.targetPaymentPubkey)) {
			throw new Error('Pledge operation requires a valid payment public key');
		}
	}
	if (!Number.isSafeInteger(intent.amount) || intent.amount <= 0) {
		throw new Error('Payment operation amount must be a positive integer');
	}
	const mint = new URL(intent.mintUrl);
	if (mint.protocol !== 'https:' && mint.hostname !== 'localhost') {
		throw new Error('Payment operation mint must use HTTPS');
	}
}

function validateState(record: PaymentOperationRecord): void {
	if (
		record.intent.kind === 'pledge' &&
		['token-verified', 'event-signed', 'published', 'confirmed'].includes(record.status) &&
		!record.recovery?.token
	) {
		throw new Error('Pledge operation requires its validated token');
	}
	if (
		record.status === 'outputs-created' &&
		!record.recovery?.token &&
		!(record.recovery?.outputProofs && record.recovery.outputProofs.length > 0)
	) {
		throw new Error('Created outputs must be persisted with recovery material');
	}
	if (['event-signed', 'published', 'confirmed'].includes(record.status) && !record.signedEvent) {
		throw new Error(`${record.status} operation requires the exact signed event`);
	}
	if (record.status === 'confirmed' && !record.relayAcknowledgedAt) {
		throw new Error('Confirmed operation requires a relay acknowledgement');
	}
	if (
		record.status === 'confirmed' &&
		record.intent.requiresWalletHandoff &&
		!record.recovery?.walletHandoffConfirmedAt
	) {
		throw new Error('Confirmed operation requires wallet handoff acknowledgement');
	}
}

export class PaymentOperationJournal {
	#dbPromise: Promise<IDBDatabase> | null = null;

	constructor(
		private readonly factory?: IDBFactory,
		private readonly dbName = PAYMENT_JOURNAL_DB_NAME
	) {}

	async #database(): Promise<IDBDatabase> {
		if (!this.#dbPromise) {
			const factory = this.factory ?? globalThis.indexedDB;
			if (!factory) throw new Error('IndexedDB is unavailable; payment operations cannot start');
			this.#dbPromise = new Promise((resolve, reject) => {
				const request = factory.open(this.dbName, PAYMENT_JOURNAL_SCHEMA_VERSION);
				request.onupgradeneeded = () => {
					if (!request.result.objectStoreNames.contains(STORE_NAME)) {
						const store = request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
						store.createIndex('status', 'status');
						store.createIndex('updatedAt', 'updatedAt');
					}
				};
				request.onsuccess = () => resolve(request.result);
				request.onerror = () =>
					reject(request.error ?? new Error('Payment journal failed to open'));
				request.onblocked = () => reject(new Error('Payment journal upgrade is blocked'));
			});
		}
		return this.#dbPromise;
	}

	async create(
		intent: PaymentOperationIntent,
		id: string = crypto.randomUUID(),
		patch: Pick<PaymentOperationPatch, 'recovery'> = {}
	): Promise<PaymentOperationRecord> {
		validateIntent(intent);
		const now = Date.now();
		const record: PaymentOperationRecord = {
			id,
			schemaVersion: PAYMENT_JOURNAL_SCHEMA_VERSION,
			status: 'prepared',
			intent: structuredClone(intent),
			createdAt: now,
			updatedAt: now,
			...structuredClone(patch)
		};
		await this.#put(record);
		return record;
	}

	async get(id: string): Promise<PaymentOperationRecord | null> {
		const db = await this.#database();
		const transaction = db.transaction(STORE_NAME, 'readonly');
		const record = await requestResult(
			transaction.objectStore(STORE_NAME).get(id) as IDBRequest<PaymentOperationRecord | undefined>
		);
		await transactionDone(transaction);
		return record ?? null;
	}

	async listPending(): Promise<PaymentOperationRecord[]> {
		const db = await this.#database();
		const transaction = db.transaction(STORE_NAME, 'readonly');
		const records = await requestResult(
			transaction.objectStore(STORE_NAME).getAll() as IDBRequest<PaymentOperationRecord[]>
		);
		await transactionDone(transaction);
		return records
			.filter((record) => !TERMINAL_STATUSES.has(record.status))
			.sort((left, right) => left.updatedAt - right.updatedAt || left.id.localeCompare(right.id));
	}

	async transition(
		id: string,
		status: PaymentOperationStatus,
		patch: PaymentOperationPatch = {}
	): Promise<PaymentOperationRecord> {
		const current = await this.get(id);
		if (!current) throw new Error(`Payment operation not found: ${id}`);
		if (!TRANSITIONS[current.status].includes(status)) {
			throw new Error(`Invalid payment operation transition: ${current.status} -> ${status}`);
		}
		const next: PaymentOperationRecord = {
			...current,
			...structuredClone(patch),
			status,
			updatedAt: Date.now()
		};
		validateState(next);
		await this.#put(next);
		return next;
	}

	/** Preserve the record after explicit acknowledgement while removing it from pending UI. */
	async acknowledgeRecovery(id: string): Promise<PaymentOperationRecord> {
		const record = await this.get(id);
		if (!record) throw new Error(`Payment operation not found: ${id}`);
		if (TERMINAL_STATUSES.has(record.status)) {
			throw new Error('Terminal payment operation cannot be acknowledged again');
		}
		return this.transition(id, 'failed', {
			recoveryAcknowledgedAt: Date.now(),
			failureClass: record.failureClass ?? 'unknown'
		});
	}

	async #put(record: PaymentOperationRecord): Promise<void> {
		const db = await this.#database();
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		transaction.objectStore(STORE_NAME).put(record);
		await transactionDone(transaction);
	}

	async close(): Promise<void> {
		if (!this.#dbPromise) return;
		const db = await this.#dbPromise;
		db.close();
		this.#dbPromise = null;
	}
}

export const paymentJournal = new PaymentOperationJournal();
