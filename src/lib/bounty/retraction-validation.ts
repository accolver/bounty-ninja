import type { Bounty, Pledge, Retraction, RetractionValidation } from './types';

export function getBountyAddress(bounty: Pick<Bounty, 'pubkey' | 'dTag'>): string {
	return `37300:${bounty.pubkey}:${bounty.dTag}`;
}

export function validateBountyRetraction(
	retraction: Retraction,
	bounty: Pick<Bounty, 'pubkey' | 'dTag'>
): RetractionValidation {
	if (retraction.type !== 'bounty') return { retraction, valid: false, reason: 'wrong_type' };
	if (retraction.taskAddress !== getBountyAddress(bounty)) {
		return { retraction, valid: false, reason: 'wrong_bounty' };
	}
	if (retraction.pubkey !== bounty.pubkey) {
		return { retraction, valid: false, reason: 'unauthorized_author' };
	}
	return { retraction, valid: true };
}

export function validatePledgeRetraction(
	retraction: Retraction,
	pledge: Pledge,
	bountyAddress: string
): RetractionValidation {
	if (retraction.type !== 'pledge') return { retraction, valid: false, reason: 'wrong_type' };
	if (retraction.pledgeEventId !== pledge.id) {
		return { retraction, valid: false, reason: 'wrong_pledge' };
	}
	if (retraction.taskAddress !== bountyAddress || pledge.bountyAddress !== bountyAddress) {
		return { retraction, valid: false, reason: 'wrong_bounty' };
	}
	if (retraction.pubkey !== pledge.pubkey) {
		return { retraction, valid: false, reason: 'unauthorized_author' };
	}
	return { retraction, valid: true };
}
