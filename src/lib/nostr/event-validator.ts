import { verifyEvent, type NostrEvent } from 'nostr-tools';

/**
 * Validate a Nostr event's cryptographic signature.
 * Uses nostr-tools verifyEvent which checks id hash, pubkey format, and sig.
 *
 * @returns true if the event has a valid signature, false otherwise
 */
export function validateEvent(event: NostrEvent): boolean {
	const valid = verifyEvent(event);
	if (!valid) {
		console.warn(`Rejected event with invalid signature: ${event.id}`);
	}
	return valid;
}
