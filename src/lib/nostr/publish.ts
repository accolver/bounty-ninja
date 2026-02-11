import type { NostrEvent } from 'nostr-tools';
import type { PublishResponse } from 'applesauce-relay';
import { pool } from './relay-pool';
import { getDefaultRelays } from '$lib/utils/env';

/**
 * Result of a multi-relay broadcast operation.
 */
export interface BroadcastResult {
	/** Whether at least one relay accepted the event */
	success: boolean;
	/** Number of relays that accepted the event */
	acceptedCount: number;
	/** Number of relays that rejected the event */
	rejectedCount: number;
	/** Per-relay results for diagnostics */
	results: PublishResponse[];
	/** Relay URLs that failed entirely (connection error, timeout) */
	failures: string[];
}

/**
 * Broadcast a signed Nostr event to all connected relays.
 *
 * Resolves successfully when at least one relay confirms acceptance.
 * Logs partial failures but does not throw for them.
 * Throws only if ALL relays reject or fail.
 */
export async function broadcastEvent(event: NostrEvent): Promise<BroadcastResult> {
	const relayUrls = getDefaultRelays();

	if (relayUrls.length === 0) {
		throw new Error('No relays configured. Cannot broadcast event.');
	}

	// Ensure all relays have connections initiated
	for (const url of relayUrls) {
		pool.relay(url);
	}

	const results: PublishResponse[] = [];
	const failures: string[] = [];

	// Publish to each relay individually so partial failures don't abort the batch
	const publishPromises = relayUrls.map(async (url) => {
		try {
			const relay = pool.relay(url);
			const response = await relay.publish(event, { timeout: 15_000 });
			results.push(response);

			if (!response.ok) {
				console.warn(
					`[broadcast] Relay ${url} rejected event ${event.id}: ${response.message ?? 'unknown reason'}`
				);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.warn(`[broadcast] Failed to publish to ${url}: ${message}`);
			failures.push(url);
		}
	});

	await Promise.allSettled(publishPromises);

	const acceptedCount = results.filter((r) => r.ok).length;
	const rejectedCount = results.filter((r) => !r.ok).length;
	const success = acceptedCount > 0;

	if (!success) {
		const totalFailed = rejectedCount + failures.length;
		throw new Error(
			`Event rejected by all ${totalFailed} relay(s). ` +
				`${rejectedCount} rejected, ${failures.length} connection failures.`
		);
	}

	if (failures.length > 0 || rejectedCount > 0) {
		console.info(
			`[broadcast] Event ${event.id} accepted by ${acceptedCount}/${relayUrls.length} relays. ` +
				`${rejectedCount} rejected, ${failures.length} failed.`
		);
	}

	return {
		success,
		acceptedCount,
		rejectedCount,
		results,
		failures
	};
}
