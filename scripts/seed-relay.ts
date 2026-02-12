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
const TASK_KIND = 37300;
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
	return `${TASK_KIND}:${pubkey}:${dTag}`;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
	console.log('=== Tasks.fyi Seed Script ===');
	console.log(`Target relay: ${RELAY_URL}`);
	console.log('');

	relay = await Relay.connect(RELAY_URL);

	// ─── Kind 0: User Profiles ────────────────────────────────────────────────
	console.log('--- Publishing user profiles (Kind 0) ---');

	await publish('Alice profile (task creator)', alice, {
		kind: PROFILE_KIND,
		created_at: MONTH_AGO,
		tags: [],
		content: JSON.stringify({
			name: 'alice_dev',
			display_name: 'Alice Developer',
			about: 'Full-stack dev. I post tasks for open source work.',
			picture: 'https://robohash.org/alice.png',
			nip05: 'alice@tasks.fyi'
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
			nip05: 'bob@tasks.fyi'
		})
	});

	await publish('Carol profile (solver)', carol, {
		kind: PROFILE_KIND,
		created_at: MONTH_AGO,
		tags: [],
		content: JSON.stringify({
			name: 'carol_solves',
			display_name: 'Carol Solutions',
			about: 'Designer & writer. I solve tasks and deliver quality work.',
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
		kind: TASK_KIND,
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
			['client', 'tasks.fyi']
		],
		content: `Build a Lightning Network wallet integration for a Svelte 5 web app. Requirements:

- Connect to LND or CLN via REST API
- Display channel balances and transaction history
- Send and receive payments via BOLT11 invoices
- Handle payment status callbacks
- Include error handling for common failure modes

Deliverables: Working Svelte component library with TypeScript types, unit tests, and usage documentation.`
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
		kind: TASK_KIND,
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
			['client', 'tasks.fyi']
		],
		content: `Create an automated Nostr moderation bot that monitors relay feeds and flags spam.

## Requirements
- Monitor a configurable list of relays for new events
- Detect common spam patterns (repeated content, known spam pubkeys, URL-only posts)
- Publish NIP-56 report events for flagged content
- Admin dashboard to review flagged events and adjust rules
- Configurable allowlist/blocklist
- Rate limiting detection

## Tech constraints
- Must run as a standalone Node.js/Bun process
- Use nostr-tools for relay communication
- Config via TOML file
- Logging via structured JSON logs

Budget: 75,000 sats for a working prototype with documentation.`
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
		kind: TASK_KIND,
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
			['client', 'tasks.fyi']
		],
		content: `Write a comprehensive, beginner-friendly tutorial on Cashu ecash for Bitcoin users.

## Must cover:
1. What is ecash and why it matters for Bitcoin privacy
2. How Cashu mints work (blind signatures, token issuance)
3. Step-by-step: setting up a Cashu wallet (Nutstash, Minibits, or eNuts)
4. Minting tokens from Lightning
5. Sending and receiving ecash tokens
6. P2PK locking (NUT-11) — what it is and why it is useful
7. Security considerations (mint trust, token backup)

## Format
- Long-form article (2000-4000 words)
- Include diagrams or illustrations where helpful
- Publish as a Nostr long-form post (NIP-23, Kind 30023)

## Target audience
Bitcoin users who understand Lightning but have never used ecash.`
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
		kind: TASK_KIND,
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
			['client', 'tasks.fyi']
		],
		content: `Build a web-based dashboard for Nostr relay operators.

## Features needed:
- Real-time event throughput graphs
- Connected client count and bandwidth usage
- Event kind distribution chart
- Storage usage monitoring
- Blocklist/allowlist management UI
- Event search and inspection tool

## Tech stack
- Static SPA (no backend beyond the relay itself)
- Should work with strfry, nostr-rs-relay, and khatru
- Use the relay management API where available

This is a design + development task. Need both the UI design and working code.`
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
		kind: TASK_KIND,
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
			['client', 'tasks.fyi']
		],
		content: `Build a tool that bulk-verifies NIP-05 identifiers for a list of pubkeys.

## Requirements:
- Input: list of pubkeys (hex or npub)
- Output: verification status for each (valid, invalid, unreachable, expired)
- Handle rate limiting gracefully
- Support concurrent verification (configurable parallelism)
- CLI tool + importable library

Should be fast enough to verify 1000 pubkeys in under 60 seconds.`
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
		kind: TASK_KIND,
		created_at: TWO_WEEKS_AGO,
		tags: [
			['d', B6_D],
			['title', 'Embeddable Lightning Tipping Widget'],
			['reward', '35000', 'sat'],
			['t', 'development'],
			['t', 'lightning'],
			['t', 'widget'],
			['fee', '10'],
			['client', 'tasks.fyi']
		],
		content:
			'Build an embeddable Lightning tipping widget for websites. Should support LNURL-pay and zaps.'
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
		kind: TASK_KIND,
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
			['client', 'tasks.fyi']
		],
		content: `Conduct a security audit of 3 popular Nostr clients focusing on:

## Scope
- **Key management**: How are private keys stored? Is NIP-07 properly implemented?
- **Event validation**: Are signatures verified? Are malformed events handled?
- **XSS prevention**: Is user-generated content (notes, profiles) properly sanitized?
- **Network security**: Are WebSocket connections secure? Is there cert pinning?
- **Privacy leaks**: Are there metadata leaks (IP, timing, relay selection)?

## Target clients
Pick 3 from: Damus, Primal, Amethyst, Snort, Coracle, Nostrudel

## Deliverables
- Written report with severity ratings (critical/high/medium/low)
- Responsible disclosure to affected projects
- Public summary (after disclosure period)

This is a high-value task for an experienced security researcher.`
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
		kind: TASK_KIND,
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
			['client', 'tasks.fyi']
		],
		content: `Design a logo and visual identity for a new Nostr relay aggregator service.

## Requirements:
- Clean, modern logo that works at all sizes (favicon to billboard)
- SVG format (vector)
- Color and monochrome variants
- Brand color palette (3-5 colors)
- Typography recommendation
- Usage guidelines document

## Style direction:
- Minimalist, tech-forward
- Should evoke "decentralization" and "connectivity"
- No generic globe/network graphics please
- Bonus points for creative use of the Nostr purple (#9B59B6)

## Not looking for:
- AI-generated art (hand-crafted designs only)
- Overly complex illustrations
- Anything that looks like a Bitcoin/crypto logo clone`
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
		kind: TASK_KIND,
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
			['client', 'tasks.fyi']
		],
		content: `Translate the core Nostr protocol documentation (NIPs 01, 02, 04, 05, 07, 19, 25, 50) into Spanish.

## Requirements:
- Accurate technical translation (not machine-translated)
- Maintain original formatting and code examples
- Native or near-native Spanish proficiency required
- Familiarity with Nostr/Bitcoin technical terminology

## Deliverables:
- Translated markdown files matching the original NIP structure
- Glossary of technical terms with chosen Spanish equivalents
- PR to the nostr-protocol/nips repo (or a fork)

Partial submissions welcome — can split the reward proportionally.`
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
			['client', 'tasks.fyi']
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
			['client', 'tasks.fyi']
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
		kind: TASK_KIND,
		created_at: DAY_AGO,
		tags: [
			['d', B10_D],
			['title', 'Svelte QR Code Component for Nostr Addresses'],
			['reward', '5000', 'sat'],
			['t', 'development'],
			['t', 'svelte'],
			['t', 'component'],
			['fee', '10'],
			['client', 'tasks.fyi']
		],
		content: `Simple utility: generate QR codes for Nostr naddr identifiers. Should be a reusable Svelte component.

Input: naddr string
Output: SVG QR code with optional logo overlay

Bonus: support for NIP-21 \`nostr:\` URI scheme in the QR data.`
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
			['client', 'tasks.fyi']
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
