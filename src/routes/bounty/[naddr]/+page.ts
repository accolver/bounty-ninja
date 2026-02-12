import { error } from '@sveltejs/kit';
import { nip19 } from 'nostr-tools';
import type { PageLoad } from './$types';

export const ssr = false;
export const prerender = false;

export const load: PageLoad = ({ params }) => {
	try {
		const decoded = nip19.decode(params.naddr);

		if (decoded.type !== 'naddr') {
			error(400, `Expected naddr identifier, got ${decoded.type}`);
		}

		const { kind, pubkey, identifier, relays } = decoded.data;
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
};
