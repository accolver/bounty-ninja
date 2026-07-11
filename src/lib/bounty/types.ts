import type { NostrEvent } from 'nostr-tools';
import type {
	CashuTokenVerification,
	PledgeVerification,
	ProofIdentity,
	VerificationStatus
} from '$lib/cashu/types';

export type BountyStatus =
	| 'draft'
	| 'open'
	| 'in_review'
	| 'consensus_reached'
	| 'releasing'
	| 'completed'
	| 'expired'
	| 'cancelled';

export interface Bounty {
	event: NostrEvent;
	id: string;
	dTag: string;
	pubkey: string;
	title: string;
	description: string;
	rewardAmount: number;
	rewardCurrency: string;
	tags: string[];
	deadline: number | null;
	status: BountyStatus;
	totalPledged: number;
	solutionCount: number;
	createdAt: number;
	mintUrl: string | null;
	submissionFee: number;
}

export interface BountySummary {
	id: string;
	dTag: string;
	pubkey: string;
	title: string;
	tags: string[];
	rewardAmount: number;
	totalPledged: number;
	solutionCount: number;
	status: BountyStatus;
	createdAt: number;
	deadline: number | null;
}

export interface Pledge {
	event: NostrEvent;
	id: string;
	pubkey: string;
	bountyAddress: string;
	amount: number;
	cashuToken: string;
	mintUrl: string;
	createdAt: number;
	message: string;
}

export interface Solution {
	event: NostrEvent;
	id: string;
	pubkey: string;
	bountyAddress: string;
	description: string;
	antiSpamTokens: string[];
	antiSpamAmount: number;
	deliverableUrl: string | null;
	createdAt: number;
	voteWeight: number;
}

export interface Vote {
	event: NostrEvent;
	id: string;
	pubkey: string;
	bountyAddress: string;
	solutionId: string;
	choice: 'approve' | 'reject';
	pledgeAmount: number;
	weight: number;
	createdAt: number;
}

export interface Payout {
	event: NostrEvent;
	id: string;
	pubkey: string;
	bountyAddress: string;
	solutionId: string;
	solverPubkey: string;
	amount: number;
	cashuToken: string;
	/** Exact source pledge reference. Null identifies a legacy, untrusted payout. */
	sourcePledgeId: string | null;
	/** Event-declared mint. Null identifies a legacy, untrusted payout. */
	mintUrl: string | null;
	createdAt: number;
}

export interface BountyDetail extends Bounty {
	pledges: Pledge[];
	solutions: Solution[];
	votesBySolution: Map<string, Vote[]>;
	payouts: Payout[];
	creatorProfile: Record<string, string> | null;
}

export interface Retraction {
	event: NostrEvent;
	id: string;
	pubkey: string;
	taskAddress: string;
	type: 'bounty' | 'pledge';
	pledgeEventId: string | null;
	reason: string;
	createdAt: number;
	hasSolutions: boolean;
}

export interface ReputationEvent {
	event: NostrEvent;
	id: string;
	pubkey: string;
	offenderPubkey: string;
	taskAddress: string;
	type: 'bounty_retraction' | 'pledge_retraction';
	retractionEventId: string;
	description: string;
	createdAt: number;
}

export interface VoteTally {
	approveWeight: number;
	rejectWeight: number;
	quorum: number;
	isApproved: boolean;
	isRejected: boolean;
	isTied: boolean;
	quorumPercent: number;
}

export type ConsensusResult =
	| { state: 'none'; tallies: ReadonlyMap<string, VoteTally> }
	| { state: 'unique'; winner: Solution; tallies: ReadonlyMap<string, VoteTally> }
	| {
			state: 'ambiguous';
			approvedSolutionIds: readonly string[];
			tallies: ReadonlyMap<string, VoteTally>;
	  }
	| { state: 'incomplete'; reason: string; tallies: ReadonlyMap<string, VoteTally> };

export interface RetractionValidation {
	retraction: Retraction;
	valid: boolean;
	reason?: string;
}

export interface PayoutValidation {
	payout: Payout;
	status: VerificationStatus;
	sourcePledgeId: string | null;
	reasons: readonly string[];
}

export interface ReleaseProgress {
	requiredPledgeIds: ReadonlySet<string>;
	releasedPledgeIds: ReadonlySet<string>;
	releasedAmount: number;
	totalAmount: number;
	complete: boolean;
}

/** Complete deterministic financial and lifecycle view for one bounty. */
export interface FinancialProjection {
	policyVersion: number;
	projectedAt: number;
	bountyAddress: string;
	validatedPledges: readonly Pledge[];
	activePledges: readonly Pledge[];
	pendingPledges: readonly Pledge[];
	unavailablePledges: readonly Pledge[];
	invalidPledges: readonly Pledge[];
	proofOwners: ReadonlyMap<ProofIdentity, string>;
	validatedFunding: number;
	votingPowerByPubkey: ReadonlyMap<string, number>;
	solutions: readonly Solution[];
	consensus: ConsensusResult;
	authorizedRetractions: readonly Retraction[];
	validPayouts: readonly Payout[];
	payoutValidations: readonly PayoutValidation[];
	releaseProgress: ReleaseProgress;
	cancelled: boolean;
	status: BountyStatus;
}

export interface FinancialProjectionInput {
	bounty: Bounty;
	pledges: readonly Pledge[];
	pledgeVerifications: ReadonlyMap<string, PledgeVerification>;
	solutions: readonly Solution[];
	votes: readonly Vote[];
	payouts: readonly Payout[];
	payoutTokenVerifications: ReadonlyMap<string, CashuTokenVerification>;
	retractions: readonly Retraction[];
	relatedEventsComplete: boolean;
	now: number;
}
