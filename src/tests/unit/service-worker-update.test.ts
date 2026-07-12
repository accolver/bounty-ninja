import { describe, expect, it, vi } from 'vitest';
import {
	activateCompatibleServiceWorkerUpdate,
	assessPaymentUpdateCompatibility
} from '$lib/service-worker-update';
import {
	SERVICE_WORKER_UPDATE_PROTOCOL_VERSION,
	type ServiceWorkerUpdateMetadata
} from '$lib/service-worker-protocol';

const metadata: ServiceWorkerUpdateMetadata = {
	protocolVersion: SERVICE_WORKER_UPDATE_PROTOCOL_VERSION,
	minimumPaymentJournalSchema: 1,
	maximumPaymentJournalSchema: 2
};

describe('service worker payment compatibility', () => {
	it('accepts empty and supported pending journals', () => {
		expect(assessPaymentUpdateCompatibility([], metadata)).toMatchObject({
			compatible: true,
			pendingCount: 0,
			schemaVersions: []
		});
		expect(
			assessPaymentUpdateCompatibility(
				[{ schemaVersion: 2 }, { schemaVersion: 1 }, { schemaVersion: 2 }],
				metadata
			)
		).toEqual({ compatible: true, pendingCount: 3, schemaVersions: [1, 2] });
	});

	it('fails closed for unsupported schemas or protocol versions', () => {
		expect(assessPaymentUpdateCompatibility([{ schemaVersion: 3 }], metadata).compatible).toBe(
			false
		);
		expect(
			assessPaymentUpdateCompatibility([], { ...metadata, protocolVersion: 2 as 1 }).compatible
		).toBe(false);
		expect(
			assessPaymentUpdateCompatibility([{ schemaVersion: Number.NaN }], metadata).compatible
		).toBe(false);
		expect(
			assessPaymentUpdateCompatibility([], {
				...metadata,
				minimumPaymentJournalSchema: 3,
				maximumPaymentJournalSchema: 2
			}).compatible
		).toBe(false);
	});

	it('sends activation only after compatibility succeeds', () => {
		const worker = { postMessage: vi.fn() } as unknown as ServiceWorker;
		activateCompatibleServiceWorkerUpdate(worker, [{ schemaVersion: 1 }], metadata);
		expect(worker.postMessage).toHaveBeenCalledWith({
			type: 'ACTIVATE_UPDATE',
			protocolVersion: SERVICE_WORKER_UPDATE_PROTOCOL_VERSION,
			pendingPaymentJournalSchemas: [1]
		});

		expect(() =>
			activateCompatibleServiceWorkerUpdate(worker, [{ schemaVersion: 4 }], metadata)
		).toThrow('cannot safely read pending payment recovery records');
		expect(worker.postMessage).toHaveBeenCalledTimes(1);
	});
});
