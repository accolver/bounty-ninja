import {
	SERVICE_WORKER_UPDATE_PROTOCOL_VERSION,
	supportsPendingPaymentSchemas,
	type ServiceWorkerUpdateMetadata,
	type ServiceWorkerUpdateRequest
} from '$lib/service-worker-protocol';

const METADATA_TIMEOUT_MS = 2_000;

export interface PaymentUpdateCompatibility {
	compatible: boolean;
	pendingCount: number;
	schemaVersions: number[];
}

export function assessPaymentUpdateCompatibility(
	records: readonly { schemaVersion: number }[],
	metadata: ServiceWorkerUpdateMetadata
): PaymentUpdateCompatibility {
	const schemaVersions = [...new Set(records.map((record) => Number(record.schemaVersion)))].sort(
		(left, right) => left - right
	);
	return {
		compatible:
			metadata.protocolVersion === SERVICE_WORKER_UPDATE_PROTOCOL_VERSION &&
			supportsPendingPaymentSchemas(schemaVersions, metadata),
		pendingCount: records.length,
		schemaVersions
	};
}

export function requestServiceWorkerUpdateMetadata(
	worker: ServiceWorker,
	timeoutMs = METADATA_TIMEOUT_MS
): Promise<ServiceWorkerUpdateMetadata> {
	return new Promise((resolve, reject) => {
		const channel = new MessageChannel();
		const timeout = window.setTimeout(() => {
			channel.port1.close();
			reject(new Error('The service worker did not provide update compatibility information'));
		}, timeoutMs);

		channel.port1.onmessage = (event: MessageEvent<ServiceWorkerUpdateMetadata>) => {
			window.clearTimeout(timeout);
			channel.port1.close();
			resolve(event.data);
		};
		worker.postMessage({ type: 'GET_UPDATE_METADATA' } satisfies ServiceWorkerUpdateRequest, [
			channel.port2
		]);
	});
}

export function activateCompatibleServiceWorkerUpdate(
	worker: ServiceWorker,
	records: readonly { schemaVersion: number }[],
	metadata: ServiceWorkerUpdateMetadata
): void {
	const compatibility = assessPaymentUpdateCompatibility(records, metadata);
	if (!compatibility.compatible) {
		throw new Error('The update cannot safely read pending payment recovery records');
	}
	worker.postMessage({
		type: 'ACTIVATE_UPDATE',
		protocolVersion: SERVICE_WORKER_UPDATE_PROTOCOL_VERSION,
		pendingPaymentJournalSchemas: compatibility.schemaVersions
	} satisfies ServiceWorkerUpdateRequest);
}
