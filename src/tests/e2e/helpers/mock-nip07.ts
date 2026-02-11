/**
 * Mock NIP-07 browser extension signer for E2E tests.
 *
 * Inject via page.addInitScript() before navigating.
 * Provides a deterministic test keypair for signing events.
 */
export const MOCK_NIP07_SCRIPT = `
(function() {
	// Deterministic test keypair (DO NOT use in production)
	const TEST_PUBKEY = 'a'.repeat(64);
	const TEST_PRIVKEY = 'b'.repeat(64);

	window.nostr = {
		async getPublicKey() {
			return TEST_PUBKEY;
		},
		async signEvent(event) {
			// Return the event with a mock signature
			return {
				...event,
				pubkey: TEST_PUBKEY,
				id: Array.from(crypto.getRandomValues(new Uint8Array(32)))
					.map(b => b.toString(16).padStart(2, '0')).join(''),
				sig: 'c'.repeat(128)
			};
		},
		nip04: {
			async encrypt(_pubkey, plaintext) {
				return btoa(plaintext);
			},
			async decrypt(_pubkey, ciphertext) {
				return atob(ciphertext);
			}
		}
	};
})();
`;

export const TEST_PUBKEY = 'a'.repeat(64);
