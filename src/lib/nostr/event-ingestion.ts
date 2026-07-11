import type { NostrEvent } from 'nostr-tools';
import { filter, type MonoTypeOperatorFunction } from 'rxjs';
import { eventStore } from './event-store';
import { validateEvent } from './event-validator';
import { validateEventResources, validateEventTags } from './tag-validator';

export type IngestionSource = 'relay' | 'search' | 'profile' | 'reputation' | 'cache' | 'local';

export interface IncomingEventValidation {
	valid: boolean;
	errors: string[];
}

export function validateIncomingEvent(event: NostrEvent): IncomingEventValidation {
	const resources = validateEventResources(event);
	if (!resources.valid) return resources;

	const tags = event.kind === 0 ? { valid: true, errors: [] } : validateEventTags(event);
	if (!tags.valid) return tags;
	if (!validateEvent(event)) return { valid: false, errors: ['Invalid event signature'] };
	return { valid: true, errors: [] };
}

export function ingestEvent(event: NostrEvent, source: IngestionSource): boolean {
	const result = validateIncomingEvent(event);
	if (!result.valid) {
		console.warn(
			`[event-ingestion] Rejected ${source} event ${event.id}: ${result.errors.join('; ')}`
		);
		return false;
	}
	const stored = eventStore.add(event);
	return stored?.id === event.id;
}

export function ingestEventsFrom(source: IngestionSource): MonoTypeOperatorFunction<NostrEvent> {
	return filter((event) => ingestEvent(event, source));
}
