import { describe, expect, it } from 'vitest';

import { isConfiguredMint, normalizePublicHttpsUrl } from '$lib/utils/network-policy';

describe('network policy', () => {
	it('rejects insecure, credentialed, local, and private mint URLs', () => {
		for (const value of [
			'http://mint.example',
			'https://user:secret@mint.example',
			'https://localhost',
			'https://127.0.0.1',
			'https://10.0.0.1',
			'https://192.168.1.2',
			'https://100.64.0.1',
			'https://198.18.0.1',
			'https://203.0.113.1',
			'https://service.local'
		]) {
			expect(normalizePublicHttpsUrl(value)).toBeNull();
		}
	});

	it('rejects the complete IPv6 link-local range and other non-public IPv6 literals', () => {
		for (const value of [
			'https://[::1]',
			'https://[fc00::1]',
			'https://[fe80::1]',
			'https://[fe90::1]',
			'https://[fea0::1]',
			'https://[febf:ffff::1]',
			'https://[ff02::1]',
			'https://[2001:db8::1]'
		]) {
			expect(normalizePublicHttpsUrl(value)).toBeNull();
		}
		expect(normalizePublicHttpsUrl('https://[2606:4700:4700::1111]')).toBe(
			'https://[2606:4700:4700::1111]'
		);
	});

	it('applies IPv4 policy to IPv4-mapped IPv6 literals', () => {
		for (const value of [
			'https://[::ffff:127.0.0.1]',
			'https://[::ffff:10.0.0.1]',
			'https://[::ffff:169.254.1.1]',
			'https://[::ffff:192.168.1.1]',
			'https://[::ffff:198.51.100.1]',
			'https://[::ffff:224.0.0.1]',
			'https://[::ffff:255.255.255.255]'
		]) {
			expect(normalizePublicHttpsUrl(value)).toBeNull();
		}
		expect(normalizePublicHttpsUrl('https://[::ffff:8.8.8.8]')).not.toBeNull();
	});

	it('matches only the configured normalized mint', () => {
		expect(isConfiguredMint('https://mint.example/path', 'https://mint.example/path/')).toBe(true);
		expect(isConfiguredMint('https://attacker.example', 'https://mint.example/path')).toBe(false);
	});
});
