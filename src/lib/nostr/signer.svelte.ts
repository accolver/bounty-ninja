// SECURITY: This file handles private key material. Never persist or log nsec values.
import type { EventTemplate, NostrEvent } from 'nostr-tools';
import { EventFactory } from 'applesauce-core/event-factory';
import { ExtensionSigner, PrivateKeySigner } from 'applesauce-signers';
import {
	SIGNER_POLL_INTERVAL_MS,
	SIGNER_MAX_RETRIES,
	SIGNER_TIMEOUT_MS,
	CLIENT_TAG
} from '$lib/utils/constants';
import { eventStore } from './event-store';
import { broadcastEvent } from './publish';
import type { BroadcastResult } from './publish';

/**
 * Error thrown when a NIP-07 signing operation times out.
 */
export class SignerTimeoutError extends Error {
	constructor(timeoutMs: number = SIGNER_TIMEOUT_MS) {
		super(
			`NIP-07 signer did not respond within ${timeoutMs / 1000}s. Please check your extension.`
		);
		this.name = 'SignerTimeoutError';
	}
}

/**
 * Error thrown when no NIP-07 signer extension is available.
 */
export class SignerUnavailableError extends Error {
	constructor() {
		super(
			'No Nostr signer extension detected. Please install nos2x, Alby, or another NIP-07 extension.'
		);
		this.name = 'SignerUnavailableError';
	}
}

/**
 * Result of a publishEvent operation.
 */
export interface PublishResult {
	/** The signed event that was published */
	event: NostrEvent;
	/** Broadcast result from relays */
	broadcast: BroadcastResult;
}

/** Lazily-initialized EventFactory singleton */
let factoryInstance: EventFactory | null = null;

/** SECURITY: Memory-only nsec signer reference. Never persist. */
let nsecSignerInstance: PrivateKeySigner | null = null;

/**
 * Set the nsec signer from a private key string.
 * SECURITY: The signer is held in memory only and cleared on logout/beforeunload.
 */
export function setNsecSigner(nsec: string): void {
	nsecSignerInstance = PrivateKeySigner.fromKey(nsec);
}

/**
 * Clear the nsec signer from memory.
 */
export function clearNsecSigner(): void {
	nsecSignerInstance = null;
}

// Zero out nsec signer when the tab closes
if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', clearNsecSigner);
}

/**
 * Get or create the EventFactory singleton.
 * Uses nsec signer if available, otherwise falls back to NIP-07 ExtensionSigner.
 *
 * @throws {SignerUnavailableError} if no signer is available
 */
export function getEventFactory(): EventFactory {
	if (factoryInstance) return factoryInstance;

	if (nsecSignerInstance) {
		factoryInstance = new EventFactory({
			signer: nsecSignerInstance,
			client: { name: CLIENT_TAG }
		});
		return factoryInstance;
	}

	if (typeof window === 'undefined' || !window.nostr) {
		throw new SignerUnavailableError();
	}

	const signer = new ExtensionSigner();
	factoryInstance = new EventFactory({
		signer,
		client: { name: CLIENT_TAG }
	});

	return factoryInstance;
}

/**
 * Reset the EventFactory singleton.
 * Call this on logout to ensure a fresh signer is used on next login.
 */
export function resetEventFactory(): void {
	factoryInstance = null;
}

/**
 * Sign an EventTemplate via the NIP-07 extension with a timeout guard,
 * optimistically insert into the EventStore, and broadcast to relays.
 *
 * Flow:
 * 1. Sign the template via EventFactory (NIP-07) with 30s timeout
 * 2. Optimistically insert the signed event into the EventStore
 * 3. Broadcast to all connected relays
 * 4. If ALL relays reject, log the failure (event remains in store for UX)
 *
 * @param template - Unsigned event template to sign and publish
 * @returns The signed event and broadcast result
 * @throws {SignerUnavailableError} if no NIP-07 extension is available
 * @throws {SignerTimeoutError} if signing takes longer than 30s
 */
export async function publishEvent(template: EventTemplate): Promise<PublishResult> {
	const factory = getEventFactory();

	// Sign with timeout guard
	const signedEvent = await signWithTimeout(factory, template, SIGNER_TIMEOUT_MS);

	// Optimistic insert — event appears in UI immediately
	eventStore.add(signedEvent);

	// Broadcast to relays
	let broadcast: BroadcastResult;
	try {
		broadcast = await broadcastEvent(signedEvent);
	} catch (err) {
		// All relays rejected — log but don't remove from store.
		// The EventStore doesn't distinguish local-only events, and removing
		// would cause a jarring UX flash. The event will be retried or
		// naturally expire from the store on next prune.
		const message = err instanceof Error ? err.message : String(err);
		console.error(`[publishEvent] Broadcast failed for event ${signedEvent.id}: ${message}`);

		// Return a failure result so callers can handle it
		broadcast = {
			success: false,
			acceptedCount: 0,
			rejectedCount: 0,
			results: [],
			failures: []
		};
	}

	return { event: signedEvent, broadcast };
}

/**
 * Sign an event template with a timeout guard.
 * Races the NIP-07 signing against a timeout to prevent indefinite hangs
 * (e.g., user ignores the extension popup).
 */
async function signWithTimeout(
	factory: EventFactory,
	template: EventTemplate,
	timeoutMs: number
): Promise<NostrEvent> {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;

	const timeoutPromise = new Promise<never>((_resolve, reject) => {
		timeoutId = setTimeout(() => {
			reject(new SignerTimeoutError(timeoutMs));
		}, timeoutMs);
	});

	try {
		const signed = await Promise.race([factory.sign(template), timeoutPromise]);
		return signed;
	} finally {
		if (timeoutId !== undefined) {
			clearTimeout(timeoutId);
		}
	}
}

/**
 * Reactive NIP-07 signer detection store.
 * Detects window.nostr availability with polling for late-loading extensions.
 */
class SignerState {
	available = $state(false);
	checking = $state(true);

	private retryCount = 0;
	private intervalId: ReturnType<typeof setInterval> | null = null;

	constructor() {
		if (typeof window !== 'undefined') {
			this.detect();
		} else {
			this.checking = false;
		}
	}

	private detect(): void {
		if (window.nostr) {
			this.available = true;
			this.checking = false;
			return;
		}

		// Poll for late-loading extensions
		this.intervalId = setInterval(() => {
			this.retryCount++;

			if (window.nostr) {
				this.available = true;
				this.checking = false;
				this.stopPolling();
				return;
			}

			if (this.retryCount >= SIGNER_MAX_RETRIES) {
				this.checking = false;
				this.stopPolling();
			}
		}, SIGNER_POLL_INTERVAL_MS);
	}

	private stopPolling(): void {
		if (this.intervalId !== null) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	/** Force a re-check for the NIP-07 extension */
	recheck(): void {
		this.retryCount = 0;
		this.checking = true;
		this.stopPolling();
		this.detect();
	}

	destroy(): void {
		this.stopPolling();
	}
}

export const signerState = new SignerState();
