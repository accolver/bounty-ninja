import {
	blindMessage,
	createBlindSignature,
	getDecodedToken,
	getEncodedTokenV4,
	hash_e,
	hashToCurve,
	pointFromHex,
	unblindSignature,
	type Proof,
	type Token
} from '@cashu/cashu-ts';
import { sha256 } from '@noble/hashes/sha2.js';
import { finalizeEvent, getPublicKey, type EventTemplate } from 'nostr-tools';

const RELAY_PORT = 10547;
const SECONDARY_RELAY_PORT = 10548;
const MINT_PORT = 3338;
const KEYSET_ID = '0085f77db6604bc0';
const PUBLIC_KEY = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const MINT_PRIVATE_KEY = new Uint8Array(32);
MINT_PRIVATE_KEY[31] = 1;
const SECP256K1_ORDER = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const MINT_URL = `http://localhost:${MINT_PORT}`;

const ROLE_KEYS = {
	creator: new Uint8Array(32).fill(1),
	pledger: new Uint8Array(32).fill(2),
	pledger2: new Uint8Array(32).fill(3),
	solver: new Uint8Array(32).fill(4),
	attacker: new Uint8Array(32).fill(5)
} as const;
type Role = keyof typeof ROLE_KEYS;

interface NostrEvent {
	id: string;
	pubkey: string;
	created_at: number;
	kind: number;
	tags: string[][];
	content: string;
	sig: string;
}

interface Subscription {
	id: string;
	filters: Record<string, unknown>[];
}

const events = new Map<string, NostrEvent>();
const relaySubscriptions = new Set<Map<ServerWebSocket<unknown>, Subscription[]>>();
const proofStates = new Map<string, 'UNSPENT' | 'SPENT' | 'PENDING'>();
let relayReject = false;
let tokenSequence = 0;
let swapCalls = 0;

function corsHeaders(): Record<string, string> {
	return {
		'access-control-allow-origin': '*',
		'access-control-allow-headers': '*',
		'access-control-allow-methods': 'GET, POST, OPTIONS'
	};
}

function json(value: unknown, status = 200): Response {
	return Response.json(value, { status, headers: corsHeaders() });
}

function proofY(secret: string): string {
	return hashToCurve(new TextEncoder().encode(secret)).toHex(true);
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function bytesToBigInt(bytes: Uint8Array): bigint {
	return BigInt(`0x${bytesToHex(bytes)}`);
}

function deterministicDleq(B_: ReturnType<typeof hashToCurve>): { e: string; s: string } {
	// Fixed scalars are safe only in this deterministic test mint; real mints must use fresh randomness.
	const nonce = 3n;
	const mintPublicKey = pointFromHex(PUBLIC_KEY);
	const challenge = hash_e([mintPublicKey.multiply(nonce), B_.multiply(nonce), mintPublicKey, B_]);
	const response = (nonce + bytesToBigInt(challenge)) % SECP256K1_ORDER;
	return { e: bytesToHex(challenge), s: response.toString(16).padStart(64, '0') };
}

function tokenProofYs(token: string): string[] {
	return getDecodedToken(token).proofs.map((proof) => proofY(proof.secret));
}

function role(value: unknown): Role {
	if (typeof value !== 'string' || !(value in ROLE_KEYS)) throw new Error('Unknown fixture role');
	return value as Role;
}

function signFixtureEvent(template: EventTemplate, signerRole: Role): NostrEvent {
	return finalizeEvent(template, ROLE_KEYS[signerRole]) as NostrEvent;
}

function matchesFilter(event: NostrEvent, filter: Record<string, unknown>): boolean {
	if (Array.isArray(filter.ids) && !filter.ids.some((id) => event.id.startsWith(String(id)))) {
		return false;
	}
	if (
		Array.isArray(filter.authors) &&
		!filter.authors.some((author) => event.pubkey.startsWith(String(author)))
	) {
		return false;
	}
	if (Array.isArray(filter.kinds) && !filter.kinds.includes(event.kind)) return false;
	if (typeof filter.since === 'number' && event.created_at < filter.since) return false;
	if (typeof filter.until === 'number' && event.created_at > filter.until) return false;

	for (const [key, values] of Object.entries(filter)) {
		if (!key.startsWith('#') || !Array.isArray(values)) continue;
		const tagName = key.slice(1);
		if (!event.tags.some((tag) => tag[0] === tagName && values.includes(tag[1]))) return false;
	}
	return true;
}

function matchingEvents(filters: Record<string, unknown>[]): NostrEvent[] {
	const limit = filters.reduce<number | undefined>((current, filter) => {
		return typeof filter.limit === 'number'
			? Math.min(current ?? filter.limit, filter.limit)
			: current;
	}, undefined);
	const matches = [...events.values()]
		.filter((event) => filters.some((filter) => matchesFilter(event, filter)))
		.sort((left, right) => right.created_at - left.created_at || left.id.localeCompare(right.id));
	return limit === undefined ? matches : matches.slice(0, limit);
}

function storeEvent(event: NostrEvent): void {
	events.set(event.id, event);
	for (const subscriptions of relaySubscriptions) {
		for (const [subscriber, activeSubscriptions] of subscriptions) {
			for (const subscription of activeSubscriptions) {
				if (subscription.filters.some((filter) => matchesFilter(event, filter))) {
					subscriber.send(JSON.stringify(['EVENT', subscription.id, event]));
				}
			}
		}
	}
}

function reset(): void {
	events.clear();
	proofStates.clear();
	relayReject = false;
	tokenSequence = 0;
	swapCalls = 0;
}

function createRelay(port: number) {
	const subscriptions = new Map<ServerWebSocket<unknown>, Subscription[]>();
	relaySubscriptions.add(subscriptions);
	return Bun.serve({
		port,
		async fetch(request, server) {
			const url = new URL(request.url);
			if (request.method === 'OPTIONS') return json({});
			if (request.method === 'POST' && url.pathname === '/reset') {
				reset();
				return json({ ok: true });
			}
			if (url.pathname === '/health') return json({ ok: true, events: events.size });
			if (url.pathname === '/fixtures/roles') {
				return json(
					Object.fromEntries(
						Object.entries(ROLE_KEYS).map(([name, key]) => [name, getPublicKey(key)])
					)
				);
			}
			if (url.pathname === '/fixtures/events') {
				const kind = url.searchParams.get('kind');
				return json(
					[...events.values()].filter((event) => kind === null || event.kind === Number(kind))
				);
			}
			if (request.method === 'POST' && url.pathname === '/fixtures/sign') {
				const body = (await request.json()) as { role?: unknown; template?: EventTemplate };
				if (!body.template) return json({ error: 'Missing event template' }, 400);
				return json(signFixtureEvent(body.template, role(body.role)));
			}
			if (request.method === 'POST' && url.pathname === '/fixtures/publish') {
				const body = (await request.json()) as { role?: unknown; template?: EventTemplate };
				if (!body.template) return json({ error: 'Missing event template' }, 400);
				const event = signFixtureEvent(body.template, role(body.role));
				storeEvent(event);
				return json(event);
			}
			if (request.method === 'POST' && url.pathname === '/fixtures/relay') {
				const body = (await request.json()) as { reject?: boolean };
				relayReject = body.reject === true;
				return json({ reject: relayReject });
			}
			if (server.upgrade(request)) return undefined;
			return new Response('Local Nostr relay', { status: 200, headers: corsHeaders() });
		},
		websocket: {
			open(socket) {
				subscriptions.set(socket, []);
			},
			message(socket, rawMessage) {
				let message: unknown;
				try {
					message = JSON.parse(String(rawMessage));
				} catch {
					socket.send(JSON.stringify(['NOTICE', 'invalid JSON']));
					return;
				}
				if (!Array.isArray(message) || typeof message[0] !== 'string') return;

				if (message[0] === 'REQ' && typeof message[1] === 'string') {
					const filters = message
						.slice(2)
						.filter(
							(filter): filter is Record<string, unknown> =>
								typeof filter === 'object' && filter !== null && !Array.isArray(filter)
						);
					const current = subscriptions.get(socket) ?? [];
					subscriptions.set(socket, [
						...current.filter((subscription) => subscription.id !== message[1]),
						{ id: message[1], filters }
					]);
					for (const event of matchingEvents(filters)) {
						socket.send(JSON.stringify(['EVENT', message[1], event]));
					}
					socket.send(JSON.stringify(['EOSE', message[1]]));
					return;
				}

				if (message[0] === 'CLOSE' && typeof message[1] === 'string') {
					subscriptions.set(
						socket,
						(subscriptions.get(socket) ?? []).filter(
							(subscription) => subscription.id !== message[1]
						)
					);
					return;
				}

				if (message[0] === 'EVENT' && typeof message[1] === 'object' && message[1] !== null) {
					const event = message[1] as NostrEvent;
					if (typeof event.id !== 'string') {
						socket.send(JSON.stringify(['OK', '', false, 'invalid event']));
						return;
					}
					if (relayReject) {
						socket.send(
							JSON.stringify(['OK', event.id, false, 'blocked: deterministic rejection'])
						);
						return;
					}
					storeEvent(event);
					socket.send(JSON.stringify(['OK', event.id, true, '']));
				}
			},
			close(socket) {
				subscriptions.delete(socket);
			}
		}
	});
}

const relay = createRelay(RELAY_PORT);
const secondaryRelay = createRelay(SECONDARY_RELAY_PORT);

const mintKeys = Object.fromEntries(
	Array.from({ length: 21 }, (_, index) => [String(2 ** index), PUBLIC_KEY])
);

const mint = Bun.serve({
	port: MINT_PORT,
	async fetch(request) {
		const url = new URL(request.url);
		if (request.method === 'OPTIONS') return json({});
		if (request.method === 'POST' && url.pathname === '/reset') {
			proofStates.clear();
			tokenSequence = 0;
			swapCalls = 0;
			return json({ ok: true });
		}
		if (url.pathname === '/health') return json({ ok: true, keyset: KEYSET_ID });
		if (url.pathname === '/fixtures/stats')
			return json({ swapCalls, proofStates: proofStates.size });
		if (request.method === 'POST' && url.pathname === '/fixtures/token') {
			const body = (await request.json()) as {
				amount?: number;
				paymentPubkey?: string;
				mintUrl?: string;
				state?: 'UNSPENT' | 'SPENT' | 'PENDING';
				secret?: string;
				duplicateProof?: boolean;
			};
			if (!Number.isSafeInteger(body.amount) || (body.amount ?? 0) <= 0) {
				return json({ error: 'Fixture amount must be a positive integer' }, 400);
			}
			if (!body.paymentPubkey || !/^(02|03)[0-9a-f]{64}$/.test(body.paymentPubkey)) {
				return json({ error: 'Fixture payment key must be compressed secp256k1 hex' }, 400);
			}
			try {
				pointFromHex(body.paymentPubkey);
			} catch {
				return json({ error: 'Fixture payment key is not a secp256k1 point' }, 400);
			}
			const nonceSeed = body.secret ?? String(tokenSequence++);
			const denominations: number[] = [];
			for (let remaining = body.amount!, denomination = 1; remaining > 0; denomination *= 2) {
				if (remaining % 2 === 1) denominations.push(denomination);
				remaining = Math.floor(remaining / 2);
			}
			const proofs = denominations.map((amount, index): Proof => {
				const secret = JSON.stringify([
					'P2PK',
					{
						nonce: bytesToHex(sha256(new TextEncoder().encode(`${nonceSeed}:${amount}:${index}`))),
						data: body.paymentPubkey,
						tags: [
							['n_sigs', '1'],
							['sigflag', 'SIG_INPUTS']
						]
					}
				]);
				const { B_, r } = blindMessage(new TextEncoder().encode(secret), 2n);
				const blindSignature = createBlindSignature(B_, MINT_PRIVATE_KEY, amount, KEYSET_ID);
				const dleq = deterministicDleq(B_);
				const C = unblindSignature(blindSignature.C_, r, pointFromHex(PUBLIC_KEY));
				return {
					id: KEYSET_ID,
					amount,
					secret,
					C: C.toHex(true),
					dleq: {
						e: dleq.e,
						s: dleq.s,
						r: r.toString(16).padStart(64, '0')
					}
				};
			});
			const Ys = proofs.map((proof) => proofY(proof.secret));
			for (const Y of Ys) proofStates.set(Y, body.state ?? 'UNSPENT');
			const token = getEncodedTokenV4({
				mint: body.mintUrl ?? MINT_URL,
				proofs: body.duplicateProof ? [...proofs, ...proofs] : proofs,
				unit: 'sat'
			} satisfies Token);
			return json({ token, Y: Ys[0], amount: body.amount, paymentPubkey: body.paymentPubkey });
		}
		if (request.method === 'POST' && url.pathname === '/fixtures/spend') {
			const body = (await request.json()) as { token?: string };
			if (!body.token) return json({ error: 'Missing token' }, 400);
			for (const Y of tokenProofYs(body.token)) proofStates.set(Y, 'SPENT');
			return json({ spent: true });
		}
		if (url.pathname === '/v1/info') {
			return json({
				name: 'Bounty.ninja deterministic test mint',
				pubkey: PUBLIC_KEY,
				version: 'Nutshell/0.0.0-test',
				nuts: {
					4: { methods: [{ method: 'bolt11', unit: 'sat', min_amount: 1 }] },
					5: {},
					11: { supported: true }
				}
			});
		}
		if (url.pathname === '/v1/keysets') {
			return json({ keysets: [{ id: KEYSET_ID, unit: 'sat', active: true, input_fee_ppk: 0 }] });
		}
		if (url.pathname === '/v1/keys' || url.pathname === `/v1/keys/${KEYSET_ID}`) {
			return json({ keysets: [{ id: KEYSET_ID, unit: 'sat', keys: mintKeys }] });
		}
		if (request.method === 'POST' && url.pathname === '/v1/checkstate') {
			const body = (await request.json()) as { Ys?: string[] };
			return json({
				states: (body.Ys ?? []).map((Y) => ({
					Y,
					state: proofStates.get(Y) ?? 'SPENT',
					witness: null
				}))
			});
		}
		if (request.method === 'POST' && url.pathname === '/v1/swap') {
			swapCalls++;
			const body = (await request.json()) as {
				inputs?: Proof[];
				outputs?: { amount: number }[];
			};
			const inputYs = (body.inputs ?? []).map((proof) => proofY(proof.secret));
			if (inputYs.some((Y) => proofStates.get(Y) !== 'UNSPENT')) {
				return json({ detail: 'Token already spent' }, 400);
			}
			for (const Y of inputYs) proofStates.set(Y, 'SPENT');
			return json({
				signatures: (body.outputs ?? []).map((output) => ({
					id: KEYSET_ID,
					amount: output.amount,
					C_: PUBLIC_KEY
				}))
			});
		}
		return json({ detail: `Unhandled deterministic mint endpoint: ${url.pathname}` }, 404);
	}
});

console.log(`E2E relay listening on ${relay.url}`);
console.log(`E2E secondary relay listening on ${secondaryRelay.url}`);
console.log(`E2E mint listening on ${mint.url}`);

function stop(): void {
	relay.stop(true);
	secondaryRelay.stop(true);
	mint.stop(true);
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
