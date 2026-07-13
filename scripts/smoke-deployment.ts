type HeaderSource = Pick<Headers, 'get'>;
import { validateReleaseMetadata, type ReleaseMetadata } from './release-metadata';

export function validateHtmlHeaders(headers: HeaderSource): string[] {
	const errors: string[] = [];
	const csp = headers.get('content-security-policy') ?? '';
	if (!csp.includes("script-src-attr 'none'")) errors.push('CSP must disable script attributes');
	if (headers.get('x-content-type-options') !== 'nosniff') {
		errors.push('X-Content-Type-Options must be nosniff');
	}
	if (headers.get('x-frame-options') !== 'DENY') errors.push('X-Frame-Options must be DENY');
	if (!headers.get('strict-transport-security')?.includes('max-age=31536000')) {
		errors.push('HSTS must be enabled for one year');
	}
	if (!headers.get('cache-control')?.includes('no-cache')) {
		errors.push('HTML must require revalidation');
	}
	return errors;
}

export function validateServiceWorkerHeaders(headers: HeaderSource): string[] {
	const errors: string[] = [];
	const cacheControl = headers.get('cache-control') ?? '';
	if (!cacheControl.includes('no-store')) errors.push('Service worker must not be cached');
	if (headers.get('service-worker-allowed') !== '/') {
		errors.push('Service worker scope must include the application root');
	}
	return errors;
}

export function validateRelease(release: unknown, expectedCommit: string): ReleaseMetadata {
	validateReleaseMetadata(release);
	if (release.commit !== expectedCommit) {
		throw new Error(`expected release ${expectedCommit}, received ${release.commit}`);
	}
	if (release.paymentWritesEnabled)
		throw new Error('payment writes must remain disabled by default');
	return release;
}

async function fetchWithRetry(url: string, attempts = 5): Promise<Response> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			const response = await fetch(url, { redirect: 'follow' });
			if (response.ok) return response;
			lastError = new Error(`${url} returned HTTP ${response.status}`);
		} catch (error) {
			lastError = error;
		}
		if (attempt < attempts) {
			await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
		}
	}
	throw lastError instanceof Error ? lastError : new Error(`Unable to fetch ${url}`);
}

async function smokeBaseUrl(baseUrl: string, expectedCommit: string): Promise<void> {
	const base = new URL(baseUrl);
	const home = await fetchWithRetry(new URL('/', base).href);
	const html = await home.text();
	const headerErrors = validateHtmlHeaders(home.headers);
	if (!html.includes('Bounty.ninja'))
		headerErrors.push('Home HTML is missing application identity');
	if (headerErrors.length > 0) throw new Error(`${base.origin}: ${headerErrors.join('; ')}`);

	const deepLink = await fetchWithRetry(new URL('/settings?deployment-smoke=1', base).href);
	const deepLinkHtml = await deepLink.text();
	const deepLinkErrors = validateHtmlHeaders(deepLink.headers);
	if (!deepLinkHtml.includes('Bounty.ninja'))
		deepLinkErrors.push('deep link did not serve the SPA');
	if (deepLinkErrors.length > 0) {
		throw new Error(`${base.origin}/settings: ${deepLinkErrors.join('; ')}`);
	}

	const serviceWorker = await fetchWithRetry(new URL('/service-worker.js', base).href);
	const workerErrors = validateServiceWorkerHeaders(serviceWorker.headers);
	if (workerErrors.length > 0) throw new Error(`${base.origin}: ${workerErrors.join('; ')}`);

	const releaseResponse = await fetchWithRetry(new URL('/release.json', base).href);
	const release = validateRelease(await releaseResponse.json(), expectedCommit);
	console.log(`PASS ${base.origin} release=${release.commit}`);
}

export async function main(): Promise<void> {
	const expectedCommit = process.env.EXPECTED_RELEASE_SHA;
	const urls = process.argv.slice(2);
	if (!expectedCommit || !/^[0-9a-f]{40}$/.test(expectedCommit)) {
		throw new Error('EXPECTED_RELEASE_SHA must be a full commit SHA');
	}
	if (urls.length === 0) throw new Error('At least one deployment URL is required');
	for (const url of urls) await smokeBaseUrl(url, expectedCommit);
}

if (import.meta.main) await main();
