import { describe, expect, it } from 'vitest';
import { mergeRelayHints } from '$lib/nostr/relay-hints';

describe('mergeRelayHints', () => {
	it('keeps configured relays and ignores unknown hints', () => {
		expect(
			mergeRelayHints(
				['wss://configured.example', 'ws://localhost:7777'],
				['wss://hint.example/', 'wss://second.example/path/']
			)
		).toEqual(['wss://configured.example', 'ws://localhost:7777']);
	});

	it('deduplicates equivalent configured and hinted relays', () => {
		expect(
			mergeRelayHints(['wss://relay.example/'], ['wss://relay.example', 'wss://other.example'])
		).toEqual(['wss://relay.example']);
	});

	it('rejects insecure, non-WebSocket, credentialed, secret-bearing, and malformed hints', () => {
		expect(
			mergeRelayHints(
				[],
				[
					'ws://relay.example',
					'https://relay.example',
					'wss://user:pass@relay.example',
					'wss://relay.example?token=secret',
					'wss://relay.example#fragment',
					'not a url'
				]
			)
		).toEqual([]);
	});

	it('caps total configured connections without accepting unknown hints', () => {
		const hints = Array.from({ length: 8 }, (_, index) => `wss://hint-${index}.example`);
		expect(mergeRelayHints([], hints, 3, 10)).toHaveLength(0);
		expect(
			mergeRelayHints(
				Array.from({ length: 9 }, (_, index) => `wss://configured-${index}.example`),
				hints,
				3,
				10
			)
		).toHaveLength(9);
	});

	it('falls back to configured relays when every hint is invalid', () => {
		expect(mergeRelayHints(['wss://configured.example'], ['http://bad.example'])).toEqual([
			'wss://configured.example'
		]);
	});
});
