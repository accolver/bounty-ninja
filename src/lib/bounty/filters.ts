import type { Filter } from 'nostr-tools';
import { BOUNTY_KIND, PLEDGE_KIND, SOLUTION_KIND, VOTE_KIND, PAYOUT_KIND, RETRACTION_KIND, REPUTATION_KIND } from './kinds';

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
 * Filter to fetch all pledge events (Kind 73002) across all tasks.
 * Used by the home page to aggregate funding totals.
 */
export function allPledgesFilter(limit?: number): Filter {
	return {
		kinds: [PLEDGE_KIND],
		limit: limit ?? 200
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
 * Filter to fetch all tasks created by a specific author.
 */
export function bountyByAuthorFilter(pubkey: string): Filter {
	return {
		kinds: [BOUNTY_KIND],
		authors: [pubkey]
	};
}

/**
 * Filter to fetch all solution events (Kind 73001) across all tasks.
 * Used by the home page to derive in_review status.
 */
export function allSolutionsFilter(limit?: number): Filter {
	return {
		kinds: [SOLUTION_KIND],
		limit: limit ?? 200
	};
}

/**
 * Filter to fetch all payout events (Kind 73004) across all tasks.
 * Used by the home page to derive completed status.
 */
export function allPayoutsFilter(limit?: number): Filter {
	return {
		kinds: [PAYOUT_KIND],
		limit: limit ?? 100
	};
}

/**
 * Filter to search tasks by text query (NIP-50).
 * Defaults to 20 results if no limit is specified.
 */
export function searchBountiesFilter(query: string, limit?: number): Filter {
	return {
		kinds: [BOUNTY_KIND],
		search: query,
		limit: limit ?? 20
	};
}

/**
 * Filter to fetch retraction events (Kind 73005) for a specific bounty.
 */
export function retractionFilter(taskAddress: string): Filter {
	return {
		kinds: [RETRACTION_KIND],
		'#a': [taskAddress]
	};
}

/**
 * Filter to fetch reputation events (Kind 73006) authored by a specific pubkey.
 */
export function reputationFilter(pubkey: string): Filter {
	return {
		kinds: [REPUTATION_KIND],
		authors: [pubkey]
	};
}

/**
 * Filter to fetch reputation events (Kind 73006) targeting a specific pubkey.
 */
export function reputationByTargetFilter(pubkey: string): Filter {
	return {
		kinds: [REPUTATION_KIND],
		'#p': [pubkey]
	};
}
