export type TestRole = 'creator' | 'pledger' | 'pledger2' | 'solver' | 'attacker';

export const TEST_PUBKEYS: Record<TestRole, string> = {
	creator: '1b84c5567b126440995d3ed5aaba0565d71e1834604819ff9c17f5e9d5dd078f',
	pledger: '4d4b6cd1361032ca9bd2aeb9d900aa4d45d9ead80ac9423374c451a7254d0766',
	pledger2: '531fe6068134503d2723133227c867ac8fa6c83c537e9a44c3c5bdbdcb1fe337',
	solver: '462779ad4aad39514614751a71085f2f10e1c7a593e4e030efb5b8721ce55b0b',
	attacker: '62c0a046dacce86ddd0343c6d3c7c79c2208ba0d9c9cf24a6d046d21d21f90f7'
};

/** NIP-07 fixture backed by the local signer service, so every event has a valid signature. */
export function mockNip07Script(role: TestRole = 'creator'): string {
	return `
(function() {
	const role = ${JSON.stringify(role)};
	const pubkey = ${JSON.stringify(TEST_PUBKEYS[role])};
	window.nostr = {
		async getPublicKey() { return pubkey; },
		async signEvent(event) {
			const response = await fetch('http://127.0.0.1:10547/fixtures/sign', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ role, template: event })
			});
			if (!response.ok) throw new Error('Local NIP-07 fixture failed to sign');
			return response.json();
		},
		nip04: {
			async encrypt(_pubkey, plaintext) { return btoa(plaintext); },
			async decrypt(_pubkey, ciphertext) { return atob(ciphertext); }
		}
	};
})();`;
}

export const MOCK_NIP07_SCRIPT = mockNip07Script();
export const TEST_PUBKEY = TEST_PUBKEYS.creator;
