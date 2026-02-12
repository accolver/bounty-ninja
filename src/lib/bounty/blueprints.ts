import type { EventTemplate } from 'nostr-tools';
import { TASK_KIND, PLEDGE_KIND, SOLUTION_KIND, VOTE_KIND, PAYOUT_KIND } from './kinds';
import { CLIENT_TAG } from '$lib/utils/constants';

/**
 * Blueprint parameters for creating a task event (kind 37300).
 */
export interface TaskBlueprintParams {
	/** Unique identifier for the parameterized replaceable event */
	dTag: string;
	/** Human-readable task title */
	title: string;
	/** Markdown description of the task requirements */
	description: string;
	/** Reward amount in sats */
	rewardAmount: number;
	/** Topic tags for discoverability */
	tags?: string[];
	/** Unix timestamp deadline (expiration) */
	deadline?: number;
	/** Preferred Cashu mint URL */
	mintUrl?: string;
	/** Anti-spam submission fee in sats */
	submissionFee?: number;
}

/**
 * Blueprint parameters for creating a pledge event (kind 73002).
 */
export interface PledgeBlueprintParams {
	/** NIP-33 address of the task (kind:pubkey:d-tag) */
	taskAddress: string;
	/** Pubkey of the task creator (for p-tag) */
	creatorPubkey: string;
	/** Pledge amount in sats */
	amount: number;
	/** Serialized Cashu token (P2PK-locked) */
	cashuToken: string;
	/** Cashu mint URL the token was issued from */
	mintUrl: string;
	/** Optional message from the pledger */
	message?: string;
}

/**
 * Blueprint parameters for creating a solution event (kind 73001).
 */
export interface SolutionBlueprintParams {
	/** NIP-33 address of the task (kind:pubkey:d-tag) */
	taskAddress: string;
	/** Pubkey of the task creator (for p-tag) */
	creatorPubkey: string;
	/** Markdown description of the solution */
	description: string;
	/** Serialized Cashu token for anti-spam fee */
	antiSpamToken?: string;
	/** URL to the deliverable (repo, demo, etc.) */
	deliverableUrl?: string;
}

/**
 * Blueprint parameters for creating a vote event (kind 1018).
 */
export interface VoteBlueprintParams {
	/** NIP-33 address of the task (kind:pubkey:d-tag) */
	taskAddress: string;
	/** Event ID of the solution being voted on */
	solutionId: string;
	/** Pubkey of the solution author (for p-tag) */
	solutionAuthor: string;
	/** Vote choice */
	choice: 'approve' | 'reject';
}

/**
 * Blueprint parameters for creating a payout event (kind 73004).
 */
export interface PayoutBlueprintParams {
	/** NIP-33 address of the task (kind:pubkey:d-tag) */
	taskAddress: string;
	/** Event ID of the winning solution */
	solutionId: string;
	/** Pubkey of the solver receiving the payout */
	solverPubkey: string;
	/** Payout amount in sats */
	amount: number;
	/** Serialized Cashu token for the payout */
	cashuToken: string;
}

/**
 * Create an EventTemplate for a task definition (kind 37300).
 * Parameterized replaceable event — updates overwrite previous versions.
 */
export function taskBlueprint(params: TaskBlueprintParams): EventTemplate {
	const tags: string[][] = [
		['d', params.dTag],
		['title', params.title],
		['reward', String(params.rewardAmount)],
		['client', CLIENT_TAG]
	];

	if (params.tags) {
		for (const t of params.tags) {
			tags.push(['t', t]);
		}
	}
	if (params.deadline !== undefined) {
		tags.push(['expiration', String(params.deadline)]);
	}
	if (params.mintUrl) {
		tags.push(['mint', params.mintUrl]);
	}
	if (params.submissionFee !== undefined) {
		tags.push(['fee', String(params.submissionFee)]);
	}

	return {
		kind: TASK_KIND,
		tags,
		content: params.description,
		created_at: Math.floor(Date.now() / 1000)
	};
}

/**
 * Create an EventTemplate for a pledge (kind 73002).
 * References the task via an 'a' tag and includes the locked Cashu token.
 */
export function pledgeBlueprint(params: PledgeBlueprintParams): EventTemplate {
	const tags: string[][] = [
		['a', params.taskAddress],
		['p', params.creatorPubkey],
		['amount', String(params.amount)],
		['cashu', params.cashuToken],
		['mint', params.mintUrl],
		['client', CLIENT_TAG]
	];

	return {
		kind: PLEDGE_KIND,
		tags,
		content: params.message ?? '',
		created_at: Math.floor(Date.now() / 1000)
	};
}

/**
 * Create an EventTemplate for a solution submission (kind 73001).
 * References the task via an 'a' tag and optionally includes an anti-spam token.
 */
export function solutionBlueprint(params: SolutionBlueprintParams): EventTemplate {
	const tags: string[][] = [
		['a', params.taskAddress],
		['p', params.creatorPubkey],
		['client', CLIENT_TAG]
	];

	if (params.antiSpamToken) {
		tags.push(['cashu', params.antiSpamToken]);
	}
	if (params.deliverableUrl) {
		tags.push(['r', params.deliverableUrl]);
	}

	return {
		kind: SOLUTION_KIND,
		tags,
		content: params.description,
		created_at: Math.floor(Date.now() / 1000)
	};
}

/**
 * Create an EventTemplate for a consensus vote (kind 1018).
 * References both the task (a-tag) and the solution (e-tag).
 */
export function voteBlueprint(params: VoteBlueprintParams): EventTemplate {
	const tags: string[][] = [
		['a', params.taskAddress],
		['e', params.solutionId],
		['p', params.solutionAuthor],
		['vote', params.choice],
		['client', CLIENT_TAG]
	];

	return {
		kind: VOTE_KIND,
		tags,
		content: '',
		created_at: Math.floor(Date.now() / 1000)
	};
}

/**
 * Create an EventTemplate for a payout record (kind 73004).
 * Records the Cashu token transfer to the solver.
 */
export function payoutBlueprint(params: PayoutBlueprintParams): EventTemplate {
	const tags: string[][] = [
		['a', params.taskAddress],
		['e', params.solutionId],
		['p', params.solverPubkey],
		['amount', String(params.amount)],
		['cashu', params.cashuToken],
		['client', CLIENT_TAG]
	];

	return {
		kind: PAYOUT_KIND,
		tags,
		content: '',
		created_at: Math.floor(Date.now() / 1000)
	};
}
