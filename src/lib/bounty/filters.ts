import type { Filter } from 'nostr-tools';
import {
	BOUNTY_KIND,
	PLEDGE_KIND,
	SOLUTION_KIND,
	VOTE_KIND,
	PAYOUT_KIND
} from './kinds';

/**
 * Filter to fetch a list of bounty events.
 * Defaults to 50 results if no limit is specified.
 */
export function bountyListFilter(limit?: number): Filter {
	return {
		kinds: [BOUNTY_KIND],
		limit: limit ?? 50
	};
}

/**
 * Filter to fetch all pledge events for a specific bounty.
 */
export function pledgesForBountyFilter(bountyAddress: string): Filter {
	return {
		kinds: [PLEDGE_KIND],
		'#a': [bountyAddress]
	};
}

/**
 * Filter to fetch all solution events for a specific bounty.
 */
export function solutionsForBountyFilter(bountyAddress: string): Filter {
	return {
		kinds: [SOLUTION_KIND],
		'#a': [bountyAddress]
	};
}

/**
 * Filter to fetch all vote events for a specific bounty.
 */
export function votesForBountyFilter(bountyAddress: string): Filter {
	return {
		kinds: [VOTE_KIND],
		'#a': [bountyAddress]
	};
}

/**
 * Filter to fetch payout events for a specific bounty.
 */
export function payoutForBountyFilter(bountyAddress: string): Filter {
	return {
		kinds: [PAYOUT_KIND],
		'#a': [bountyAddress]
	};
}

/**
 * Filter to fetch all bounties created by a specific author.
 */
export function bountyByAuthorFilter(pubkey: string): Filter {
	return {
		kinds: [BOUNTY_KIND],
		authors: [pubkey]
	};
}

/**
 * Filter to search bounties by text query (NIP-50).
 * Defaults to 20 results if no limit is specified.
 */
export function searchBountiesFilter(query: string, limit?: number): Filter {
	return {
		kinds: [BOUNTY_KIND],
		search: query,
		limit: limit ?? 20
	};
}
