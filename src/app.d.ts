/// <reference types="@sveltejs/kit" />

interface Nip07Nostr {
	getPublicKey(): Promise<string>;
	signEvent(event: object): Promise<object>;
	getRelays?(): Promise<Record<string, { read: boolean; write: boolean }>>;
	nip04?: {
		encrypt(pubkey: string, plaintext: string): Promise<string>;
		decrypt(pubkey: string, ciphertext: string): Promise<string>;
	};
}

declare global {
	interface Window {
		nostr?: Nip07Nostr;
	}

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
