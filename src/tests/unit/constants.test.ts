import { describe, it, expect } from 'vitest';
import {
	CLIENT_TAG,
	APP_NAME,
	SESSION_STORAGE_KEY,
	SIGNER_TIMEOUT_MS
} from '$lib/utils/constants';

describe('constants', () => {
	it('CLIENT_TAG equals "tasks.fyi"', () => {
		expect(CLIENT_TAG).toBe('tasks.fyi');
	});

	it('APP_NAME equals "Tasks.fyi"', () => {
		expect(APP_NAME).toBe('Tasks.fyi');
	});

	it('SESSION_STORAGE_KEY is a non-empty string', () => {
		expect(SESSION_STORAGE_KEY).toBeTruthy();
		expect(typeof SESSION_STORAGE_KEY).toBe('string');
	});

	it('SIGNER_TIMEOUT_MS is 30 seconds', () => {
		expect(SIGNER_TIMEOUT_MS).toBe(30000);
	});
});
