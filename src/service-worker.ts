/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

import { build, files, version } from '$service-worker';
import {
	SERVICE_WORKER_UPDATE_PROTOCOL_VERSION,
	serviceWorkerUpdateMetadata,
	supportsPendingPaymentSchemas,
	type ServiceWorkerUpdateRequest
} from '$lib/service-worker-protocol';

// NOTE: Keep prefix in sync with config.storagePrefix in src/lib/config.ts
const CACHE_NAME = `bounty-ninja-${version}`;
const APP_SHELL = '/';

// Files to cache (app shell)
const ASSETS = [...build, ...files, APP_SHELL];

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		Promise.all([
			caches
				.keys()
				.then((keys) =>
					Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
				),
			self.clients.claim()
		])
	);
});

self.addEventListener('message', (event) => {
	const message = event.data as ServiceWorkerUpdateRequest | undefined;
	if (message?.type === 'GET_UPDATE_METADATA') {
		event.ports[0]?.postMessage(serviceWorkerUpdateMetadata);
		return;
	}
	if (
		message?.type === 'ACTIVATE_UPDATE' &&
		message.protocolVersion === SERVICE_WORKER_UPDATE_PROTOCOL_VERSION &&
		supportsPendingPaymentSchemas(message.pendingPaymentJournalSchemas, serviceWorkerUpdateMetadata)
	) {
		event.waitUntil(self.skipWaiting());
	}
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);
	if (event.request.mode === 'navigate' && url.origin === self.location.origin) {
		event.respondWith(
			fetch(event.request).catch(async () => {
				const shell = await caches.match(APP_SHELL);
				return shell ?? Response.error();
			})
		);
		return;
	}

	// Don't cache WebSocket or relay connections
	if (url.protocol === 'wss:' || url.protocol === 'ws:') return;

	// Don't cache mint HTTP requests
	if (url.pathname.includes('/v1/') || url.pathname.includes('/mint')) return;

	event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
