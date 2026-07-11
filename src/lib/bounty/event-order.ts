export interface OrderedEvent {
	id: string;
	createdAt: number;
}

/** Total ordering for deterministic Nostr conflict resolution. */
export function compareEventOrder(left: OrderedEvent, right: OrderedEvent): number {
	return left.createdAt - right.createdAt || left.id.localeCompare(right.id);
}
