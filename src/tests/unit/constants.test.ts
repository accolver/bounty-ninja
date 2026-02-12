import { describe, it, expect } from 'vitest';
import {
	CLIENT_TAG,
	APP_NAME,
	SESSION_STORAGE_KEY,
	SIGNER_TIMEOUT_MS
} from '$lib/utils/constants';

describe('constants', () => {
	it('CLIENT_TAG equals "bounty.ninja"', () => {
		expect(CLIENT_TAG).toBe('bounty.ninja');
	});

	it('APP_NAME equals "Bounty.ninja"', () => {
		expect(APP_NAME).toBe('Bounty.ninja');
	});

	it('SESSION_STORAGE_KEY is a non-empty string', () => {
		expect(SESSION_STORAGE_KEY).toBeTruthy();
		expect(typeof SESSION_STORAGE_KEY).toBe('string');
	});

	it('SIGNER_TIMEOUT_MS is 30 seconds', () => {
		expect(SIGNER_TIMEOUT_MS).toBe(30000);
	});
});
