/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const CACHE_NAME = `rf-v${version}`;
const DATA_CACHE = `rf-data-v${version}`;

// Asset statici da pre-cachare — build output + files statici
const PRECACHE_ASSETS = [...build, ...files];

// Risorse critiche da cachare esplicitamente anche se non nel build
const CRITICAL_PATHS = ['/manifest.webmanifest'];
// ─── INSTALL: pre-cache tutti gli asset e le risorse critiche ──────────────
self.addEventListener('install', (event: any) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			// Cache non-failing: addAll per gli asset del build
			await cache.addAll(PRECACHE_ASSETS);

			// Cache le risorse critiche individualmente per non bloccare il resto
			const dataCache = await caches.open(DATA_CACHE);
			for (const path of CRITICAL_PATHS) {
				try {
					const res = await fetch(path);
					if (res.ok) await dataCache.put(path, res);
				} catch {
					// Silenzioso — verrà ritentato alla prima navigazione online
				}
			}

			// Attivazione immediata senza aspettare tab esistenti
			(self as any).skipWaiting();
		})()
	);
});

// ─── ACTIVATE: pulizia cache vecchie ──────────────────────────────────────
self.addEventListener('activate', (event: any) => {
	event.waitUntil(
		(async () => {
			// Elimina tutte le cache che non corrispondono alla versione attuale
			const keys = await caches.keys();
			await Promise.all(
				keys
					.filter((key) => key !== CACHE_NAME && key !== DATA_CACHE)
					.map((key) => caches.delete(key))
			);
			// Prendi il controllo di tutti i client immediatamente
			await (self as any).clients.claim();
		})()
	);
});

// ─── FETCH: strategia per tipo di risorsa ─────────────────────────────────
self.addEventListener('fetch', (event: any) => {
	const { request } = event;

	// Ignora richieste non-GET e richieste a domini esterni (Discord API, CDN, etc.)
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	// /api/cards e /api/notes (i dati dinamici): Network-First con fallback su DATA_CACHE
	if (url.pathname === '/api/cards' || url.pathname.startsWith('/api/notes')) {
		event.respondWith(networkFirst(request, DATA_CACHE));
		return;
	}

	// Altre API routes: Network-First
	if (url.pathname.startsWith('/api/')) {
		event.respondWith(networkFirst(request, CACHE_NAME));
		return;
	}

	// cards.json e dati statici: Network-First con fallback su DATA_CACHE
	if (url.pathname === '/data/cards.json' || url.pathname.endsWith('.json')) {
		event.respondWith(networkFirst(request, DATA_CACHE));
		return;
	}

	// Immagini ed emoji 3D: Cache-First (cambiano raramente)
	if (
		url.pathname.startsWith('/emoji/') ||
		url.pathname.startsWith('/uploads/') ||
		url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg|ico)$/)
	) {
		event.respondWith(cacheFirst(request, CACHE_NAME));
		return;
	}

	// Build assets (JS, CSS, font): Cache-First (versioned)
	if (PRECACHE_ASSETS.includes(url.pathname)) {
		event.respondWith(cacheFirst(request, CACHE_NAME));
		return;
	}

	// Navigazione (HTML/SvelteKit routes): Network-First con fallback cache
	event.respondWith(networkFirst(request, CACHE_NAME));
});

// ─── Strategie di caching ─────────────────────────────────────────────────

/** Cache-First: usa la cache, fallback rete. Ideale per asset statici versioned */
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	if (cached) return cached;

	try {
		const response = await fetch(request);
		if (response.ok) cache.put(request, response.clone());
		return response;
	} catch {
		return new Response('Risorsa non disponibile offline', { status: 503 });
	}
}

/** Network-First: tenta la rete, fallback cache. Ideale per contenuto dinamico */
async function networkFirst(request: Request, cacheName: string = CACHE_NAME): Promise<Response> {
	const cache = await caches.open(cacheName);
	try {
		const response = await fetch(request);
		if (response.ok) cache.put(request, response.clone());
		return response;
	} catch {
		const cached = await cache.match(request);
		if (cached) return cached;
		// Fallback pagina offline per navigazione HTML
		if (request.headers.get('accept')?.includes('text/html')) {
			const offlineFallback = await cache.match('/');
			if (offlineFallback) return offlineFallback;
		}
		return new Response('Offline — controlla la connessione', {
			status: 503,
			headers: { 'Content-Type': 'text/plain; charset=utf-8' }
		});
	}
}

/** Stale-While-Revalidate: risponde subito dalla cache, aggiorna in background */
async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);

	// Aggiorna la cache in background (fire-and-forget)
	const fetchPromise = fetch(request)
		.then((response) => {
			if (response.ok) cache.put(request, response.clone());
			return response;
		})
		.catch(() => null);

	// Se abbiamo una risposta in cache, usiamola subito
	if (cached) return cached;

	// Altrimenti aspettiamo la rete
	const fresh = await fetchPromise;
	if (fresh) return fresh;

	return new Response('Dati non disponibili offline', { status: 503 });
}
