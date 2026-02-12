import type { NostrEvent } from 'nostr-tools';

export type TaskStatus = 'draft' | 'open' | 'in_review' | 'completed' | 'expired' | 'cancelled';

export interface Task {
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
	status: TaskStatus;
	totalPledged: number;
	solutionCount: number;
	createdAt: number;
	mintUrl: string | null;
	submissionFee: number;
}

export interface TaskSummary {
	id: string;
	dTag: string;
	pubkey: string;
	title: string;
	tags: string[];
	rewardAmount: number;
	totalPledged: number;
	solutionCount: number;
	status: TaskStatus;
	createdAt: number;
	deadline: number | null;
}

export interface Pledge {
	event: NostrEvent;
	id: string;
	pubkey: string;
	taskAddress: string;
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
	taskAddress: string;
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
	taskAddress: string;
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
	taskAddress: string;
	solutionId: string;
	solverPubkey: string;
	amount: number;
	cashuToken: string;
	createdAt: number;
}

export interface TaskDetail extends Task {
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
	quorumPercent: number;
}
