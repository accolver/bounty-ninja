import { describe, it, expect } from 'vitest';
import { isValidRelayUrl } from '$lib/utils/relay-validation';

describe('isValidRelayUrl', () => {
	it('accepts a valid wss:// relay URL', () => {
		const result = isValidRelayUrl('wss://relay.damus.io');
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	it('accepts a valid wss:// relay URL with port and path', () => {
		const result = isValidRelayUrl('wss://relay.example.com:8080/path');
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	it('rejects wss:// with no hostname', () => {
		const result = isValidRelayUrl('wss://');
		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
	});

	it('rejects ws:// (insecure) protocol', () => {
		const result = isValidRelayUrl('ws://insecure.com');
		expect(result.valid).toBe(false);
		expect(result.error).toBe('Must use wss:// protocol');
	});

	it('rejects http:// protocol', () => {
		const result = isValidRelayUrl('http://not-a-relay.com');
		expect(result.valid).toBe(false);
		expect(result.error).toBe('Must use wss:// protocol');
	});

	it('rejects a non-URL string', () => {
		const result = isValidRelayUrl('not a url');
		expect(result.valid).toBe(false);
		expect(result.error).toBe('Invalid URL format');
	});

	it('rejects an empty string', () => {
		const result = isValidRelayUrl('');
		expect(result.valid).toBe(false);
		expect(result.error).toBe('Invalid URL format');
	});

	it('rejects https:// protocol', () => {
		const result = isValidRelayUrl('https://relay.example.com');
		expect(result.valid).toBe(false);
		expect(result.error).toBe('Must use wss:// protocol');
	});

	it('rejects wss:// with a too-short hostname', () => {
		// Hostname "ab" has length 2 which is < 3
		const result = isValidRelayUrl('wss://ab');
		expect(result.valid).toBe(false);
		expect(result.error).toBe('Invalid hostname');
	});

	it('accepts wss:// with a hostname of exactly 3 characters', () => {
		const result = isValidRelayUrl('wss://abc');
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});
});
