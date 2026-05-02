import { filter } from 'rxjs';
import type { OperatorFunction } from 'rxjs';
import type { NostrEvent } from 'nostr-tools';
import { validateEvent } from './event-validator';
import { validateEventTags } from './tag-validator';

/**
 * RxJS operator for the Nostr trust boundary.
 * Rejects relay-sourced events unless their NIP-01 id/signature and
 * app-specific required tags are valid before they enter EventStore/IndexedDB.
 */
export function onlyValidEvents(): OperatorFunction<NostrEvent, NostrEvent> {
	return filter((event: NostrEvent) => {
		if (!validateEvent(event)) return false;
		return validateEventTags(event).valid;
	});
}
