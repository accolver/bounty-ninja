import { decodeBountyNaddr } from '$lib/bounty/naddr';
import type { PageLoad } from './$types';

export const ssr = false;
export const prerender = false;

export const load: PageLoad = ({ params }) => {
	return decodeBountyNaddr(params.naddr);
};
