import type { NostrEvent } from 'nostr-tools';
import {
	BOUNTY_KIND,
	SOLUTION_KIND,
	PLEDGE_KIND,
	VOTE_KIND,
	PAYOUT_KIND,
	RETRACTION_KIND,
	REPUTATION_KIND
} from '$lib/bounty/kinds';
import { getTagValue } from '$lib/nostr/nostr-tags';

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
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
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
	const errors: string[] = [];

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
	const errors: string[] = [];

	const aTag = getTagValue(event, 'a');
	if (!aTag) {
		errors.push("Solution event missing required 'a' tag");
	} else if (!isValidBountyAddress(aTag)) {
		errors.push(`Solution 'a' tag has invalid format: ${aTag}`);
	}

	if (!event.content || event.content.trim().length === 0) {
		errors.push('Solution event must have non-empty content');
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
	const errors: string[] = [];

	const aTag = getTagValue(event, 'a');
	if (!aTag) {
		errors.push("Payout event missing required 'a' tag");
	} else if (!isValidBountyAddress(aTag)) {
		errors.push(`Payout 'a' tag has invalid format: ${aTag}`);
	}

	const eTag = getTagValue(event, 'e');
	if (!eTag) {
		errors.push("Payout event missing required 'e' tag (solution event ID)");
	} else if (!isHex64(eTag)) {
		errors.push(`Payout 'e' tag must be a valid event ID (64-char hex), got: ${eTag}`);
	}

	const pTag = getTagValue(event, 'p');
	if (!pTag) {
		errors.push("Payout event missing required 'p' tag (bounty creator pubkey)");
	} else if (!isHex64(pTag)) {
		errors.push(`Payout 'p' tag must be a valid pubkey (64-char hex), got: ${pTag}`);
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
