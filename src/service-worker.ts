/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

import { build, files, version } from '$service-worker';

const CACHE_NAME = `tasks-fyi-${version}`;

// Files to cache (app shell)
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
			)
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Don't cache WebSocket or relay connections
	if (url.protocol === 'wss:' || url.protocol === 'ws:') return;

	// Don't cache mint HTTP requests
	if (url.pathname.includes('/v1/') || url.pathname.includes('/mint')) return;

	event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
