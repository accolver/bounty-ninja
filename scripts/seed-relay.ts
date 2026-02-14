/**
 * Seed a local Nostr relay with representative task data for development.
 *
 * Produces tasks in every lifecycle state (draft, open, in_review, completed,
 * expired, cancelled) with pledges, solutions, votes, and payouts across
 * 6 distinct personas.
 *
 * Usage:
 *   bun run scripts/seed-relay.ts                          # seeds ws://localhost:10547
 *   RELAY=ws://localhost:7777 bun run scripts/seed-relay.ts # custom relay
 *
 * Requires: nostr-tools (installed as project dependency)
 */

import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import { Relay } from 'nostr-tools/relay';
import type { EventTemplate, VerifiedEvent } from 'nostr-tools/pure';

// ─── Config ──────────────────────────────────────────────────────────────────
const RELAY_URL = process.env.RELAY ?? 'ws://localhost:10547';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes;
}

// ─── Deterministic Persona Keys ─────────────────────────────────────────────
// These are throwaway dev keys. NEVER use these on public relays.
interface Persona {
	name: string;
	sec: Uint8Array;
	pub: string;
}

function makePersona(name: string, secHex: string): Persona {
	const sec = hexToBytes(secHex);
	return { name, sec, pub: getPublicKey(sec) };
}

const alice = makePersona(
	'alice',
	'7afec56e1c8ad41ea66a973c60e37bf72ffadaf41baa9f3a59e211a8fc897d8e'
);
const bob = makePersona('bob', '19802eff02b01da5207c9dd6c408bdc4aacd9896a50f79e9ad73b49c92002c30');
const carol = makePersona(
	'carol',
	'19e2db950009767a1cca4afc3210dafa2401ab1a60dd6660274137ecc6aeecc5'
);
const dave = makePersona(
	'dave',
	'574c2fa2aed224a72326c2d297936ba0f8bc56779283842746ac9f00eae1991b'
);
const eve = makePersona('eve', '45f3afe23a9f933bde5c9742bebd01d778e4657bd0adc71d15beaa4999661067');
const frank = makePersona(
	'frank',
	'a29e70552c4ca72473c82be5fdf58e27a4fc67d66ed13bb5a7a914ad96ef09a8'
);

// ─── Timestamps ──────────────────────────────────────────────────────────────
const NOW = Math.floor(Date.now() / 1000);
const HOUR = 3600;
const DAY = 86400;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

const HOUR_AGO = NOW - HOUR;
const DAY_AGO = NOW - DAY;
const THREE_DAYS_AGO = NOW - 3 * DAY;
const WEEK_AGO = NOW - WEEK;
const TWO_WEEKS_AGO = NOW - 2 * WEEK;
const MONTH_AGO = NOW - MONTH;
const TOMORROW = NOW + DAY;
const NEXT_WEEK = NOW + WEEK;
const NEXT_MONTH = NOW + MONTH;
const EXPIRED_DEADLINE = NOW - 3 * DAY;

// ─── Event Kind Constants ────────────────────────────────────────────────────
const BOUNTY_KIND = 37300;
const SOLUTION_KIND = 73001;
const PLEDGE_KIND = 73002;
const VOTE_KIND = 1018;
const PAYOUT_KIND = 73004;
const PROFILE_KIND = 0;
const DELETE_KIND = 5;

// ─── Publishing ──────────────────────────────────────────────────────────────
let relay: Relay;
let publishedCount = 0;

async function publish(
	label: string,
	persona: Persona,
	template: EventTemplate
): Promise<VerifiedEvent> {
	const event = finalizeEvent(template, persona.sec);
	try {
		await relay.publish(event);
		publishedCount++;
		console.log(`  [OK] ${label} (kind ${event.kind}, id: ${event.id.slice(0, 12)}...)`);
	} catch (err) {
		console.error(`  [FAIL] ${label}: ${err instanceof Error ? err.message : err}`);
	}
	return event;
}

// ─── Task Address Helper ─────────────────────────────────────────────────────
function taskAddr(pubkey: string, dTag: string): string {
	return `${BOUNTY_KIND}:${pubkey}:${dTag}`;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
	console.log('=== Bounty.ninja Seed Script ===');
	console.log(`Target relay: ${RELAY_URL}`);
	console.log('');

	relay = await Relay.connect(RELAY_URL);

	// ─── Kind 0: User Profiles ────────────────────────────────────────────────
	console.log('--- Publishing user profiles (Kind 0) ---');

	await publish('Alice profile (bounty creator)', alice, {
		kind: PROFILE_KIND,
		created_at: MONTH_AGO,
		tags: [],
		content: JSON.stringify({
			name: 'alice_dev',
			display_name: 'Alice Developer',
			about: 'Full-stack dev. I post bounties for open source work.',
			picture: 'https://robohash.org/alice.png',
			nip05: 'alice@bounty.ninja'
		})
	});

	await publish('Bob profile (funder/pledger)', bob, {
		kind: PROFILE_KIND,
		created_at: MONTH_AGO,
		tags: [],
		content: JSON.stringify({
			name: 'bob_funds',
			display_name: 'Bob the Funder',
			about: 'Bitcoin maximalist. I fund good ideas with sats.',
			picture: 'https://robohash.org/bob.png',
			nip05: 'bob@bounty.ninja'
		})
	});

	await publish('Carol profile (solver)', carol, {
		kind: PROFILE_KIND,
		created_at: MONTH_AGO,
		tags: [],
		content: JSON.stringify({
			name: 'carol_solves',
			display_name: 'Carol Solutions',
			about: 'Designer & writer. I solve bounties and deliver quality work.',
			picture: 'https://robohash.org/carol.png'
		})
	});

	await publish('Dave profile (funder + voter)', dave, {
		kind: PROFILE_KIND,
		created_at: MONTH_AGO,
		tags: [],
		content: JSON.stringify({
			name: 'dave_sats',
			display_name: 'Dave Stacker',
			about: 'Stacking sats and funding freedom tech.',
			picture: 'https://robohash.org/dave.png'
		})
	});

	await publish('Eve profile (solver)', eve, {
		kind: PROFILE_KIND,
		created_at: MONTH_AGO,
		tags: [],
		content: JSON.stringify({
			name: 'eve_hacker',
			display_name: 'Eve the Hacker',
			about: 'Security researcher and Nostr developer.',
			picture: 'https://robohash.org/eve.png'
		})
	});

	await publish('Frank profile (creator + funder)', frank, {
		kind: PROFILE_KIND,
		created_at: MONTH_AGO,
		tags: [],
		content: JSON.stringify({
			name: 'frank_builder',
			display_name: 'Frank Builder',
			about: 'Building decentralized tools. Cashu enthusiast.',
			picture: 'https://robohash.org/frank.png'
		})
	});

	console.log('');

	// ═══════════════════════════════════════════════════════════════════════════
	// TASK 1: COMPLETED (full lifecycle — pledges, solution, votes, payout)
	// Creator: Alice | Funders: Bob, Dave | Solver: Carol | Voters: Bob, Dave
	// ═══════════════════════════════════════════════════════════════════════════
	console.log('--- Task 1: COMPLETED lifecycle ---');

	const B1_D = 'task-lightning-wallet';
	const B1_ADDR = taskAddr(alice.pub, B1_D);

	await publish('Task 1 (Kind 37300) - Lightning wallet integration', alice, {
		kind: BOUNTY_KIND,
		created_at: TWO_WEEKS_AGO,
		tags: [
			['d', B1_D],
			['title', 'Lightning Wallet Integration for Svelte 5'],
			['reward', '100000', 'sat'],
			['t', 'development'],
			['t', 'lightning'],
			['t', 'svelte'],
			['t', 'typescript'],
			['fee', '21'],
			['client', 'bounty.ninja']
		],
		content: `Build a **Lightning Network wallet integration** for a Svelte 5 web app.

## Requirements

| Feature | Details |
|---------|---------|
| Backend connectivity | Connect to **LND** or **CLN** via REST API |
| Balance display | Show channel balances with real-time updates |
| Transaction history | Paginated list with status indicators |
| Payments | Send and receive via \`BOLT11\` invoices |
| Callbacks | Handle payment status webhooks/polling |
| Error handling | Graceful recovery from common failure modes |

## Technical Constraints

- Must use \`@sveltejs/kit\` with Svelte 5 runes (\`$state\`, \`$derived\`, \`$effect\`)
- All components must be fully typed with **TypeScript** (strict mode)
- Target bundle size: \`< 50KB\` gzipped for the component library
- No external CSS frameworks — use Tailwind utility classes only

## Example Usage

\`\`\`svelte
<script lang="ts">
  import { LightningWallet } from '$lib/lightning';

  let balance = $state(0);
</script>

<LightningWallet
  endpoint="https://localhost:8080"
  onPayment={(amt) => balance += amt}
/>
\`\`\`

## Deliverables

1. Working Svelte component library
2. Full TypeScript types (exported via \`index.ts\`)
3. Unit tests (>80% coverage)
4. Usage documentation with code examples

> **Note:** Preference given to solutions that support *both* LND and CLN out of the box.`
	});

	await publish('Pledge from Bob (60k sats)', bob, {
		kind: PLEDGE_KIND,
		created_at: TWO_WEEKS_AGO + HOUR,
		tags: [
			['a', B1_ADDR, RELAY_URL],
			['p', alice.pub],
			['amount', '60000'],
			['cashu', 'cashuBo2Fod...mock_pledge_token_bob_60k'],
			['mint', 'https://mint.minibits.cash/Bitcoin'],
			['client', 'bounty.ninja']
		],
		content: 'Love this idea! Lightning + Svelte is the future.'
	});

	await publish('Pledge from Dave (40k sats)', dave, {
		kind: PLEDGE_KIND,
		created_at: TWO_WEEKS_AGO + 2 * HOUR,
		tags: [
			['a', B1_ADDR, RELAY_URL],
			['p', alice.pub],
			['amount', '40000'],
			['cashu', 'cashuBo2Fod...mock_pledge_token_dave_40k'],
			['mint', 'https://mint.minibits.cash/Bitcoin'],
			['client', 'bounty.ninja']
		],
		content: 'Count me in. Need this for my project too.'
	});

	const b1Sol = await publish('Solution from Carol', carol, {
		kind: SOLUTION_KIND,
		created_at: WEEK_AGO,
		tags: [
			['a', B1_ADDR, RELAY_URL],
			['p', alice.pub],
			['cashu', 'cashuBo2Fod...mock_antispam_carol_21'],
			['r', 'https://github.com/example/lightning-svelte/pull/42'],
			['client', 'bounty.ninja']
		],
		content: `Here is my implementation of the Lightning wallet integration:

## What I built
- \`LightningWallet.svelte\` — Main wallet component with balance display
- \`InvoiceForm.svelte\` — Create and pay BOLT11 invoices
- \`TransactionHistory.svelte\` — Paginated tx list with status indicators
- \`lightning-client.ts\` — TypeScript API client for LND REST

## Key features
- Auto-reconnect on WebSocket disconnect
- Optimistic UI updates for payment sends
- Comprehensive error handling (insufficient balance, route not found, etc.)

## Tests
All 47 unit tests passing. See \`tests/lightning/\` directory.

PR: https://github.com/example/lightning-svelte/pull/42`
	});

	await publish('Vote from Bob (approve)', bob, {
		kind: VOTE_KIND,
		created_at: WEEK_AGO + 12 * HOUR,
		tags: [
			['a', B1_ADDR, RELAY_URL],
			['e', b1Sol.id, RELAY_URL],
			['p', carol.pub],
			['vote', 'approve'],
			['client', 'bounty.ninja']
		],
		content: 'Excellent work. Code quality is high, tests are thorough.'
	});

	await publish('Vote from Dave (approve)', dave, {
		kind: VOTE_KIND,
		created_at: WEEK_AGO + 14 * HOUR,
		tags: [
			['a', B1_ADDR, RELAY_URL],
			['e', b1Sol.id, RELAY_URL],
			['p', carol.pub],
			['vote', 'approve'],
			['client', 'bounty.ninja']
		],
		content: 'Tested it locally, works great. Ship it!'
	});

	await publish('Payout to Carol (100k sats)', alice, {
		kind: PAYOUT_KIND,
		created_at: WEEK_AGO + DAY,
		tags: [
			['a', B1_ADDR, RELAY_URL],
			['e', b1Sol.id, RELAY_URL],
			['p', carol.pub],
			['amount', '100000'],
			['cashu', 'cashuBo2Fod...mock_payout_carol_100k'],
			['client', 'bounty.ninja']
		],
		content: 'Consensus reached. Payout issued to Carol. Great work!'
	});

	console.log('');

	// ═══════════════════════════════════════════════════════════════════════════
	// TASK 2: IN_REVIEW (pledges, 2 solutions, partial voting)
	// Creator: Frank | Funders: Bob, Dave, Alice | Solvers: Eve, Carol
	// ═══════════════════════════════════════════════════════════════════════════
	console.log('--- Task 2: IN_REVIEW (voting in progress) ---');

	const B2_D = 'task-nostr-bot';
	const B2_ADDR = taskAddr(frank.pub, B2_D);

	await publish('Task 2 (Kind 37300) - Nostr moderation bot', frank, {
		kind: BOUNTY_KIND,
		created_at: WEEK_AGO,
		tags: [
			['d', B2_D],
			['title', 'Nostr Spam Detection & Moderation Bot'],
			['reward', '75000', 'sat'],
			['t', 'development'],
			['t', 'nostr'],
			['t', 'moderation'],
			['t', 'bot'],
			['fee', '15'],
			['expiration', String(NEXT_WEEK)],
			['client', 'bounty.ninja']
		],
		content: `Create an automated **Nostr moderation bot** that monitors relay feeds and flags spam in real time.

## Requirements

### Detection Engine
- Monitor a configurable list of relays for new Kind \`1\` and Kind \`30023\` events
- Detect common spam patterns:
  - *Repeated content* (exact and fuzzy duplicate detection)
  - Known spam pubkeys (synced from shared blocklists)
  - URL-only posts with no meaningful text
  - Burst posting (>10 events/minute from a single pubkey)
- Publish **NIP-56** report events for flagged content

### Admin Interface
- Web-based dashboard to review flagged events
- Adjust detection thresholds via UI sliders
- One-click approve/reject with audit log
- Configurable allowlist/blocklist with import/export

> **Important:** The bot should *never* auto-ban. It should only flag content for human review unless explicitly configured otherwise.

## Tech Constraints

\`\`\`toml
# Example config.toml
[relays]
monitor = ["wss://relay.damus.io", "wss://nos.lol"]

[detection]
duplicate_threshold = 0.85
rate_limit_per_minute = 10
enable_ml = false

[logging]
format = "json"
level = "info"
\`\`\`

- Must run as a standalone **Node.js** or **Bun** process
- Use \`nostr-tools\` for relay communication
- Config via **TOML** file (see example above)
- Structured JSON logs with configurable verbosity

---

**Budget:** 75,000 sats for a working prototype with documentation and a sample \`config.toml\`.`
	});

	await publish('Pledge from Bob (30k sats)', bob, {
		kind: PLEDGE_KIND,
		created_at: WEEK_AGO + HOUR,
		tags: [
			['a', B2_ADDR, RELAY_URL],
			['p', frank.pub],
			['amount', '30000'],
			['cashu', 'cashuBo2Fod...mock_pledge_bob_30k_b2'],
			['mint', 'https://mint.minibits.cash/Bitcoin'],
			['client', 'bounty.ninja']
		],
		content: 'Spam is killing relay operators. Happy to fund this.'
	});

	await publish('Pledge from Dave (25k sats)', dave, {
		kind: PLEDGE_KIND,
		created_at: WEEK_AGO + 2 * HOUR,
		tags: [
			['a', B2_ADDR, RELAY_URL],
			['p', frank.pub],
			['amount', '25000'],
			['cashu', 'cashuBo2Fod...mock_pledge_dave_25k_b2'],
			['mint', 'https://mint.minibits.cash/Bitcoin'],
			['client', 'bounty.ninja']
		],
		content: 'Running a relay, definitely need this.'
	});

	await publish('Pledge from Alice (20k sats)', alice, {
		kind: PLEDGE_KIND,
		created_at: WEEK_AGO + 3 * HOUR,
		tags: [
			['a', B2_ADDR, RELAY_URL],
			['p', frank.pub],
			['amount', '20000'],
			['cashu', 'cashuBo2Fod...mock_pledge_alice_20k_b2'],
			['mint', 'https://mint.minibits.cash/Bitcoin'],
			['client', 'bounty.ninja']
		],
		content: 'Good cause. Adding some sats.'
	});

	const b2Sol1 = await publish('Solution 1 from Eve (ML-based approach)', eve, {
		kind: SOLUTION_KIND,
		created_at: THREE_DAYS_AGO,
		tags: [
			['a', B2_ADDR, RELAY_URL],
			['p', frank.pub],
			['cashu', 'cashuBo2Fod...mock_antispam_eve_15'],
			['r', 'https://github.com/example/nostr-mod-bot'],
			['client', 'bounty.ninja']
		],
		content: `Built a spam detection bot using a hybrid ML + heuristic approach.

## Architecture
- **Classifier**: Naive Bayes model trained on labeled spam/ham dataset from popular relays
- **Heuristics**: Regex patterns for known spam, rate limiting per pubkey
- **Reporting**: Auto-publishes NIP-56 reports with confidence score
- **Dashboard**: Simple web UI for reviewing flags and tuning thresholds

## Performance
- 94% precision, 89% recall on test set
- Processes ~500 events/second on modest hardware
- False positive rate: ~2%

Repo: https://github.com/example/nostr-mod-bot`
	});

	await publish('Solution 2 from Carol (rule-based approach)', carol, {
		kind: SOLUTION_KIND,
		created_at: DAY_AGO,
		tags: [
			['a', B2_ADDR, RELAY_URL],
			['p', frank.pub],
			['cashu', 'cashuBo2Fod...mock_antispam_carol_15'],
			['r', 'https://github.com/example/nostr-sentinel'],
			['client', 'bounty.ninja']
		],
		content: `My approach focuses on simplicity and configurability over ML.

## Design
- **Rule engine**: TOML-configured rules with pattern matching
- **Plugins**: Extensible plugin system for custom detection logic
- **NIP-56 reports**: Standards-compliant reporting
- **Web dashboard**: React admin panel with real-time event stream

## Why rule-based?
ML models need retraining as spam evolves. Rule-based systems let relay operators adapt quickly by editing config files. Included 30+ pre-built rules based on common spam patterns.

Repo: https://github.com/example/nostr-sentinel`
	});

	// Bob votes approve on Eve's solution (partial — not everyone has voted yet)
	await publish('Vote from Bob (approve Eve)', bob, {
		kind: VOTE_KIND,
		created_at: HOUR_AGO,
		tags: [
			['a', B2_ADDR, RELAY_URL],
			['e', b2Sol1.id, RELAY_URL],
			['p', eve.pub],
			['vote', 'approve'],
			['client', 'bounty.ninja']
		],
		content: 'The ML approach is more future-proof. Good precision numbers.'
	});

	console.log('');

	// ═══════════════════════════════════════════════════════════════════════════
	// TASK 3: OPEN (has pledges, no solutions yet)
	// Creator: Alice | Funders: Bob, Frank
	// ═══════════════════════════════════════════════════════════════════════════
	console.log('--- Task 3: OPEN (funded, awaiting solutions) ---');

	const B3_D = 'task-cashu-tutorial';
	const B3_ADDR = taskAddr(alice.pub, B3_D);

	await publish('Task 3 (Kind 37300) - Cashu ecash tutorial', alice, {
		kind: BOUNTY_KIND,
		created_at: THREE_DAYS_AGO,
		tags: [
			['d', B3_D],
			['title', 'Comprehensive Cashu Ecash Tutorial for Bitcoiners'],
			['reward', '30000', 'sat'],
			['t', 'documentation'],
			['t', 'cashu'],
			['t', 'writing'],
			['t', 'education'],
			['fee', '10'],
			['expiration', String(NEXT_WEEK)],
			['mint', 'https://mint.minibits.cash/Bitcoin'],
			['client', 'bounty.ninja']
		],
		content: `Write a comprehensive, **beginner-friendly tutorial** on Cashu ecash for Bitcoin users.

> *"Ecash is the missing privacy layer for everyday Bitcoin payments."*

## Topics to Cover

### Part 1: Foundations
1. **What is ecash?** — History (David Chaum's original vision), why it matters for Bitcoin privacy
2. **How Cashu mints work** — Blind signatures, token issuance, and the mint/wallet trust model

### Part 2: Hands-On Guide
3. **Setting up a wallet** — Step-by-step walkthrough for at least one of:
   - [Nutstash](https://nutstash.app) (web)
   - [Minibits](https://www.minibits.cash) (mobile)
   - [eNuts](https://www.enuts.cash) (mobile)
4. **Minting tokens from Lightning** — With screenshots showing the full flow
5. **Sending and receiving ecash** — Including token serialization format

### Part 3: Advanced Topics
6. **P2PK locking** (\`NUT-11\`) — What it is, use cases (escrow, conditional payments)
7. **Security considerations** — Mint trust model, token backup, what happens if a mint disappears

## Format Requirements

| Requirement | Details |
|------------|---------|
| Length | 2,000-4,000 words |
| Diagrams | At least **3** (mint flow, token lifecycle, P2PK lock/unlock) |
| Code examples | Show token format: \`cashuBo2F...\` |
| Publication | Nostr long-form post (**NIP-23**, Kind \`30023\`) |

## Target Audience

Bitcoin users who understand Lightning but have never used ecash. Assume familiarity with:
- \`BOLT11\` invoices
- Basic wallet operations
- The concept of custodial vs. non-custodial

> **Bonus:** Include a "cheat sheet" summary table at the end comparing Cashu to Lightning to on-chain for common payment scenarios.`
	});

	await publish('Pledge from Bob (20k sats)', bob, {
		kind: PLEDGE_KIND,
		created_at: THREE_DAYS_AGO + 2 * HOUR,
		tags: [
			['a', B3_ADDR, RELAY_URL],
			['p', alice.pub],
			['amount', '20000'],
			['cashu', 'cashuBo2Fod...mock_pledge_bob_20k_b3'],
			['mint', 'https://mint.minibits.cash/Bitcoin'],
			['client', 'bounty.ninja']
		],
		content: 'We need more good Cashu educational content!'
	});

	await publish('Pledge from Frank (10k sats)', frank, {
		kind: PLEDGE_KIND,
		created_at: THREE_DAYS_AGO + 4 * HOUR,
		tags: [
			['a', B3_ADDR, RELAY_URL],
			['p', alice.pub],
			['amount', '10000'],
			['cashu', 'cashuBo2Fod...mock_pledge_frank_10k_b3'],
			['mint', 'https://mint.minibits.cash/Bitcoin'],
			['client', 'bounty.ninja']
		],
		content: 'Adding to the pot. Cashu needs better docs.'
	});

	console.log('');

	// ═══════════════════════════════════════════════════════════════════════════
	// TASK 4: OPEN (has pledges, awaiting solutions)
	// Creator: Dave | Funders: Alice, Frank
	// ═══════════════════════════════════════════════════════════════════════════
	console.log('--- Task 4: OPEN (funded, awaiting solutions) ---');

	const B4_D = 'task-relay-dashboard';
	const B4_ADDR = taskAddr(dave.pub, B4_D);

	await publish('Task 4 (Kind 37300) - Nostr relay dashboard', dave, {
		kind: BOUNTY_KIND,
		created_at: DAY_AGO,
		tags: [
			['d', B4_D],
			['title', 'Nostr Relay Operator Dashboard'],
			['reward', '50000', 'sat'],
			['t', 'development'],
			['t', 'design'],
			['t', 'nostr'],
			['t', 'monitoring'],
			['fee', '15'],
			['expiration', String(NEXT_WEEK)],
			['client', 'bounty.ninja']
		],
		content: `Build a **web-based monitoring dashboard** for Nostr relay operators.

## Features

### Real-Time Metrics
- **Event throughput** — Live-updating graph (events/second, events/minute)
- **Connected clients** — WebSocket connection count + bandwidth usage
- **Kind distribution** — Pie/bar chart showing event kinds (Kind \`1\`, \`7\`, \`30023\`, etc.)
- **Storage usage** — Disk space with projected growth rate

### Management Tools
- Blocklist/allowlist management with bulk import (\`.csv\` or \`.json\`)
- Event search with filter builder (by kind, author, time range, content)
- Event inspector — view raw JSON, verify signatures, check referenced events

### Compatibility Matrix

| Relay Implementation | Status API | Management API | Notes |
|---------------------|-----------|---------------|-------|
| **strfry** | \`/stats\` | Custom plugin | Most popular |
| **nostr-rs-relay** | \`/metrics\` | NIP-86 | Prometheus-compatible |
| **khatru** | Varies | Go API | Embedded-friendly |

> The dashboard should auto-detect the relay type and adapt its API calls accordingly.

## Tech Stack

- Static SPA — **no backend** beyond the relay itself
- Framework: Svelte, React, or Vue (your choice)
- Charts: \`chart.js\`, \`d3\`, or equivalent
- Responsive design (must work on mobile for quick relay checks)

## Mockup Expectations

Before writing code, provide a **wireframe** or **Figma mockup** showing:
1. Main dashboard view with all metrics
2. Event search/filter view
3. Blocklist management view

---

*This is a design + development bounty.* We need both the UI design and working code. Partial submissions (design-only or code-only) will be considered at reduced payout.`
	});

	await publish('Pledge from Alice (35k sats)', alice, {
		kind: PLEDGE_KIND,
		created_at: DAY_AGO + HOUR,
		tags: [
			['a', B4_ADDR, RELAY_URL],
			['p', dave.pub],
			['amount', '35000'],
			['cashu', 'cashuBo2Fod...mock_pledge_alice_35k_b4'],
			['mint', 'https://mint.minibits.cash/Bitcoin'],
			['client', 'bounty.ninja']
		],
		content: 'Relay operators really need this. Adding sats.'
	});

	await publish('Pledge from Frank (15k sats)', frank, {
		kind: PLEDGE_KIND,
		created_at: DAY_AGO + 2 * HOUR,
		tags: [
			['a', B4_ADDR, RELAY_URL],
			['p', dave.pub],
			['amount', '15000'],
			['cashu', 'cashuBo2Fod...mock_pledge_frank_15k_b4'],
			['mint', 'https://mint.minibits.cash/Bitcoin'],
			['client', 'bounty.ninja']
		],
		content: 'Running my own relay, would love a dashboard.'
	});

	console.log('');

	// ═══════════════════════════════════════════════════════════════════════════
	// TASK 5: EXPIRED (deadline passed, no payout)
	// Creator: Frank | Funder: Alice | Solver: Eve (but no quorum reached)
	// ═══════════════════════════════════════════════════════════════════════════
	console.log('--- Task 5: EXPIRED ---');

	const B5_D = 'task-nip05-verifier';
	const B5_ADDR = taskAddr(frank.pub, B5_D);

	// Use "expiration" tag so the state machine detects this as expired.
	// Note: some relays (strfry) may reject events with past expiration.
	// For dev seeding this is fine since we control the relay.
	await publish('Task 5 (Kind 37300) - NIP-05 bulk verifier', frank, {
		kind: BOUNTY_KIND,
		created_at: TWO_WEEKS_AGO,
		tags: [
			['d', B5_D],
			['title', 'NIP-05 Bulk Verification Tool'],
			['reward', '20000', 'sat'],
			['t', 'development'],
			['t', 'nostr'],
			['t', 'tooling'],
			['fee', '10'],
			['expiration', String(EXPIRED_DEADLINE)],
			['client', 'bounty.ninja']
		],
		content: `Build a tool that **bulk-verifies NIP-05 identifiers** for a list of Nostr pubkeys.

## How NIP-05 Verification Works

For the unfamiliar: [NIP-05](https://github.com/nostr-protocol/nips/blob/master/05.md) maps human-readable identifiers (like \`alice@bounty.ninja\`) to Nostr pubkeys via a \`/.well-known/nostr.json\` endpoint.

## Input/Output

\`\`\`bash
# CLI usage example
$ nip05-verify --input pubkeys.txt --output results.json --concurrency 20

# Input: one pubkey per line (hex or npub)
npub1abc...
a1b2c3d4e5f6...

# Output: JSON array
[
  { "pubkey": "npub1abc...", "nip05": "alice@example.com", "status": "valid" },
  { "pubkey": "a1b2c3...", "nip05": null, "status": "no_nip05_set" }
]
\`\`\`

## Status Codes

| Status | Meaning |
|--------|---------|
| \`valid\` | NIP-05 resolves and matches the pubkey |
| \`invalid\` | NIP-05 resolves but pubkey doesn't match |
| \`unreachable\` | Domain DNS or HTTP request failed |
| \`no_nip05_set\` | Profile has no \`nip05\` field in Kind \`0\` |
| \`rate_limited\` | Provider returned 429; queued for retry |

## Requirements

- Handle rate limiting gracefully (exponential backoff + per-domain queuing)
- Support configurable concurrency (\`--concurrency N\`, default 10)
- Dual interface: **CLI tool** + **importable TypeScript library**
- Progress bar in CLI mode

## Performance Target

> Must verify **1,000 pubkeys in under 60 seconds** on a standard connection (assuming no rate limiting). Benchmark results should be included in the README.`
	});

	await publish('Pledge from Alice (20k sats)', alice, {
		kind: PLEDGE_KIND,
		created_at: TWO_WEEKS_AGO + HOUR,
		tags: [
			['a', B5_ADDR, RELAY_URL],
			['p', frank.pub],
			['amount', '20000'],
			['cashu', 'cashuBo2Fod...mock_pledge_alice_20k_b5'],
			['mint', 'https://mint.minibits.cash/Bitcoin'],
			['client', 'bounty.ninja']
		],
		content: 'Would be useful for my relay.'
	});

	await publish('Solution from Eve (late/incomplete)', eve, {
		kind: SOLUTION_KIND,
		created_at: WEEK_AGO,
		tags: [
			['a', B5_ADDR, RELAY_URL],
			['p', frank.pub],
			['cashu', 'cashuBo2Fod...mock_antispam_eve_10_b5'],
			['r', 'https://github.com/example/nip05-check'],
			['client', 'bounty.ninja']
		],
		content: `Partial implementation — CLI works for small batches but needs optimization for the 1000-pubkey target. Running into rate limiting issues with popular NIP-05 providers.

WIP repo: https://github.com/example/nip05-check`
	});

	console.log('');

	// ═══════════════════════════════════════════════════════════════════════════
	// TASK 6: CANCELLED (creator published Kind 5 delete)
	// Creator: Bob
	// ═══════════════════════════════════════════════════════════════════════════
	console.log('--- Task 6: CANCELLED ---');

	const B6_D = 'task-ln-tipping';
	const B6_ADDR = taskAddr(bob.pub, B6_D);

	await publish('Task 6 (Kind 37300) - Lightning tipping widget', bob, {
		kind: BOUNTY_KIND,
		created_at: TWO_WEEKS_AGO,
		tags: [
			['d', B6_D],
			['title', 'Embeddable Lightning Tipping Widget'],
			['reward', '35000', 'sat'],
			['t', 'development'],
			['t', 'lightning'],
			['t', 'widget'],
			['fee', '10'],
			['client', 'bounty.ninja']
		],
		content: `Build an **embeddable Lightning tipping widget** that any website can drop in with a single \`<script>\` tag.

## Core Features

- **LNURL-pay** support — Scan QR or click to pay via any Lightning wallet
- **Nostr Zaps** (NIP-57) — One-click zap with configurable default amounts
- **Customizable UI** — Themes, colors, button text, and position
- Responsive: works on desktop *and* mobile
- **No server required** — All communication goes directly to the Lightning/LNURL endpoint

## Integration Example

\`\`\`html
<!-- Drop this anywhere on your site -->
<script
  src="https://cdn.example.com/ln-tip-widget.js"
  data-lnurl="lnurl1dp68gurn8ghj7..."
  data-theme="dark"
  data-amounts="100,1000,5000"
  data-zap-pubkey="npub1..."
></script>
\`\`\`

## Deliverables

1. Minified JS bundle (\`< 30KB\` gzipped)
2. Optional CSS file for custom styling
3. NPM package for framework integration (\`import { TipWidget } from '...\`)
4. Documentation with examples for WordPress, Hugo, and plain HTML

> **Why this matters:** Most existing tipping solutions require a backend or third-party service. This should be *fully client-side* and self-hostable.`
	});

	await publish('Delete/cancel by Bob', bob, {
		kind: DELETE_KIND,
		created_at: WEEK_AGO,
		tags: [['a', B6_ADDR]],
		content: 'Cancelling — found an existing project that does this.'
	});

	console.log('');

	// ═══════════════════════════════════════════════════════════════════════════
	// TASK 7: OPEN (large pot, popular, 4 funders — for "Popular Tasks")
	// Creator: Alice | Funders: Bob, Dave, Frank, Eve
	// ═══════════════════════════════════════════════════════════════════════════
	console.log('--- Task 7: OPEN (popular, large pot) ---');

	const B7_D = 'task-nostr-client-audit';
	const B7_ADDR = taskAddr(alice.pub, B7_D);

	await publish('Task 7 (Kind 37300) - Security audit of Nostr clients', alice, {
		kind: BOUNTY_KIND,
		created_at: THREE_DAYS_AGO,
		tags: [
			['d', B7_D],
			['title', 'Security Audit of Popular Nostr Clients'],
			['reward', '250000', 'sat'],
			['t', 'security'],
			['t', 'audit'],
			['t', 'nostr'],
			['t', 'research'],
			['fee', '50'],
			['expiration', String(NEXT_MONTH)],
			['client', 'bounty.ninja']
		],
		content: `Conduct a **comprehensive security audit** of 3 popular Nostr clients.

> **This is a high-value bounty (250k sats)** aimed at experienced security researchers with a track record of responsible disclosure.

## Audit Scope

### 1. Key Management
- How are private keys stored? (\`localStorage\`, \`IndexedDB\`, Keychain, etc.)
- Is **NIP-07** properly implemented? (Does the app *ever* touch the raw private key?)
- Are there key derivation weaknesses?

### 2. Event Validation
- Are \`schnorr\` signatures verified on *all* incoming events?
- How are malformed events handled? (Missing fields, oversized content, invalid JSON)
- Is there protection against event replay or tag injection?

### 3. XSS & Content Injection
- Is user-generated content (notes, profiles, \`nip05\` fields) properly sanitized?
- Test for Markdown injection, SVG payloads, and \`javascript:\` URIs
- Are images loaded from user-specified URLs? (SSRF risk)

### 4. Network Security
- Are all WebSocket connections over \`wss://\` (TLS)?
- Is there certificate pinning on mobile clients?
- Are relay URLs validated before connection?

### 5. Privacy Analysis
- **IP leaks** — Does the client connect to relays without Tor/proxy option?
- **Timing attacks** — Can relay operators correlate events across pubkeys?
- **Metadata leaks** — User-Agent strings, device fingerprinting, relay selection patterns

## Target Clients

Pick **3** from the following:

| Client | Platform | Open Source |
|--------|----------|-------------|
| Damus | iOS | Yes |
| Primal | Web + Mobile | Partial |
| Amethyst | Android | Yes |
| Snort | Web | Yes |
| Coracle | Web | Yes |
| Nostrudel | Web | Yes |

## Severity Rating Scale

- **Critical** — Remote key extraction, arbitrary code execution
- **High** — XSS, key exposure via side channel, auth bypass
- **Medium** — Privacy leaks, missing validation, insecure defaults
- **Low** — Informational findings, minor UX security issues

## Deliverables

1. **Full report** — PDF/Markdown with findings, severity ratings, and reproduction steps
2. **Responsible disclosure** — Contact affected projects *before* public release (30-day window)
3. **Public summary** — Publishable after disclosure period, suitable for a Nostr long-form post

---

*Prior audit experience and references strongly preferred. Please include links to past work in your solution submission.*`
	});

	await publish('Pledge from Bob (100k sats)', bob, {
		kind: PLEDGE_KIND,
		created_at: THREE_DAYS_AGO + HOUR,
		tags: [
			['a', B7_ADDR, RELAY_URL],
			['p', alice.pub],
			['amount', '100000'],
			['cashu', 'cashuBo2Fod...mock_pledge_bob_100k_b7'],
			['mint', 'https://mint.minibits.cash/Bitcoin'],
			['client', 'bounty.ninja']
		],
		content: 'Security is paramount. Funding this heavily.'
	});

	await publish('Pledge from Dave (75k sats)', dave, {
		kind: PLEDGE_KIND,
		created_at: THREE_DAYS_AGO + 2 * HOUR,
		tags: [
			['a', B7_ADDR, RELAY_URL],
			['p', alice.pub],
			['amount', '75000'],
			['cashu', 'cashuBo2Fod...mock_pledge_dave_75k_b7'],
			['mint', 'https://mint.minibits.cash/Bitcoin'],
			['client', 'bounty.ninja']
		],
		content: 'This needs to happen. Adding 75k.'
	});

	await publish('Pledge from Frank (50k sats)', frank, {
		kind: PLEDGE_KIND,
		created_at: THREE_DAYS_AGO + 3 * HOUR,
		tags: [
			['a', B7_ADDR, RELAY_URL],
			['p', alice.pub],
			['amount', '50000'],
			['cashu', 'cashuBo2Fod...mock_pledge_frank_50k_b7'],
			['mint', 'https://mint.minibits.cash/Bitcoin'],
			['client', 'bounty.ninja']
		],
		content: 'Great initiative. Adding my sats.'
	});

	await publish('Pledge from Eve (25k sats)', eve, {
		kind: PLEDGE_KIND,
		created_at: DAY_AGO,
		tags: [
			['a', B7_ADDR, RELAY_URL],
			['p', alice.pub],
			['amount', '25000'],
			['cashu', 'cashuBo2Fod...mock_pledge_eve_25k_b7'],
			['mint', 'https://mint.minibits.cash/Bitcoin'],
			['client', 'bounty.ninja']
		],
		content: 'As a security researcher myself, I want to see this done well.'
	});

	console.log('');

	// ═══════════════════════════════════════════════════════════════════════════
	// TASK 8: IN_REVIEW (rejected solution + pending second attempt)
	// Creator: Carol | Funders: Bob, Alice | Solvers: Frank (rejected), Eve (pending)
	// ═══════════════════════════════════════════════════════════════════════════
	console.log('--- Task 8: IN_REVIEW (rejected + pending solutions) ---');

	const B8_D = 'task-logo-design';
	const B8_ADDR = taskAddr(carol.pub, B8_D);

	await publish('Task 8 (Kind 37300) - Logo design for Nostr project', carol, {
		kind: BOUNTY_KIND,
		created_at: WEEK_AGO,
		tags: [
			['d', B8_D],
			['title', 'Logo & Brand Identity for Relay Aggregator'],
			['reward', '40000', 'sat'],
			['t', 'design'],
			['t', 'branding'],
			['t', 'nostr'],
			['fee', '10'],
			['expiration', String(NEXT_WEEK)],
			['client', 'bounty.ninja']
		],
		content: `Design a **logo and visual identity** for a new Nostr relay aggregator service called *"Relayscape"*.

## Brand Brief

Relayscape helps users discover, compare, and monitor Nostr relays. Think of it as *"Yelp for relays"* — a place to find the best relays for your use case.

## Deliverables Checklist

- [ ] Primary logo — full color, works from \`16x16\` favicon to billboard
- [ ] Monochrome variant (single color, for dark *and* light backgrounds)
- [ ] Icon-only mark (for app icon, social avatars)
- [ ] SVG format (vector) — **required**, no raster-only submissions
- [ ] Brand color palette (3-5 colors) with hex codes
- [ ] Typography recommendation (heading + body font pairing)
- [ ] 2-page usage guidelines (minimum spacing, do's and don'ts)

## Style Direction

**Do:**
- Minimalist, tech-forward aesthetic
- Evoke *"decentralization"* and *"connectivity"* abstractly
- Creative use of Nostr purple (\`#9B59B6\`) is a bonus
- Consider how the logo looks as a Nostr profile picture

**Don't:**
- Generic globe/network node graphics
- AI-generated art — **hand-crafted designs only**
- Overly complex illustrations that lose detail at small sizes
- Bitcoin/crypto logo clones (no B symbols, no blockchain cubes)

## Inspiration

> For reference, we love the brand identities of: **Linear**, **Raycast**, **Vercel**. Clean, recognizable, modern.

## Submission Format

Please include:
1. \`logo-primary.svg\` and \`logo-mono.svg\`
2. \`brand-colors.md\` with hex + RGB values
3. Mockups showing the logo on a website header, mobile app, and social avatar`
	});

	await publish('Pledge from Bob (25k sats)', bob, {
		kind: PLEDGE_KIND,
		created_at: WEEK_AGO + HOUR,
		tags: [
			['a', B8_ADDR, RELAY_URL],
			['p', carol.pub],
			['amount', '25000'],
			['cashu', 'cashuBo2Fod...mock_pledge_bob_25k_b8'],
			['mint', 'https://mint.minibits.cash/Bitcoin'],
			['client', 'bounty.ninja']
		],
		content: 'Good design matters.'
	});

	await publish('Pledge from Alice (15k sats)', alice, {
		kind: PLEDGE_KIND,
		created_at: WEEK_AGO + 2 * HOUR,
		tags: [
			['a', B8_ADDR, RELAY_URL],
			['p', carol.pub],
			['amount', '15000'],
			['cashu', 'cashuBo2Fod...mock_pledge_alice_15k_b8'],
			['mint', 'https://mint.minibits.cash/Bitcoin'],
			['client', 'bounty.ninja']
		],
		content: 'Throwing some sats at this.'
	});

	const b8Sol1 = await publish('Solution 1 from Frank (rejected)', frank, {
		kind: SOLUTION_KIND,
		created_at: THREE_DAYS_AGO,
		tags: [
			['a', B8_ADDR, RELAY_URL],
			['p', carol.pub],
			['cashu', 'cashuBo2Fod...mock_antispam_frank_10_b8'],
			['r', 'https://figma.com/example/nostr-relay-logo-v1'],
			['client', 'bounty.ninja']
		],
		content: `Here is my logo concept: a stylized "N" made of interconnected nodes.

Mockups: https://figma.com/example/nostr-relay-logo-v1

Includes:
- Primary logo (color + mono)
- Icon variant
- Color palette: Deep purple, electric blue, white
- Font: Inter for headings, system sans-serif for body`
	});

	await publish('Vote from Bob (reject Frank)', bob, {
		kind: VOTE_KIND,
		created_at: DAY_AGO,
		tags: [
			['a', B8_ADDR, RELAY_URL],
			['e', b8Sol1.id, RELAY_URL],
			['p', frank.pub],
			['vote', 'reject'],
			['client', 'bounty.ninja']
		],
		content: 'Too generic. The interconnected nodes concept is overused in crypto branding.'
	});

	await publish('Vote from Alice (reject Frank)', alice, {
		kind: VOTE_KIND,
		created_at: DAY_AGO + HOUR,
		tags: [
			['a', B8_ADDR, RELAY_URL],
			['e', b8Sol1.id, RELAY_URL],
			['p', frank.pub],
			['vote', 'reject'],
			['client', 'bounty.ninja']
		],
		content:
			'Agree with Bob. Need something more original. The spec explicitly said no generic network graphics.'
	});

	await publish('Solution 2 from Eve (pending)', eve, {
		kind: SOLUTION_KIND,
		created_at: HOUR_AGO,
		tags: [
			['a', B8_ADDR, RELAY_URL],
			['p', carol.pub],
			['cashu', 'cashuBo2Fod...mock_antispam_eve_10_b8'],
			['r', 'https://figma.com/example/nostr-relay-logo-v2'],
			['client', 'bounty.ninja']
		],
		content: `Fresh take on the logo — abstract "signal" concept using negative space.

The logo is a stylized relay tower made from the letter shapes in "RELAY", creating a clever wordmark that works as both text and icon.

Mockups: https://figma.com/example/nostr-relay-logo-v2

Deliverables:
- SVG logo (primary, icon, mono)
- Color palette: Nostr purple (#9B59B6), midnight blue, warm white
- Type: Space Grotesk (headings), Inter (body)
- 4-page brand guidelines PDF`
	});

	console.log('');

	// ═══════════════════════════════════════════════════════════════════════════
	// TASK 9: OPEN (fresh, funded, different category)
	// Creator: Eve | Funders: Bob, Dave
	// ═══════════════════════════════════════════════════════════════════════════
	console.log('--- Task 9: OPEN (funded, translation task) ---');

	const B9_D = 'task-nip-translate-es';
	const B9_ADDR = taskAddr(eve.pub, B9_D);

	await publish('Task 9 (Kind 37300) - Translate Nostr docs to Spanish', eve, {
		kind: BOUNTY_KIND,
		created_at: HOUR_AGO,
		tags: [
			['d', B9_D],
			['title', 'Translate Core NIPs to Spanish'],
			['reward', '45000', 'sat'],
			['t', 'translation'],
			['t', 'documentation'],
			['t', 'nostr'],
			['t', 'spanish'],
			['fee', '10'],
			['client', 'bounty.ninja']
		],
		content: `Translate the **core Nostr protocol documentation** into Spanish.

## NIPs to Translate

| NIP | Title | Priority | Est. Words |
|-----|-------|----------|-----------|
| **01** | Basic protocol flow | High | ~2,000 |
| **02** | Follow list | Medium | ~500 |
| **04** | Encrypted DMs (legacy) | Medium | ~800 |
| **05** | DNS-based identifiers | High | ~600 |
| **07** | Browser extension (\`window.nostr\`) | High | ~400 |
| **19** | \`bech32\`-encoded entities | Medium | ~1,200 |
| **25** | Reactions | Low | ~300 |
| **50** | Search | Low | ~600 |

## Translation Guidelines

### Quality Bar
- **Human translation only** — No raw ChatGPT/DeepL output. AI-assisted drafting is fine, but the final product must be reviewed and polished by a native speaker.
- Maintain *all* original formatting: headers, code blocks, links, and tables
- Code examples stay in English (variable names, comments, etc.)

### Terminology

Maintain a glossary with consistent translations. Here are some suggested starting points:

| English | Suggested Spanish | Notes |
|---------|-------------------|-------|
| relay | *relay* (keep as-is) | Well-established in the community |
| event | *evento* | |
| kind | *tipo* (or *kind*) | Discuss in glossary |
| pubkey | *clave publica* | |
| private key | *clave privada* | |
| signature | *firma* | |

> Feel free to propose better translations, but document your reasoning in the glossary.

## Deliverables

1. Translated \`.md\` files matching the original NIP structure
2. \`GLOSARIO.md\` — Full glossary of technical terms with chosen translations
3. PR to \`nostr-protocol/nips\` repo (or a fork we can review)

---

**Partial submissions welcome.** If you can only translate 4-5 of the 8 NIPs, submit what you have and the reward will be split proportionally. Priority NIPs (\`01\`, \`05\`, \`07\`) should be done first.`
	});

	await publish('Pledge from Bob (30k sats)', bob, {
		kind: PLEDGE_KIND,
		created_at: HOUR_AGO + 600,
		tags: [
			['a', B9_ADDR, RELAY_URL],
			['p', eve.pub],
			['amount', '30000'],
			['cashu', 'cashuBo2Fod...mock_pledge_bob_30k_b9'],
			['mint', 'https://mint.minibits.cash/Bitcoin'],
			['client', 'bounty.ninja']
		],
		content: 'Spanish community needs good NIP translations. Funded!'
	});

	await publish('Pledge from Dave (15k sats)', dave, {
		kind: PLEDGE_KIND,
		created_at: HOUR_AGO + 1200,
		tags: [
			['a', B9_ADDR, RELAY_URL],
			['p', eve.pub],
			['amount', '15000'],
			['cashu', 'cashuBo2Fod...mock_pledge_dave_15k_b9'],
			['mint', 'https://mint.minibits.cash/Bitcoin'],
			['client', 'bounty.ninja']
		],
		content: 'Accessibility matters. Adding my sats.'
	});

	console.log('');

	// ═══════════════════════════════════════════════════════════════════════════
	// TASK 10: OPEN (small task, single funder, edge case)
	// Creator: Dave | Funder: Frank
	// ═══════════════════════════════════════════════════════════════════════════
	console.log('--- Task 10: OPEN (small task, single funder) ---');

	const B10_D = 'task-qr-naddr';
	const B10_ADDR = taskAddr(dave.pub, B10_D);

	await publish('Task 10 (Kind 37300) - QR code generator for naddr', dave, {
		kind: BOUNTY_KIND,
		created_at: DAY_AGO,
		tags: [
			['d', B10_D],
			['title', 'Svelte QR Code Component for Nostr Addresses'],
			['reward', '5000', 'sat'],
			['t', 'development'],
			['t', 'svelte'],
			['t', 'component'],
			['fee', '10'],
			['client', 'bounty.ninja']
		],
		content: `**Simple utility bounty** — build a reusable Svelte component that generates QR codes for Nostr \`naddr\` identifiers.

## Component API

\`\`\`svelte
<script lang="ts">
  import { NostrQR } from '$lib/components';
</script>

<!-- Basic usage -->
<NostrQR naddr="naddr1qqxnzd..." />

<!-- With options -->
<NostrQR
  naddr="naddr1qqxnzd..."
  size={256}
  logo="/logo.svg"
  scheme="nostr"
  fgColor="#1a1b26"
  bgColor="#ffffff"
/>
\`\`\`

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| \`naddr\` | \`string\` | *required* | The \`naddr\` bech32 string |
| \`size\` | \`number\` | \`200\` | Width/height in pixels |
| \`logo\` | \`string?\` | \`undefined\` | URL to overlay logo (centered) |
| \`scheme\` | \`'raw' \\| 'nostr'\` | \`'raw'\` | Use \`nostr:\` URI prefix ([NIP-21](https://github.com/nostr-protocol/nips/blob/master/21.md)) |
| \`fgColor\` | \`string\` | \`'#000'\` | Foreground color |
| \`bgColor\` | \`string\` | \`'#fff'\` | Background color |

## Requirements

- Output must be **SVG** (not canvas) for crisp rendering at any size
- Use Svelte 5 runes (\`$props\`, \`$derived\`)
- Zero runtime dependencies beyond the QR encoding library itself
- Include \`aria-label\` for accessibility

> **Bonus sats** if the component also supports \`npub\`, \`note\`, and \`nevent\` identifiers via a generic \`value\` prop as an alternative to \`naddr\`.`
	});

	await publish('Pledge from Frank (5k sats)', frank, {
		kind: PLEDGE_KIND,
		created_at: DAY_AGO + HOUR,
		tags: [
			['a', B10_ADDR, RELAY_URL],
			['p', dave.pub],
			['amount', '5000'],
			['cashu', 'cashuBo2Fod...mock_pledge_frank_5k_b10'],
			['mint', 'https://mint.minibits.cash/Bitcoin'],
			['client', 'bounty.ninja']
		],
		content: 'Quick job, full funding.'
	});

	console.log('');

	// ═══════════════════════════════════════════════════════════════════════════
	// Summary
	// ═══════════════════════════════════════════════════════════════════════════
	relay.close();

	console.log('=== Seeding Complete ===');
	console.log('');
	console.log('Tasks seeded:');
	console.log('  1. Lightning Wallet Integration     [COMPLETED] - 100k sats (paid out)');
	console.log(
		'  2. Nostr Moderation Bot              [IN_REVIEW] - 75k sats (2 solutions, voting active)'
	);
	console.log(
		'  3. Cashu Ecash Tutorial              [OPEN]      - 30k sats (funded, awaiting solutions)'
	);
	console.log(
		'  4. Relay Operator Dashboard          [OPEN]      - 50k sats (funded, awaiting solutions)'
	);
	console.log('  5. NIP-05 Bulk Verifier             [EXPIRED]   - 20k sats (deadline passed)');
	console.log(
		'  6. Lightning Tipping Widget          [CANCELLED] - 35k sats target (creator deleted)'
	);
	console.log(
		'  7. Nostr Client Security Audit       [OPEN]      - 250k sats (popular, 4 funders)'
	);
	console.log(
		'  8. Logo & Brand Design              [IN_REVIEW] - 40k sats (1 rejected + 1 pending solution)'
	);
	console.log(
		'  9. Translate NIPs to Spanish         [OPEN]      - 45k sats (funded, just posted)'
	);
	console.log('  10. QR Code Component               [OPEN]      - 5k sats (small, single funder)');
	console.log('');
	console.log('Personas: Alice, Bob, Carol, Dave, Eve, Frank (6 profiles)');
	console.log(`Total events published: ${publishedCount}`);
	console.log('');
	console.log('Start the dev server: mise run dev');
}

main().catch((err) => {
	console.error('Seed failed:', err);
	process.exit(1);
});
