import type { NostrEvent } from 'nostr-tools';
import type { BountySummary, Pledge, Solution, Vote, Payout, BountyDetail } from './types';
import { deriveBountyStatus } from './state-machine';
import { tallyVotes } from './voting';
import { validateEventTags } from '$lib/nostr/tag-validator';

/**
 * Extract the first value for a given tag name from a Nostr event.
 * Returns undefined if the tag is not found.
 */
function getTagValue(event: NostrEvent, tagName: string): string | undefined {
	const tag = event.tags.find((t) => t[0] === tagName);
	return tag?.[1];
}

/**
 * Extract all values for a given tag name from a Nostr event.
 * Returns an array of the second element from each matching tag.
 */
function getTagValues(event: NostrEvent, tagName: string): string[] {
	return event.tags
		.filter((t) => t[0] === tagName)
		.map((t) => t[1])
		.filter(Boolean);
}

/**
 * Extract a title from a bounty event using the fallback chain:
 * 1. 'title' tag
 * 2. 'subject' tag
 * 3. First line of content (truncated to 80 chars)
 * 4. 'Untitled Bounty'
 */
function extractTitle(event: NostrEvent): string {
	const titleTag = getTagValue(event, 'title');
	if (titleTag) return titleTag;

	const subjectTag = getTagValue(event, 'subject');
	if (subjectTag) return subjectTag;

	if (event.content) {
		const firstLine = event.content.split('\n')[0].trim();
		if (firstLine) {
			return firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine;
		}
	}

	return 'Untitled Bounty';
}

/**
 * Parse a bounty event (kind 37300) into a BountySummary.
 * Handles missing or malformed tags defensively.
 * Returns null if the event fails tag validation.
 */
export function parseBountySummary(event: NostrEvent): BountySummary | null {
	const tagResult = validateEventTags(event);
	if (!tagResult.valid) return null;
	const dTag = getTagValue(event, 'd') ?? '';
	const title = extractTitle(event);
	const rewardRaw = getTagValue(event, 'reward');
	const rewardAmount = rewardRaw ? parseInt(rewardRaw, 10) : 0;
	const tags = getTagValues(event, 't');
	const expirationRaw = getTagValue(event, 'expiration');
	const deadline = expirationRaw ? parseInt(expirationRaw, 10) : null;

	return {
		id: event.id,
		dTag,
		pubkey: event.pubkey,
		title,
		tags,
		rewardAmount: Number.isNaN(rewardAmount) ? 0 : rewardAmount,
		totalPledged: 0,
		solutionCount: 0,
		status: 'open',
		createdAt: event.created_at,
		deadline: deadline !== null && Number.isNaN(deadline) ? null : deadline
	};
}

/**
 * Parse a pledge event (kind 73002) into a Pledge.
 * Returns null if the event fails tag validation.
 */
export function parsePledge(event: NostrEvent): Pledge | null {
	const tagResult = validateEventTags(event);
	if (!tagResult.valid) return null;

	const bountyAddress = getTagValue(event, 'a') ?? '';
	const amountRaw = getTagValue(event, 'amount');
	const amount = amountRaw ? parseInt(amountRaw, 10) : 0;
	const cashuToken = getTagValue(event, 'cashu') ?? '';
	const mintUrl = getTagValue(event, 'mint') ?? '';

	return {
		event,
		id: event.id,
		pubkey: event.pubkey,
		bountyAddress,
		amount: Number.isNaN(amount) ? 0 : amount,
		cashuToken,
		mintUrl,
		createdAt: event.created_at,
		message: event.content ?? ''
	};
}

/**
 * Parse a solution event (kind 73001) into a Solution.
 * Returns null if the event fails tag validation.
 */
export function parseSolution(event: NostrEvent): Solution | null {
	const tagResult = validateEventTags(event);
	if (!tagResult.valid) return null;

	const bountyAddress = getTagValue(event, 'a') ?? '';
	// Support multiple cashu tags (tokens can be split across several)
	let antiSpamTokens = getTagValues(event, 'cashu');
	if (antiSpamTokens.length === 0) {
		// Legacy fallback: single 'fee' tag
		const feeTag = getTagValue(event, 'fee');
		if (feeTag) antiSpamTokens = [feeTag];
	}
	const antiSpamAmountRaw = getTagValue(event, 'amount');
	const antiSpamAmount = antiSpamAmountRaw ? parseInt(antiSpamAmountRaw, 10) : 0;
	const deliverableUrl = getTagValue(event, 'r') ?? null;

	return {
		event,
		id: event.id,
		pubkey: event.pubkey,
		bountyAddress,
		description: event.content ?? '',
		antiSpamTokens,
		antiSpamAmount: Number.isNaN(antiSpamAmount) ? 0 : antiSpamAmount,
		deliverableUrl,
		createdAt: event.created_at,
		voteWeight: 0
	};
}

/**
 * Parse a vote event (kind 1018) into a Vote.
 * Returns null if the event fails tag validation.
 */
export function parseVote(event: NostrEvent): Vote | null {
	const tagResult = validateEventTags(event);
	if (!tagResult.valid) return null;

	const bountyAddress = getTagValue(event, 'a') ?? '';
	const solutionId = getTagValue(event, 'e') ?? '';
	const voteTag = getTagValue(event, 'vote');
	const choice: 'approve' | 'reject' = voteTag === 'reject' ? 'reject' : 'approve';

	return {
		event,
		id: event.id,
		pubkey: event.pubkey,
		bountyAddress,
		solutionId,
		choice,
		pledgeAmount: 0,
		weight: 0,
		createdAt: event.created_at
	};
}

/**
 * Parse a payout event (kind 73004) into a Payout.
 * Returns null if the event fails tag validation.
 * Validates that the payout event pubkey belongs to a pledger for this bounty.
 *
 * @param event - The Kind 73004 payout event.
 * @param pledgerPubkeys - Optional set of pubkeys from Kind 73002 events. If provided,
 *   the event pubkey must be in this set. If omitted, authorization is skipped (backward compat).
 */
export function parsePayout(event: NostrEvent, pledgerPubkeys?: string[]): Payout | null {
	const tagResult = validateEventTags(event);
	if (!tagResult.valid) return null;

	// Verify payout authorization — pubkey must be a pledger for this bounty
	if (pledgerPubkeys && !pledgerPubkeys.includes(event.pubkey)) {
		console.warn(
			`[helpers] Unauthorized payout event ${event.id}: pubkey ${event.pubkey} is not a pledger for this bounty`
		);
		return null;
	}

	const bountyAddress = getTagValue(event, 'a') ?? '';
	const solutionId = getTagValue(event, 'e') ?? '';
	const solverPubkey = getTagValue(event, 'p') ?? '';
	const amountRaw = getTagValue(event, 'amount');
	const amount = amountRaw ? parseInt(amountRaw, 10) : 0;
	const cashuToken = getTagValue(event, 'cashu') ?? '';

	return {
		event,
		id: event.id,
		pubkey: event.pubkey,
		bountyAddress,
		solutionId,
		solverPubkey,
		amount: Number.isNaN(amount) ? 0 : amount,
		cashuToken,
		createdAt: event.created_at
	};
}

/**
 * Parse a bounty event and all related events into a full BountyDetail.
 * Composes all individual parsers and derives status from the state machine.
 */
export function parseBountyDetail(
	event: NostrEvent,
	pledgeEvents: NostrEvent[],
	solutionEvents: NostrEvent[],
	voteEvents: NostrEvent[],
	payoutEvents: NostrEvent[],
	deleteEvents: NostrEvent[]
): BountyDetail | null {
	const summary = parseBountySummary(event);
	if (!summary) return null;

	// Filter out invalid events (tag validation failures return null)
	const pledges = pledgeEvents.map(parsePledge).filter((p): p is Pledge => p !== null);
	const solutions = solutionEvents.map(parseSolution).filter((s): s is Solution => s !== null);
	const votes = voteEvents.map(parseVote).filter((v): v is Vote => v !== null);

	// Extract pledger pubkeys for payout authorization
	const pledgerPubkeys = pledges.map((p) => p.pubkey);

	// Validate payouts — pubkey must be a pledger for this bounty
	const payouts = payoutEvents
		.map((e) => parsePayout(e, pledgerPubkeys))
		.filter((p): p is Payout => p !== null);

	const totalPledged = pledges.reduce((sum, p) => sum + p.amount, 0);

	// Group votes by solution ID
	const votesBySolution = new Map<string, Vote[]>();
	for (const vote of votes) {
		const existing = votesBySolution.get(vote.solutionId) ?? [];
		existing.push(vote);
		votesBySolution.set(vote.solutionId, existing);
	}

	// Compute vote consensus: check if any solution has reached 66% approval
	const pledgesByPubkey = new Map<string, number>();
	for (const pledge of pledges) {
		const existing = pledgesByPubkey.get(pledge.pubkey) ?? 0;
		pledgesByPubkey.set(pledge.pubkey, existing + pledge.amount);
	}

	let hasConsensus = false;
	for (const [, solutionVotes] of votesBySolution) {
		const tally = tallyVotes(solutionVotes, pledgesByPubkey, totalPledged);
		if (tally.isApproved) {
			hasConsensus = true;
			break;
		}
	}

	const status = deriveBountyStatus(
		event,
		pledgeEvents,
		solutionEvents,
		payoutEvents,
		deleteEvents,
		undefined,
		hasConsensus
	);

	// Extract additional bounty fields
	const rewardCurrency = getTagValue(event, 'currency') ?? 'sat';
	const mintUrl = getTagValue(event, 'mint') ?? null;
	const submissionFeeRaw = getTagValue(event, 'fee') ?? getTagValue(event, 'submission_fee');
	const submissionFee = submissionFeeRaw ? parseInt(submissionFeeRaw, 10) : 0;

	return {
		event,
		id: event.id,
		dTag: summary.dTag,
		pubkey: event.pubkey,
		title: summary.title,
		description: event.content ?? '',
		rewardAmount: summary.rewardAmount,
		rewardCurrency,
		tags: summary.tags,
		deadline: summary.deadline,
		status,
		totalPledged,
		solutionCount: solutions.length,
		createdAt: event.created_at,
		mintUrl,
		submissionFee: Number.isNaN(submissionFee) ? 0 : submissionFee,
		pledges,
		solutions,
		votesBySolution,
		payouts,
		creatorProfile: null
	};
}
