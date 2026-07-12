import { PAYMENT_JOURNAL_SCHEMA_VERSION } from '$lib/cashu/payment-journal-version';

export const SERVICE_WORKER_UPDATE_PROTOCOL_VERSION = 1;

export interface ServiceWorkerUpdateMetadata {
	protocolVersion: typeof SERVICE_WORKER_UPDATE_PROTOCOL_VERSION;
	minimumPaymentJournalSchema: number;
	maximumPaymentJournalSchema: number;
}

export type ServiceWorkerUpdateRequest =
	| { type: 'GET_UPDATE_METADATA' }
	| {
			type: 'ACTIVATE_UPDATE';
			protocolVersion: number;
			pendingPaymentJournalSchemas: number[];
	  };

export const serviceWorkerUpdateMetadata: ServiceWorkerUpdateMetadata = {
	protocolVersion: SERVICE_WORKER_UPDATE_PROTOCOL_VERSION,
	minimumPaymentJournalSchema: PAYMENT_JOURNAL_SCHEMA_VERSION,
	maximumPaymentJournalSchema: PAYMENT_JOURNAL_SCHEMA_VERSION
};

export function supportsPendingPaymentSchemas(
	schemas: readonly number[],
	metadata: ServiceWorkerUpdateMetadata
): boolean {
	return (
		Number.isSafeInteger(metadata.minimumPaymentJournalSchema) &&
		Number.isSafeInteger(metadata.maximumPaymentJournalSchema) &&
		metadata.minimumPaymentJournalSchema <= metadata.maximumPaymentJournalSchema &&
		schemas.every(
			(schema) =>
				Number.isSafeInteger(schema) &&
				schema >= metadata.minimumPaymentJournalSchema &&
				schema <= metadata.maximumPaymentJournalSchema
		)
	);
}
