import type { NostrEvent } from 'nostr-tools';

export type BountyStatus = 'draft' | 'open' | 'in_review' | 'completed' | 'expired' | 'cancelled';

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
	antiSpamToken: string;
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
	createdAt: number;
}

export interface BountyDetail extends Bounty {
	pledges: Pledge[];
	solutions: Solution[];
	votesBySolution: Map<string, Vote[]>;
	payout: Payout | null;
	creatorProfile: Record<string, string> | null;
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
