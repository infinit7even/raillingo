/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const CACHE_NAME = `rf-v${version}`;
const DATA_CACHE = `rf-data-v${version}`;

// Asset statici generati da SvelteKit build + tutti i file in /static (icone, manifest, cards.json)
const PRECACHE_ASSETS = [...build, ...files];

// Rotte applicative ed endpoint critici da pre-caricare esplicitamente per funzionamento 100% offline
const CRITICAL_PATHS = [
	'/',
	'/flashcard',
	'/quiz',
	'/reels',
	'/wiki',
	'/notes',
	'/missions',
	'/privacy',
	'/manifest.webmanifest',
	'/api/cards',
	'/data/cards.json'
];

// ─── INSTALL: pre-cache asset, rotte shell e dati ────────────────────────────
self.addEventListener('install', (event: any) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			const dataCache = await caches.open(DATA_CACHE);

			// Precache di tutti gli asset di build e file statici
			await cache.addAll(PRECACHE_ASSETS);

			// Precache resiliente per le rotte shell e i dati critici
			await Promise.allSettled(
				CRITICAL_PATHS.map(async (path) => {
					try {
						const res = await fetch(path);
						if (res.ok) {
							if (path.startsWith('/api/') || path.endsWith('.json')) {
								await dataCache.put(path, res);
							} else {
								await cache.put(path, res);
							}
						}
					} catch {
						// Ignora errori se offline o in fase di setup iniziale
					}
				})
			);

			// Attiva subito senza attendere la chiusura dei tab
			(self as any).skipWaiting();
		})()
	);
});

// ─── ACTIVATE: pulizia cache obsolete e controllo client ────────────────────
self.addEventListener('activate', (event: any) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys
					.filter((key) => key !== CACHE_NAME && key !== DATA_CACHE)
					.map((key) => caches.delete(key))
			);
			await (self as any).clients.claim();
		})()
	);
});

// ─── FETCH: routing strategie per risorsa ──────────────────────────────────
self.addEventListener('fetch', (event: any) => {
	const { request } = event;

	if (request.method !== 'GET') return;
	const url = new URL(request.url);

	// Ignora richieste verso origini esterne non statiche (Discord OAuth, etc.)
	if (url.origin !== self.location.origin) {
		// Consenti solo caching per Google Fonts o CDN noti se necessario
		if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
			event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
		}
		return;
	}

	// 1. Dati dinamici e database schede/note: Network-First con fallback su DATA_CACHE
	if (
		url.pathname === '/api/cards' ||
		url.pathname.startsWith('/api/notes') ||
		url.pathname === '/api/ignored-cards' ||
		url.pathname === '/data/cards.json' ||
		url.pathname.endsWith('.json')
	) {
		event.respondWith(networkFirst(request, DATA_CACHE));
		return;
	}

	// 2. Altre API: Network-First
	if (url.pathname.startsWith('/api/')) {
		event.respondWith(networkFirst(request, CACHE_NAME));
		return;
	}

	// 3. Immagini, upload utente ed emoji 3D: Cache-First con fallback rete
	if (
		url.pathname.startsWith('/emoji/') ||
		url.pathname.startsWith('/uploads/') ||
		url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg|ico|woff2?|ttf|eot)$/)
	) {
		event.respondWith(cacheFirst(request, CACHE_NAME));
		return;
	}

	// 4. Asset di build versionati (JS, CSS): Cache-First
	if (PRECACHE_ASSETS.includes(url.pathname)) {
		event.respondWith(cacheFirst(request, CACHE_NAME));
		return;
	}

	// 5. Navigazione HTML (SvelteKit routes): Network-First con fallback su cache o App Shell '/'
	event.respondWith(navigationHandler(request));
});

// ─── Strategie di caching ottimizzate ──────────────────────────────────────

/** Cache-First: risponde istantaneamente dalla cache, fallback su rete se assente */
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	if (cached) return cached;

	try {
		const response = await fetch(request);
		if (response.ok) {
			cache.put(request, response.clone());
		}
		return response;
	} catch {
		return new Response('Risorsa non disponibile offline', {
			status: 503,
			headers: { 'Content-Type': 'text/plain; charset=utf-8' }
		});
	}
}

/** Network-First: tenta la rete per dati freschi, ripiega su cache se offline */
async function networkFirst(request: Request, cacheName: string = CACHE_NAME): Promise<Response> {
	const cache = await caches.open(cacheName);
	try {
		const response = await fetch(request);
		if (response.ok) {
			cache.put(request, response.clone());
		}
		return response;
	} catch {
		const cached = await cache.match(request);
		if (cached) return cached;

		// Fallback se è un endpoint JSON
		if (request.headers.get('accept')?.includes('application/json') || request.url.includes('/api/')) {
			return new Response(JSON.stringify({ offline: true, error: 'Offline' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json; charset=utf-8' }
			});
		}

		return new Response('Risorsa offline', { status: 503 });
	}
}

/** Stale-While-Revalidate: risponde subito dalla cache, aggiorna in background */
async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);

	const fetchPromise = fetch(request)
		.then((response) => {
			if (response.ok) cache.put(request, response.clone());
			return response;
		})
		.catch(() => null);

	if (cached) return cached;
	const fresh = await fetchPromise;
	if (fresh) return fresh;

	return new Response('Offline', { status: 503 });
}

/** Gestore Navigazione HTML: garantisce il caricamento offline dell'App Shell */
async function navigationHandler(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE_NAME);

	try {
		// Prova il network prima per ottenere la versione più recente
		const networkResponse = await fetch(request);
		if (networkResponse.ok) {
			cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	} catch {
		// Se offline, cerca la pagina specifica in cache
		const cachedPage = await cache.match(request);
		if (cachedPage) return cachedPage;

		// Se la sotto-pagina specifica non è in cache, restituisci l'App Shell principale '/'
		const appShell = await cache.match('/');
		if (appShell) return appShell;

		// Fallback finale
		return new Response(
			'<!doctype html><html><head><meta charset="utf-8"><title>Raillingo Offline</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:sans-serif;text-align:center;padding:2rem;background:#171f23;color:#fff;"><h1>📡 Modalità Offline</h1><p>Connettiti a internet o apri la Home per continuare a studiare.</p><a href="/" style="color:#1cb0f6;font-weight:bold;">Torna alla Home</a></body></html>',
			{
				status: 200,
				headers: { 'Content-Type': 'text/html; charset=utf-8' }
			}
		);
	}
}
