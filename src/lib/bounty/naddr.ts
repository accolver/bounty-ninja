import { error } from '@sveltejs/kit';
import { nip19 } from 'nostr-tools';
import { BOUNTY_KIND } from './kinds';

export function decodeBountyNaddr(naddr: string) {
	try {
		const decoded = nip19.decode(naddr);

		if (decoded.type !== 'naddr') {
			error(400, `Expected naddr identifier, got ${decoded.type}`);
		}

		const { kind, pubkey, identifier, relays } = decoded.data;
		if (kind !== BOUNTY_KIND) {
			error(400, `Expected bounty kind ${BOUNTY_KIND}, got ${kind}`);
		}
		if (!identifier) error(400, 'Bounty identifier is required');
		const bountyAddress = `${kind}:${pubkey}:${identifier}`;

		return {
			kind,
			pubkey,
			dTag: identifier,
			bountyAddress,
			relays: relays ?? []
		};
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) {
			throw e;
		}
		error(404, 'Invalid bounty address');
	}
}
