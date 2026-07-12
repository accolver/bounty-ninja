import { error } from '@sveltejs/kit';
import { nip19 } from 'nostr-tools';
import type { PageLoad } from './$types';
import { BOUNTY_KIND } from '$lib/bounty/kinds';

export const ssr = false;
export const prerender = false;

export function decodeBountyNaddr(naddr: string) {
	try {
		const decoded = nip19.decode(naddr);

		if (decoded.type !== 'naddr') {
			error(400, `Expected naddr identifier, got ${decoded.type}`);
		}

		const { kind, pubkey, identifier, relays } = decoded.data;
		if (kind !== BOUNTY_KIND) error(400, 'Expected a bounty naddr');
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
			throw e; // Re-throw SvelteKit errors
		}
		error(404, 'Invalid bounty address');
	}
}

export const load: PageLoad = ({ params }) => {
	return decodeBountyNaddr(params.naddr);
};
