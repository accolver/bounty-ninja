import type { EventTemplate } from 'nostr-tools';
import { BOUNTY_KIND, PLEDGE_KIND, SOLUTION_KIND, VOTE_KIND, PAYOUT_KIND, RETRACTION_KIND, REPUTATION_KIND } from './kinds';
import { CLIENT_TAG } from '$lib/utils/constants';

/**
 * Blueprint parameters for creating a bounty event (kind 37300).
 */
export interface BountyBlueprintParams {
	/** Unique identifier for the parameterized replaceable event */
	dTag: string;
	/** Human-readable bounty title */
	title: string;
	/** Markdown description of the bounty requirements */
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
	/** NIP-33 address of the bounty (kind:pubkey:d-tag) */
	bountyAddress: string;
	/** Pubkey of the bounty creator (for p-tag) */
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
	/** NIP-33 address of the bounty (kind:pubkey:d-tag) */
	bountyAddress: string;
	/** Pubkey of the bounty creator (for p-tag) */
	creatorPubkey: string;
	/** Markdown description of the solution */
	description: string;
	/** Serialized Cashu token(s) for anti-spam fee — multiple tokens can sum to the required amount */
	antiSpamTokens?: string[];
	/** URL to the deliverable (repo, demo, etc.) */
	deliverableUrl?: string;
}

/**
 * Blueprint parameters for creating a vote event (kind 1018).
 */
export interface VoteBlueprintParams {
	/** NIP-33 address of the bounty (kind:pubkey:d-tag) */
	bountyAddress: string;
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
	/** NIP-33 address of the bounty (kind:pubkey:d-tag) */
	bountyAddress: string;
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
 * Create an EventTemplate for a bounty definition (kind 37300).
 * Parameterized replaceable event — updates overwrite previous versions.
 */
export function bountyBlueprint(params: BountyBlueprintParams): EventTemplate {
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
		kind: BOUNTY_KIND,
		tags,
		content: params.description,
		created_at: Math.floor(Date.now() / 1000)
	};
}

/**
 * Create an EventTemplate for a pledge (kind 73002).
 * References the bounty via an 'a' tag and includes the locked Cashu token.
 */
export function pledgeBlueprint(params: PledgeBlueprintParams): EventTemplate {
	const tags: string[][] = [
		['a', params.bountyAddress],
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
 * References the bounty via an 'a' tag and optionally includes an anti-spam token.
 */
export function solutionBlueprint(params: SolutionBlueprintParams): EventTemplate {
	const tags: string[][] = [
		['a', params.bountyAddress],
		['p', params.creatorPubkey],
		['client', CLIENT_TAG]
	];

	if (params.antiSpamTokens?.length) {
		for (const token of params.antiSpamTokens) {
			tags.push(['cashu', token]);
		}
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
 * References both the bounty (a-tag) and the solution (e-tag).
 */
export function voteBlueprint(params: VoteBlueprintParams): EventTemplate {
	const tags: string[][] = [
		['a', params.bountyAddress],
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
		['a', params.bountyAddress],
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

/**
 * Blueprint parameters for creating a retraction event (kind 73005).
 */
export interface RetractionBlueprintParams {
	/** NIP-33 address of the bounty (kind:pubkey:d-tag) */
	taskAddress: string;
	/** Whether this is a bounty cancellation or pledge retraction */
	type: 'bounty' | 'pledge';
	/** Event ID of the pledge being retracted (required for pledge retractions) */
	pledgeEventId?: string;
	/** Pubkey of the bounty creator (for p-tag) */
	creatorPubkey: string;
	/** Human-readable reason for retraction */
	reason?: string;
}

/**
 * Blueprint parameters for creating a reputation event (kind 73006).
 */
export interface ReputationBlueprintParams {
	/** Pubkey of the user whose reputation is affected */
	offenderPubkey: string;
	/** NIP-33 address of the bounty */
	taskAddress: string;
	/** Type of retraction that triggered this reputation event */
	type: 'bounty_retraction' | 'pledge_retraction';
	/** Event ID of the retraction event */
	retractionEventId: string;
	/** Human-readable description of the reputation impact */
	description?: string;
}

/**
 * Create an EventTemplate for a retraction event (kind 73005).
 * Used for both bounty cancellation and pledge withdrawal.
 */
export function retractionBlueprint(params: RetractionBlueprintParams): EventTemplate {
	const tags: string[][] = [
		['a', params.taskAddress],
		['type', params.type],
		['p', params.creatorPubkey],
		['client', CLIENT_TAG]
	];

	if (params.pledgeEventId) {
		tags.push(['e', params.pledgeEventId]);
	}

	return {
		kind: RETRACTION_KIND,
		tags,
		content: params.reason ?? '',
		created_at: Math.floor(Date.now() / 1000)
	};
}

/**
 * Create an EventTemplate for a reputation attestation (kind 73006).
 * Published automatically when a retraction occurs after solutions exist.
 */
export function reputationBlueprint(params: ReputationBlueprintParams): EventTemplate {
	const tags: string[][] = [
		['p', params.offenderPubkey],
		['a', params.taskAddress],
		['type', params.type],
		['e', params.retractionEventId],
		['client', CLIENT_TAG]
	];

	return {
		kind: REPUTATION_KIND,
		tags,
		content: params.description ?? '',
		created_at: Math.floor(Date.now() / 1000)
	};
}
