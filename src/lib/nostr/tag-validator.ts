import type { NostrEvent } from 'nostr-tools';
import {
	BOUNTY_KIND,
	SOLUTION_KIND,
	PLEDGE_KIND,
	VOTE_KIND,
	PAYOUT_KIND,
	PAYOUT_SOURCE_MARKER,
	RETRACTION_KIND,
	REPUTATION_KIND
} from '$lib/bounty/kinds';
import { getTagValue } from '$lib/nostr/nostr-tags';
import { CLIENT_TAG } from '$lib/utils/constants';
import { safeEventUrl } from '$lib/utils/safe-event-url';
import { isXOnlyPubkey } from '$lib/cashu/p2pk';

const DOMAIN_KINDS = new Set([
	BOUNTY_KIND,
	SOLUTION_KIND,
	PLEDGE_KIND,
	VOTE_KIND,
	PAYOUT_KIND,
	RETRACTION_KIND,
	REPUTATION_KIND
]);

const CONTENT_LIMITS: Record<number, number> = {
	0: 16_384,
	[BOUNTY_KIND]: 50_000,
	[SOLUTION_KIND]: 100_000,
	[PLEDGE_KIND]: 280,
	[VOTE_KIND]: 0,
	[PAYOUT_KIND]: 2_000,
	[RETRACTION_KIND]: 2_000,
	[REPUTATION_KIND]: 2_000
};

const TAG_LIMITS: Record<number, number> = {
	0: 8,
	[BOUNTY_KIND]: 32,
	[SOLUTION_KIND]: 32,
	[PLEDGE_KIND]: 16,
	[VOTE_KIND]: 12,
	[PAYOUT_KIND]: 20,
	[RETRACTION_KIND]: 12,
	[REPUTATION_KIND]: 12
};

const SINGLETON_TAGS = new Set([
	'd',
	'title',
	'subject',
	'reward',
	'amount',
	'mint',
	'vote',
	'type',
	'r',
	'client',
	'payment'
]);

function validatePaymentTag(event: NostrEvent, required: boolean): string[] {
	const tags = event.tags.filter((tag) => tag[0] === 'payment');
	if (tags.length === 0) return required ? ["Event missing required 'payment' tag"] : [];
	if (tags.length > 1) return ["Tag 'payment' must not be repeated"];
	const tag = tags[0];
	if (tag.length !== 3) return ["Payment tag must be ['payment', 'cashu', <x-only-key>]"];
	if (tag[1] !== 'cashu') return ["Payment tag scheme must be 'cashu'"];
	if (!isXOnlyPubkey(tag[2] ?? '')) {
		return ['Payment tag key must be lowercase 64-character x-only hex'];
	}
	return [];
}

/**
 * Result of tag validation for a Nostr event.
 */
export interface TagValidationResult {
	valid: boolean;
	errors: string[];
}

/**
 * Check if a string is a valid positive integer (> 0).
 */
function isPositiveInteger(value: string): boolean {
	const num = parseInt(value, 10);
	return !Number.isNaN(num) && num > 0 && String(num) === value;
}

/**
 * Check if a string is a valid 64-character hex string (pubkey/event id).
 */
function isHex64(value: string): boolean {
	return /^[0-9a-f]{64}$/i.test(value);
}

/**
 * Check if a string is a valid URL.
 */
function isValidUrl(value: string): boolean {
	return safeEventUrl(value, 'external-link') !== null;
}

/**
 * Validate the 'a' tag format for bounty references.
 * Expected format: "37300:<hex-pubkey>:<d-tag>"
 */
function isValidBountyAddress(value: string): boolean {
	const parts = value.split(':');
	if (parts.length < 3) return false;

	const [kindStr, pubkey, ...dTagParts] = parts;
	const dTag = dTagParts.join(':'); // d-tag may contain colons

	if (kindStr !== String(BOUNTY_KIND)) return false;
	if (!isHex64(pubkey)) return false;
	if (!dTag || dTag.length === 0) return false;
	if (dTag.length > 128) return false;

	return true;
}

/**
 * Validate required tags for a bounty event (kind 37300).
 */
function validateBountyTags(event: NostrEvent): string[] {
	const errors: string[] = [];

	const dTag = getTagValue(event, 'd');
	if (!dTag || dTag.length === 0) {
		errors.push("Bounty event missing required 'd' tag");
	}

	const title = getTagValue(event, 'title');
	const subject = getTagValue(event, 'subject');
	if ((!title || title.length === 0) && (!subject || subject.length === 0)) {
		errors.push("Bounty event missing required 'title' or 'subject' tag");
	}

	const reward = getTagValue(event, 'reward');
	if (!reward) {
		errors.push("Bounty event missing required 'reward' tag");
	} else if (!isPositiveInteger(reward)) {
		errors.push(`Bounty 'reward' tag must be a positive integer, got: ${reward}`);
	}

	return errors;
}

/**
 * Validate required tags for a pledge event (kind 73002).
 */
function validatePledgeTags(event: NostrEvent): string[] {
	const errors: string[] = validatePaymentTag(event, false);

	const aTag = getTagValue(event, 'a');
	if (!aTag) {
		errors.push("Pledge event missing required 'a' tag");
	} else if (!isValidBountyAddress(aTag)) {
		errors.push(`Pledge 'a' tag has invalid format: ${aTag}`);
	}

	const amount = getTagValue(event, 'amount');
	if (!amount) {
		errors.push("Pledge event missing required 'amount' tag");
	} else if (!isPositiveInteger(amount)) {
		errors.push(`Pledge 'amount' tag must be a positive integer, got: ${amount}`);
	}

	const cashu = getTagValue(event, 'cashu');
	if (!cashu || cashu.length === 0) {
		errors.push("Pledge event missing required 'cashu' tag (non-empty)");
	}

	const mint = getTagValue(event, 'mint');
	if (!mint) {
		errors.push("Pledge event missing required 'mint' tag");
	} else if (!isValidUrl(mint)) {
		errors.push(`Pledge 'mint' tag must be a valid URL, got: ${mint}`);
	}

	return errors;
}

/**
 * Validate required tags for a solution event (kind 73001).
 */
function validateSolutionTags(event: NostrEvent): string[] {
	const errors: string[] = validatePaymentTag(event, false);

	const aTag = getTagValue(event, 'a');
	if (!aTag) {
		errors.push("Solution event missing required 'a' tag");
	} else if (!isValidBountyAddress(aTag)) {
		errors.push(`Solution 'a' tag has invalid format: ${aTag}`);
	}

	if (!event.content || event.content.trim().length === 0) {
		errors.push('Solution event must have non-empty content');
	}

	const deliverable = getTagValue(event, 'r');
	if (deliverable && !isValidUrl(deliverable)) {
		errors.push(`Solution 'r' tag must be a safe HTTPS URL, got: ${deliverable}`);
	}

	return errors;
}

/**
 * Validate required tags for a vote event (kind 1018).
 */
function validateVoteTags(event: NostrEvent): string[] {
	const errors: string[] = [];

	const aTag = getTagValue(event, 'a');
	if (!aTag) {
		errors.push("Vote event missing required 'a' tag");
	} else if (!isValidBountyAddress(aTag)) {
		errors.push(`Vote 'a' tag has invalid format: ${aTag}`);
	}

	const eTag = getTagValue(event, 'e');
	if (!eTag) {
		errors.push("Vote event missing required 'e' tag (solution event ID)");
	} else if (!isHex64(eTag)) {
		errors.push(`Vote 'e' tag must be a valid event ID (64-char hex), got: ${eTag}`);
	}

	const vote = getTagValue(event, 'vote');
	if (!vote) {
		errors.push("Vote event missing required 'vote' tag");
	} else if (vote !== 'approve' && vote !== 'reject') {
		errors.push(`Vote 'vote' tag must be 'approve' or 'reject', got: ${vote}`);
	}

	return errors;
}

/**
 * Validate required tags for a payout event (kind 73004).
 */
function validatePayoutTags(event: NostrEvent): string[] {
	const sourceBound = event.tags.some((tag) => tag[0] === 'e' && tag[3] === PAYOUT_SOURCE_MARKER);
	const errors: string[] = validatePaymentTag(event, sourceBound);

	const aTag = getTagValue(event, 'a');
	if (!aTag) {
		errors.push("Payout event missing required 'a' tag");
	} else if (!isValidBountyAddress(aTag)) {
		errors.push(`Payout 'a' tag has invalid format: ${aTag}`);
	}

	const solutionTags = event.tags.filter(
		(tag) => tag[0] === 'e' && tag[3] !== PAYOUT_SOURCE_MARKER
	);
	const solutionId = solutionTags[0]?.[1];
	if (!solutionId) {
		errors.push("Payout event missing required 'e' tag (solution event ID)");
	} else if (!isHex64(solutionId)) {
		errors.push(`Payout 'e' tag must be a valid event ID (64-char hex), got: ${solutionId}`);
	}
	if (solutionTags.length > 1) {
		errors.push('Payout event must reference exactly one solution');
	}

	const pTag = getTagValue(event, 'p');
	if (!pTag) {
		errors.push("Payout event missing required 'p' tag (bounty creator pubkey)");
	} else if (!isHex64(pTag)) {
		errors.push(`Payout 'p' tag must be a valid pubkey (64-char hex), got: ${pTag}`);
	}

	const sourceTags = event.tags.filter((tag) => tag[0] === 'e' && tag[3] === PAYOUT_SOURCE_MARKER);
	const mint = getTagValue(event, 'mint');
	if (sourceTags.length > 1) {
		errors.push('Payout event must reference exactly one source pledge');
	}
	if (sourceTags.length === 1 && !isHex64(sourceTags[0][1] ?? '')) {
		errors.push("Payout source 'e' tag must be a valid event ID (64-char hex)");
	}
	if (sourceTags.length > 0 && !mint) {
		errors.push("Source-bound payout event missing required 'mint' tag");
	}
	if (mint && sourceTags.length === 0) {
		errors.push('Payout mint requires an exact source pledge reference');
	}
	if (mint && !isValidUrl(mint)) {
		errors.push(`Payout 'mint' tag must be a valid URL, got: ${mint}`);
	}

	return errors;
}

/**
 * Validate required tags for a retraction event (kind 73005).
 */
function validateRetractionTags(event: NostrEvent): string[] {
	const errors: string[] = [];

	const aTag = getTagValue(event, 'a');
	if (!aTag) {
		errors.push("Retraction event missing required 'a' tag");
	} else if (!isValidBountyAddress(aTag)) {
		errors.push(`Retraction 'a' tag has invalid format: ${aTag}`);
	}

	const type = getTagValue(event, 'type');
	if (!type) {
		errors.push("Retraction event missing required 'type' tag");
	} else if (type !== 'bounty' && type !== 'pledge') {
		errors.push(`Retraction 'type' tag must be 'bounty' or 'pledge', got: ${type}`);
	}

	// Pledge retractions must reference the pledge event
	if (type === 'pledge') {
		const eTag = getTagValue(event, 'e');
		if (!eTag) {
			errors.push("Pledge retraction event missing required 'e' tag (pledge event ID)");
		} else if (!isHex64(eTag)) {
			errors.push(`Pledge retraction 'e' tag must be a valid event ID (64-char hex), got: ${eTag}`);
		}
	}

	return errors;
}

/**
 * Validate required tags for a reputation event (kind 73006).
 */
function validateReputationTags(event: NostrEvent): string[] {
	const errors: string[] = [];

	const pTag = getTagValue(event, 'p');
	if (!pTag) {
		errors.push("Reputation event missing required 'p' tag (offender pubkey)");
	} else if (!isHex64(pTag)) {
		errors.push(`Reputation 'p' tag must be a valid pubkey (64-char hex), got: ${pTag}`);
	}

	const aTag = getTagValue(event, 'a');
	if (!aTag) {
		errors.push("Reputation event missing required 'a' tag");
	} else if (!isValidBountyAddress(aTag)) {
		errors.push(`Reputation 'a' tag has invalid format: ${aTag}`);
	}

	const type = getTagValue(event, 'type');
	if (!type) {
		errors.push("Reputation event missing required 'type' tag");
	} else if (type !== 'bounty_retraction' && type !== 'pledge_retraction') {
		errors.push(
			`Reputation 'type' tag must be 'bounty_retraction' or 'pledge_retraction', got: ${type}`
		);
	}

	const eTag = getTagValue(event, 'e');
	if (!eTag) {
		errors.push("Reputation event missing required 'e' tag (retraction event ID)");
	} else if (!isHex64(eTag)) {
		errors.push(`Reputation 'e' tag must be a valid event ID (64-char hex), got: ${eTag}`);
	}

	return errors;
}

/**
 * Validate that a Nostr event has all required tags for its kind.
 * Returns a result with validation status and any error messages.
 *
 * Validates all bounty-related kinds (37300, 73001, 73002, 1018, 73004, 73005, 73006).
 * Unknown kinds pass validation (no required tags enforced).
 */
export function validateEventTags(event: NostrEvent): TagValidationResult {
	let errors: string[];

	switch (event.kind) {
		case BOUNTY_KIND:
			errors = validateBountyTags(event);
			break;
		case PLEDGE_KIND:
			errors = validatePledgeTags(event);
			break;
		case SOLUTION_KIND:
			errors = validateSolutionTags(event);
			break;
		case VOTE_KIND:
			errors = validateVoteTags(event);
			break;
		case PAYOUT_KIND:
			errors = validatePayoutTags(event);
			break;
		case RETRACTION_KIND:
			errors = validateRetractionTags(event);
			break;
		case REPUTATION_KIND:
			errors = validateReputationTags(event);
			break;
		default:
			// Unknown kinds pass validation — we don't enforce tags on them
			errors = [];
	}

	if (errors.length > 0) {
		console.warn(
			`[tag-validator] Event ${event.id} (kind ${event.kind}) failed validation:`,
			errors
		);
	}

	return {
		valid: errors.length === 0,
		errors
	};
}

/** Reject unsupported or resource-heavy events before parsing or persistence. */
export function validateEventResources(event: NostrEvent): TagValidationResult {
	const errors: string[] = [];
	const contentLimit = CONTENT_LIMITS[event.kind];
	const tagLimit = TAG_LIMITS[event.kind];

	if (contentLimit === undefined || tagLimit === undefined) {
		errors.push(`Unsupported event kind: ${event.kind}`);
		return { valid: false, errors };
	}
	if (event.content.length > contentLimit)
		errors.push(`Content exceeds ${contentLimit} characters`);
	if (event.tags.length > tagLimit) errors.push(`Tag count exceeds ${tagLimit}`);

	const counts = new Map<string, number>();
	for (const tag of event.tags) {
		if (tag.length === 0 || tag.length > 4) errors.push('Tag arity must be between 1 and 4');
		const name = tag[0] ?? '';
		counts.set(name, (counts.get(name) ?? 0) + 1);
		for (let index = 0; index < tag.length; index++) {
			const value = tag[index] ?? '';
			const limit = name === 'cashu' && index === 1 ? 262_144 : 2_048;
			if (value.length > limit) errors.push(`Tag '${name}' value exceeds ${limit} characters`);
		}
	}

	for (const name of SINGLETON_TAGS) {
		if ((counts.get(name) ?? 0) > 1) errors.push(`Tag '${name}' must not be repeated`);
	}
	if ((counts.get('cashu') ?? 0) > (event.kind === SOLUTION_KIND ? 16 : 1)) {
		errors.push("Too many 'cashu' tags");
	}
	const title = getTagValue(event, 'title') ?? getTagValue(event, 'subject');
	if (title && title.length > 200) errors.push('Title exceeds 200 characters');
	const dTag = getTagValue(event, 'd');
	if (dTag && dTag.length > 128) errors.push("Tag 'd' exceeds 128 characters");

	if (DOMAIN_KINDS.has(event.kind)) {
		const client = getTagValue(event, 'client');
		if (client !== CLIENT_TAG) errors.push(`Missing required client namespace '${CLIENT_TAG}'`);
	}

	return { valid: errors.length === 0, errors };
}
