import { resolve, sep } from 'node:path';

const buildDirectory = resolve('build');
const fallback = Bun.file(resolve(buildDirectory, 'index.html'));
const port = 4188;

function responseFor(file: Bun.BunFile, request: Request, headers?: HeadersInit): Response {
	return new Response(request.method === 'HEAD' ? null : file, { headers });
}

Bun.serve({
	hostname: '127.0.0.1',
	port,
	async fetch(request) {
		if (request.method !== 'GET' && request.method !== 'HEAD') {
			return new Response('Method Not Allowed', { status: 405 });
		}

		const pathname = decodeURIComponent(new URL(request.url).pathname);
		const candidate = resolve(buildDirectory, `.${pathname}`);
		if (candidate.startsWith(`${buildDirectory}${sep}`) && pathname !== '/') {
			const file = Bun.file(candidate);
			if (await file.exists()) {
				const headers =
					pathname === '/service-worker.js' ? { 'Cache-Control': 'no-cache' } : undefined;
				return responseFor(file, request, headers);
			}
		}

		return responseFor(fallback, request, { 'Content-Type': 'text/html; charset=utf-8' });
	}
});

console.log(`E2E production preview listening on http://127.0.0.1:${port}`);
