import type { Filter } from 'nostr-tools';
import { TASK_KIND, PLEDGE_KIND, SOLUTION_KIND, VOTE_KIND, PAYOUT_KIND } from './kinds';

/**
 * Filter to fetch a list of task events.
 * Defaults to 50 results if no limit is specified.
 */
export function taskListFilter(limit?: number): Filter {
	return {
		kinds: [TASK_KIND],
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
 * Filter to fetch all pledge events for a specific task.
 */
export function pledgesForTaskFilter(taskAddress: string): Filter {
	return {
		kinds: [PLEDGE_KIND],
		'#a': [taskAddress]
	};
}

/**
 * Filter to fetch all solution events for a specific task.
 */
export function solutionsForTaskFilter(taskAddress: string): Filter {
	return {
		kinds: [SOLUTION_KIND],
		'#a': [taskAddress]
	};
}

/**
 * Filter to fetch all vote events for a specific task.
 */
export function votesForTaskFilter(taskAddress: string): Filter {
	return {
		kinds: [VOTE_KIND],
		'#a': [taskAddress]
	};
}

/**
 * Filter to fetch payout events for a specific task.
 */
export function payoutForTaskFilter(taskAddress: string): Filter {
	return {
		kinds: [PAYOUT_KIND],
		'#a': [taskAddress]
	};
}

/**
 * Filter to fetch all tasks created by a specific author.
 */
export function taskByAuthorFilter(pubkey: string): Filter {
	return {
		kinds: [TASK_KIND],
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
export function searchTasksFilter(query: string, limit?: number): Filter {
	return {
		kinds: [TASK_KIND],
		search: query,
		limit: limit ?? 20
	};
}
