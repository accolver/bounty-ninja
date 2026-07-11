import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent, generateSecretKey, type EventTemplate, type NostrEvent } from 'nostr-tools';

const idb = vi.hoisted(() => ({
	addEvents: vi.fn().mockResolvedValue(undefined),
	deleteEvent: vi.fn().mockResolvedValue(undefined),
	getEventsForFilters: vi.fn().mockResolvedValue([]),
	openDB: vi.fn().mockResolvedValue({ close: vi.fn() })
}));

vi.mock('nostr-idb', () => idb);

import { eventStore } from '$lib/nostr/event-store';
import { ingestEvent } from '$lib/nostr/event-ingestion';
import { initCache, loadCachedEvents } from '$lib/nostr/cache';

const secretKey = generateSecretKey();

function signedBounty(overrides: Partial<EventTemplate> = {}): NostrEvent {
	return finalizeEvent(
		{
			kind: 37300,
			created_at: Math.floor(Date.now() / 1000),
			content: 'A bounded description',
			tags: [
				['d', crypto.randomUUID()],
				['title', 'Production hardening'],
				['reward', '1000'],
				['client', 'bounty.ninja']
			],
			...overrides
		},
		secretKey
	);
}

describe('verified event ingestion', () => {
	beforeAll(async () => {
		await initCache();
	});

	beforeEach(() => {
		idb.addEvents.mockClear();
		idb.deleteEvent.mockClear();
		idb.getEventsForFilters.mockReset().mockResolvedValue([]);
	});

	it('inserts and persists a valid event', async () => {
		const event = signedBounty();
		expect(ingestEvent(event, 'relay')).toBe(true);
		await Promise.resolve();

		expect(eventStore.getByFilters([{ ids: [event.id] }])).toContainEqual(event);
		expect(idb.addEvents).toHaveBeenCalledWith(expect.anything(), [event]);
	});

	it('keeps invalid signatures out of EventStore and IndexedDB', async () => {
		const valid = signedBounty();
		const event = JSON.parse(JSON.stringify(valid)) as NostrEvent;
		event.sig = `${valid.sig.slice(0, -1)}${valid.sig.endsWith('0') ? '1' : '0'}`;
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		expect(ingestEvent(event, 'relay')).toBe(false);
		await Promise.resolve();

		expect(eventStore.getByFilters([{ ids: [event.id] }])).toHaveLength(0);
		expect(idb.addEvents).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	it('rejects oversized signed events before EventStore and persistence', async () => {
		const event = signedBounty({ content: 'x'.repeat(50_001) });
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		expect(ingestEvent(event, 'relay')).toBe(false);
		await Promise.resolve();

		expect(eventStore.getByFilters([{ ids: [event.id] }])).toHaveLength(0);
		expect(idb.addEvents).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	it('deletes invalid cached events instead of restoring them', async () => {
		const valid = signedBounty();
		const event = JSON.parse(JSON.stringify(valid)) as NostrEvent;
		event.content = 'tampered after signing';
		idb.getEventsForFilters.mockResolvedValueOnce([event]);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await loadCachedEvents([{ ids: [event.id] }]);

		expect(eventStore.getByFilters([{ ids: [event.id] }])).toHaveLength(0);
		expect(idb.deleteEvent).toHaveBeenCalledWith(expect.anything(), event.id);
		warn.mockRestore();
	});
});
