/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const CACHE = `rf-cache-${version}`;

const ASSETS = [
	...build, // gli asset generati dal build di SvelteKit
	...files  // gli asset statici nella cartella static/
];

self.addEventListener('install', (event: any) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event: any) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

self.addEventListener('fetch', (event: any) => {
	if (event.request.method !== 'GET') return;

	async function respond() {
		const url = new URL(event.request.url);
		const cache = await caches.open(CACHE);

		// Servire dalle risorse in cache per file statici e build
		if (ASSETS.includes(url.pathname)) {
			const cachedResponse = await cache.match(url.pathname);
			if (cachedResponse) return cachedResponse;
		}

		// Altrimenti tenta la rete, poi il fallback in cache
		try {
			const response = await fetch(event.request);
			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}
			return response;
		} catch {
			const cachedResponse = await cache.match(event.request);
			if (cachedResponse) return cachedResponse;
			return new Response('Offline', { status: 503, statusText: 'Offline' });
		}
	}

	event.respondWith(respond());
});
