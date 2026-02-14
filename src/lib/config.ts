// src/lib/config.ts — Central app configuration
// Change these values to rebrand/reconfigure the entire app.

export const config = {
	// Branding
	app: {
		name: 'bounty.ninja', // Display name (lowercase preferred)
		nameCaps: 'Bounty.ninja', // Title-case variant for page titles
		url: 'https://bounty.ninja',
		tagline: 'Decentralized Bounty Board',
		description:
			'Post tasks, fund with bitcoin, solve for sats. Zero backend. Powered by Nostr + Cashu.',
		logo: '/logo-icon.svg',
		logoLight: '/logo-icon-light.svg',
		favicon: '/favicon.svg'
	},

	// Nostr
	nostr: {
		defaultRelays: [
			'wss://relay.damus.io',
			'wss://nos.lol',
			'wss://relay.primal.net',
			'wss://relay.snort.social',
			'wss://nostr.wine',
			'wss://relay.nostr.net',
			'wss://nostr-pub.wellorder.net',
			'wss://eden.nostr.land'
		],
		searchRelay: 'wss://search.nos.today',
		clientTag: 'bounty.ninja'
	},

	// Payments
	payments: {
		defaultMint: 'https://mint.minibits.cash/Bitcoin',
		minSubmissionFee: 10,
		maxSubmissionFee: 10000,
		currency: 'sats',
		currencyLong: 'satoshis',
		voteQuorumPercent: 66,
		maxDeadlineDays: 365
	},

	// localStorage key prefix (used for settings, cache, theme, etc.)
	storagePrefix: 'bounty.ninja',

	// Theme colors — these are applied via CSS custom properties in app.css
	// Changing them here would require also updating app.css
	// Listed for documentation/reference
	theme: {
		dark: {
			primary: '#6B9E7E',
			secondary: '#C49A3C',
			background: '#141A1D',
			card: '#1B2328',
			foreground: '#C8CED2'
		},
		light: {
			primary: '#3A6B4E',
			secondary: '#8B7530',
			background: '#EDEEE8',
			card: '#E0E2DB',
			foreground: '#1C2520'
		}
	},

	// External links
	links: {
		nostr: 'https://nostr.com',
		nostrGuide: 'https://nostr.how',
		cashu: 'https://cashu.space',
		relayBrowser: 'https://nostr.watch',
		extensions: {
			nos2x: 'https://github.com/nicehash/nos2x',
			alby: 'https://getalby.com'
		}
	},

	// Cache defaults
	cache: {
		maxEvents: 10_000,
		maxAgeDays: 30
	}
} as const;

// Derived helpers
export const storageKey = (key: string) => `${config.storagePrefix}:${key}`;
