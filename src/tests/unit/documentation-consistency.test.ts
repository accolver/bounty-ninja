import { describe, expect, it } from 'vitest';
import prd from '../../../PRD.md?raw';
import readme from '../../../README.md?raw';
import paymentGuide from '../../../PAYMENTS_TEST.md?raw';
import launchChecklist from '../../../LAUNCH_CHECKLIST.md?raw';
import cashuSpec from '../../../openspec/specs/cashu-payments/spec.md?raw';
import payoutSpec from '../../../openspec/specs/payout-orchestration/spec.md?raw';

const paymentDocs = [prd, readme, paymentGuide, cashuSpec, payoutSpec];

describe('repository payment documentation', () => {
	it('documents disabled production writes and the permanent Minibits policy', () => {
		for (const document of paymentDocs) {
			expect(document).toMatch(/disabled/i);
			expect(document).toMatch(/Minibits/i);
			expect(document).toMatch(/no[- ]locktime|no locktime/i);
		}
		expect(prd).toContain("['payment', 'cashu', '<66-character lowercase");
		expect(paymentGuide).toContain("['payment','cashu','<compressed-key>']");
	});

	it('does not claim automatic payout, generic wallet support, or completed launch work', () => {
		for (const document of paymentDocs) {
			expect(document).not.toMatch(/payout is automatic|automatic payout/i);
		}
		expect(launchChecklist).toContain('Every gate below is **pending**');
		expect(launchChecklist).not.toMatch(/- \[[xX]\]/);
		expect(launchChecklist).toMatch(/current copy\/paste Minibits workflow alone is not this/);
	});

	it('keeps launch evidence categories concrete without marking them complete', () => {
		for (const heading of [
			'Test-Funds Beta',
			'Recovery Drill',
			'Independent Payment Review',
			'Wallet Interoperability',
			'Accessibility',
			'Release And Operations'
		]) {
			expect(launchChecklist).toContain(`## ${heading}`);
		}
	});
});
