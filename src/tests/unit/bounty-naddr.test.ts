import { describe, expect, it } from 'vitest';
import { nip19 } from 'nostr-tools';
import { decodeBountyNaddr } from '../../routes/bounty/[naddr]/+page';

const pubkey = 'a'.repeat(64);

describe('decodeBountyNaddr', () => {
	it('accepts kind 37300 and preserves relay hints', () => {
		const naddr = nip19.naddrEncode({
			kind: 37300,
			pubkey,
			identifier: 'bounty',
			relays: ['wss://hint.example']
		});
		expect(decodeBountyNaddr(naddr)).toEqual({
			kind: 37300,
			pubkey,
			dTag: 'bounty',
			bountyAddress: `37300:${pubkey}:bounty`,
			relays: ['wss://hint.example']
		});
	});

	it('rejects non-bounty address kinds', () => {
		const naddr = nip19.naddrEncode({ kind: 30023, pubkey, identifier: 'article' });
		expect(() => decodeBountyNaddr(naddr)).toThrow();
	});

	it('rejects malformed identifiers', () => {
		expect(() => decodeBountyNaddr('not-an-naddr')).toThrow();
	});
});
