import type { NostrEvent } from 'nostr-tools';

/**
 * Extract the first value for a given tag name from a Nostr event.
 * Returns undefined if the tag is not found.
 */
export function getTagValue(event: NostrEvent, tagName: string): string | undefined {
	const tag = event.tags.find((t) => t[0] === tagName);
	return tag?.[1];
}

/**
 * Extract all values for a given tag name from a Nostr event.
 * Returns an array of the second element from each matching tag.
 */
export function getTagValues(event: NostrEvent, tagName: string): string[] {
	return event.tags
		.filter((t) => t[0] === tagName)
		.map((t) => t[1])
		.filter(Boolean);
}
