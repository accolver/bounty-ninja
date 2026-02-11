import { error } from '@sveltejs/kit';
import { nip19 } from 'nostr-tools';
import type { PageLoad } from './$types';

export const ssr = false;
export const prerender = false;

export const load: PageLoad = ({ params }) => {
	try {
		const decoded = nip19.decode(params.npub);

		if (decoded.type !== 'npub') {
			error(400, `Expected npub identifier, got ${decoded.type}`);
		}

		return {
			pubkey: decoded.data
		};
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) {
			throw e; // Re-throw SvelteKit errors
		}
		error(400, 'Invalid profile identifier');
	}
};
