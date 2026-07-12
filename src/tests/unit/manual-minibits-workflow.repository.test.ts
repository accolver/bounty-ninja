import { describe, expect, it } from 'vitest';

const modules = import.meta.glob(
	[
		'/src/lib/components/pledge/PledgeForm.svelte',
		'/src/lib/components/solution/SolutionForm.svelte',
		'/src/lib/components/voting/PayoutTrigger.svelte',
		'/src/lib/components/voting/SolverClaim.svelte',
		'/src/lib/components/pledge/RetractPledgeButton.svelte'
	],
	{ eager: true, import: 'default', query: '?raw' }
) as Record<string, string>;

describe('guarded manual Minibits workflow', () => {
	it('collects explicit public payment keys without an app payment signer', () => {
		const pledge = modules['/src/lib/components/pledge/PledgeForm.svelte'];
		const solution = modules['/src/lib/components/solution/SolutionForm.svelte'];
		expect(pledge).toContain('Minibits wallet public key');
		expect(pledge).toContain('verifyManualP2PKToken');
		expect(pledge).not.toContain('createPledgeToken');
		expect(pledge).not.toContain('CashuPaymentSigner');
		expect(solution).toContain('Minibits payout public key');
		expect(solution).toContain('paymentPubkey !== null');
	});

	it('journals source-bound release and reclaim before exact-event publication', () => {
		const payout = modules['/src/lib/components/voting/PayoutTrigger.svelte'];
		const reclaim = modules['/src/lib/components/pledge/RetractPledgeButton.svelte'];
		expect(payout).toContain("kind: 'release'");
		expect(payout).toContain("'awaiting-wallet'");
		expect(payout).toContain('sourcePledgeId: selectedPledge.id');
		expect(payout).toContain('publishJournaledEvent(record)');
		expect(reclaim).toContain('verifySourceProofsSpent');
		expect(reclaim).toContain("kind: 'reclaim'");
	});

	it('journals pledge context and reuses the exact signed event on retry', () => {
		const pledge = modules['/src/lib/components/pledge/PledgeForm.svelte'];
		expect(pledge).toContain("kind: 'pledge'");
		expect(pledge).toContain('bountyAddress,');
		expect(pledge).toContain("paymentJournal.transition(operation.id, 'token-verified')");
		expect(pledge).toContain(
			"paymentJournal.transition(record.id, 'event-signed', { signedEvent })"
		);
		expect(pledge).toContain('publishJournaledEvent(record)');
		expect(pledge).toContain('if (!record.signedEvent)');
		expect(pledge).not.toContain('publishEvent(template)');
	});

	it('reclaims only through the original pending send and never offers source-token copy', () => {
		const reclaim = modules['/src/lib/components/pledge/RetractPledgeButton.svelte'];
		expect(reclaim).toContain('ORIGINAL pending Minibits send');
		expect(reclaim).toContain('Never import the public source token first');
		expect(reclaim).not.toContain('Copy exact source token');
		expect(reclaim).not.toContain('navigator.clipboard');
	});

	it('offers copy and generic Cashu handoff to the solver without remote token disclosure', () => {
		const claim = modules['/src/lib/components/voting/SolverClaim.svelte'];
		expect(claim).toContain('navigator.clipboard.writeText');
		expect(claim).toContain('navigator.clipboard.writeText');
		expect(claim).toContain('cashu:${payout.cashuToken}');
		expect(claim).not.toContain('api.qrserver.com');
		expect(claim).toContain('cashu:${payout.cashuToken}');
		expect(claim).toContain('P2PK-locked');
	});
});
