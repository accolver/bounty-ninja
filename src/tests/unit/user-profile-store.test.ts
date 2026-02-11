import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import type { NostrEvent } from 'nostr-tools';

// Mock the profile loader
const mockProfileLoader = vi.fn((_pubkeys: string[]) => ({ unsubscribe: vi.fn() }));
vi.mock('$lib/nostr/loaders/profile-loader', () => ({
	createProfileLoader: (pubkeys: string[]) => mockProfileLoader(pubkeys)
}));

// Control replaceable observable
let mockReplaceable$: BehaviorSubject<NostrEvent | undefined>;
vi.mock('$lib/nostr/event-store', () => ({
	eventStore: {
		replaceable: () => mockReplaceable$
	}
}));

function makeKind0Event(content: Record<string, string>, pubkey = 'abc123'): NostrEvent {
	return {
		id: 'kind0-' + Math.random().toString(36).slice(2),
		pubkey,
		created_at: Math.floor(Date.now() / 1000),
		kind: 0,
		content: JSON.stringify(content),
		tags: [],
		sig: 'sig123'
	};
}

describe('UserProfileStore', () => {
	let UserProfileStoreModule: typeof import('$lib/stores/user-profile.svelte');

	beforeEach(async () => {
		vi.clearAllMocks();
		mockReplaceable$ = new BehaviorSubject<NostrEvent | undefined>(undefined);

		vi.resetModules();
		vi.doMock('$lib/nostr/loaders/profile-loader', () => ({
			createProfileLoader: (pubkeys: string[]) =>
				mockProfileLoader(pubkeys) as { unsubscribe(): void }
		}));
		vi.doMock('$lib/nostr/event-store', () => ({
			eventStore: {
				replaceable: () => mockReplaceable$
			}
		}));

		UserProfileStoreModule = await import('$lib/stores/user-profile.svelte');
	});

	it('exports UserProfileStore class', () => {
		expect(UserProfileStoreModule.UserProfileStore).toBeDefined();
	});

	it('has null defaults before loading', () => {
		const store = new UserProfileStoreModule.UserProfileStore();
		expect(store.name).toBeNull();
		expect(store.displayName).toBeNull();
		expect(store.picture).toBeNull();
		expect(store.nip05).toBeNull();
		expect(store.about).toBeNull();
		expect(store.pubkey).toBeNull();
		expect(store.loading).toBe(false);
		expect(store.error).toBeNull();
	});

	it('displayNameOrFallback returns "Unknown" before load', () => {
		const store = new UserProfileStoreModule.UserProfileStore();
		expect(store.displayNameOrFallback).toBe('Unknown');
	});

	it('loads profile from Kind 0 event', () => {
		const profileEvent = makeKind0Event({
			name: 'alice',
			display_name: 'Alice in Wonderland',
			picture: 'https://example.com/alice.jpg',
			nip05: 'alice@example.com',
			about: 'Down the rabbit hole'
		});
		mockReplaceable$ = new BehaviorSubject<NostrEvent | undefined>(profileEvent);

		// Re-mock with the updated subject
		vi.doMock('$lib/nostr/event-store', () => ({
			eventStore: {
				replaceable: () => mockReplaceable$
			}
		}));

		const store = new UserProfileStoreModule.UserProfileStore();
		store.load('abc123');

		expect(store.pubkey).toBe('abc123');
		expect(store.name).toBe('alice');
		expect(store.displayName).toBe('Alice in Wonderland');
		expect(store.picture).toBe('https://example.com/alice.jpg');
		expect(store.nip05).toBe('alice@example.com');
		expect(store.about).toBe('Down the rabbit hole');
		expect(store.loading).toBe(false);
		expect(store.error).toBeNull();
	});

	it('handles no profile found (undefined event)', () => {
		mockReplaceable$ = new BehaviorSubject<NostrEvent | undefined>(undefined);

		vi.doMock('$lib/nostr/event-store', () => ({
			eventStore: {
				replaceable: () => mockReplaceable$
			}
		}));

		const store = new UserProfileStoreModule.UserProfileStore();
		store.load('abc123');

		expect(store.pubkey).toBe('abc123');
		expect(store.name).toBeNull();
		expect(store.displayName).toBeNull();
		expect(store.loading).toBe(false);
	});

	it('displayNameOrFallback falls back correctly', () => {
		const store = new UserProfileStoreModule.UserProfileStore();

		// Before load — returns "Unknown"
		expect(store.displayNameOrFallback).toBe('Unknown');

		// After load with no Kind 0 — returns truncated pubkey
		store.load('abcdef0123456789');
		expect(store.displayNameOrFallback).toBe('abcdef01...');
	});

	it('displayNameOrFallback prefers displayName over name', () => {
		const profileEvent = makeKind0Event({
			name: 'alice',
			display_name: 'Alice in Wonderland'
		});
		mockReplaceable$ = new BehaviorSubject<NostrEvent | undefined>(profileEvent);

		vi.doMock('$lib/nostr/event-store', () => ({
			eventStore: {
				replaceable: () => mockReplaceable$
			}
		}));

		const store = new UserProfileStoreModule.UserProfileStore();
		store.load('abc123');

		expect(store.displayNameOrFallback).toBe('Alice in Wonderland');
	});

	it('handles malformed JSON content gracefully', () => {
		const badEvent: NostrEvent = {
			id: 'bad-event',
			pubkey: 'abc123',
			created_at: Math.floor(Date.now() / 1000),
			kind: 0,
			content: 'not valid json {{{',
			tags: [],
			sig: 'sig123'
		};
		mockReplaceable$ = new BehaviorSubject<NostrEvent | undefined>(badEvent);

		vi.doMock('$lib/nostr/event-store', () => ({
			eventStore: {
				replaceable: () => mockReplaceable$
			}
		}));

		const store = new UserProfileStoreModule.UserProfileStore();
		store.load('abc123');

		expect(store.name).toBeNull();
		expect(store.displayName).toBeNull();
		expect(store.error).toBe('Invalid profile metadata: malformed JSON');
		expect(store.loading).toBe(false);
	});

	it('updates reactively when new Kind 0 event arrives', () => {
		mockReplaceable$ = new BehaviorSubject<NostrEvent | undefined>(undefined);

		vi.doMock('$lib/nostr/event-store', () => ({
			eventStore: {
				replaceable: () => mockReplaceable$
			}
		}));

		const store = new UserProfileStoreModule.UserProfileStore();
		store.load('abc123');

		// Initially no profile
		expect(store.name).toBeNull();

		// Emit a profile event
		const profileEvent = makeKind0Event({ name: 'bob', display_name: 'Bob Builder' });
		mockReplaceable$.next(profileEvent);

		expect(store.name).toBe('bob');
		expect(store.displayName).toBe('Bob Builder');
	});

	it('starts profile loader for relay fetching', () => {
		const store = new UserProfileStoreModule.UserProfileStore();
		store.load('abc123');

		expect(mockProfileLoader).toHaveBeenCalledWith(['abc123']);
	});

	it('destroy() cleans up subscriptions', () => {
		const mockUnsub = vi.fn();
		mockProfileLoader.mockReturnValue({ unsubscribe: mockUnsub });

		const store = new UserProfileStoreModule.UserProfileStore();
		store.load('abc123');
		store.destroy();

		expect(mockUnsub).toHaveBeenCalled();
	});

	it('load() cleans up previous subscriptions', () => {
		const mockUnsub = vi.fn();
		mockProfileLoader.mockReturnValue({ unsubscribe: mockUnsub });

		const store = new UserProfileStoreModule.UserProfileStore();
		store.load('pubkey1');
		store.load('pubkey2');

		// Previous subscription should have been cleaned up
		expect(mockUnsub).toHaveBeenCalled();
		expect(store.pubkey).toBe('pubkey2');
	});
});
