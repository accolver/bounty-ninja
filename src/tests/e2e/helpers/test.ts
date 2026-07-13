import { expect, test as base } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import type { EventTemplate, NostrEvent } from 'nostr-tools';
import { mockNip07Script, TEST_PUBKEYS, type TestRole } from './mock-nip07';

const RELAY_URL = 'ws://127.0.0.1:10547';
const SECONDARY_RELAY_URL = 'ws://127.0.0.1:10548';
const MINT_FIXTURE_URL = 'http://localhost:3338';
const SETTINGS_KEY = 'bounty.ninja:settings';
const LOCAL_HTTP = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/;
const PUBLIC_WEBSOCKET = /^wss?:\/\/(?!(?:localhost|127\.0\.0\.1)(?::|\/|$))/;
const DEFAULT_MINT_ORIGIN = 'https://mint.minibits.cash';
const DEFAULT_MINT_PATH = '/Bitcoin';
const MINT_URL = `${DEFAULT_MINT_ORIGIN}${DEFAULT_MINT_PATH}`;

export interface FixtureToken {
	token: string;
	Y: string;
	amount: number;
	paymentPubkey: string;
}

export class E2EServices {
	constructor(private readonly request: APIRequestContext) {}

	async publish(role: TestRole, template: EventTemplate): Promise<NostrEvent> {
		const response = await this.request.post(
			`${RELAY_URL.replace('ws:', 'http:')}/fixtures/publish`,
			{
				data: { role, template }
			}
		);
		expect(response.ok()).toBe(true);
		return response.json();
	}

	async events(kind?: number): Promise<NostrEvent[]> {
		const suffix = kind === undefined ? '' : `?kind=${kind}`;
		return this.request
			.get(`${RELAY_URL.replace('ws:', 'http:')}/fixtures/events${suffix}`)
			.then((response) => response.json());
	}

	async token(options: {
		amount: number;
		paymentPubkey: string;
		mintUrl?: string;
		state?: 'UNSPENT' | 'SPENT' | 'PENDING';
		secret?: string;
		duplicateProof?: boolean;
	}): Promise<FixtureToken> {
		const response = await this.request.post(`${MINT_FIXTURE_URL}/fixtures/token`, {
			data: { ...options, mintUrl: options.mintUrl ?? MINT_URL }
		});
		expect(response.ok()).toBe(true);
		return response.json();
	}

	async spend(token: string): Promise<void> {
		const response = await this.request.post(`${MINT_FIXTURE_URL}/fixtures/spend`, {
			data: { token }
		});
		expect(response.ok()).toBe(true);
	}

	async rejectRelay(reject: boolean): Promise<void> {
		const response = await this.request.post(
			`${RELAY_URL.replace('ws:', 'http:')}/fixtures/relay`,
			{
				data: { reject }
			}
		);
		expect(response.ok()).toBe(true);
	}
}

export async function authenticateAs(page: Page, role: TestRole): Promise<void> {
	await page.addInitScript(mockNip07Script(role));
}

export { TEST_PUBKEYS, MINT_FIXTURE_URL, MINT_URL, RELAY_URL };

export const test = base.extend<{ hermeticNetwork: void; services: E2EServices }>({
	hermeticNetwork: [
		async ({ context, page, request }, use) => {
			await request.post(`${RELAY_URL.replace('ws:', 'http:')}/reset`);
			await request.post(`${MINT_FIXTURE_URL}/reset`);
			await page.addInitScript(
				({ key, relays, mint }) => {
					if (!sessionStorage.getItem('bounty.ninja:e2e-initialized')) {
						localStorage.clear();
						sessionStorage.setItem('bounty.ninja:e2e-initialized', 'true');
					}
					localStorage.setItem(key, JSON.stringify({ relays, mint }));
				},
				{ key: SETTINGS_KEY, relays: [RELAY_URL, SECONDARY_RELAY_URL], mint: MINT_URL }
			);
			await context.route('**/*', async (route) => {
				const url = route.request().url();
				const parsed = new URL(url);
				if (
					parsed.origin === DEFAULT_MINT_ORIGIN &&
					parsed.pathname.startsWith(DEFAULT_MINT_PATH)
				) {
					const mintPath = parsed.pathname.slice(DEFAULT_MINT_PATH.length) || '/';
					const response = await route.fetch({
						url: `${MINT_FIXTURE_URL}${mintPath}${parsed.search}`
					});
					await route.fulfill({ response });
					return;
				}
				if (LOCAL_HTTP.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
					await route.continue();
				} else {
					await route.abort('blockedbyclient');
				}
			});
			await page.routeWebSocket(PUBLIC_WEBSOCKET, (webSocket) => webSocket.close());
			await use();
		},
		{ auto: true }
	],
	services: async ({ request }, use) => use(new E2EServices(request))
});

export { expect };
