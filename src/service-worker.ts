/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const CACHE_NAME = `rf-app-v${version}`;
const DATA_CACHE = `rf-data-v${version}`;

// Asset statici generati da SvelteKit build + tutti i file in /static (icone, manifest, emoji, cards.json)
const PRECACHE_ASSETS = [...build, ...files];

// Rotte principali dell'applicazione da pre-caricare per funzionamento 100% offline
const CRITICAL_ROUTES = [
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

// ─── INSTALL: pre-cache asset statici e rotte applicative ────────────────────
self.addEventListener('install', (event: any) => {
	event.waitUntil(
		(async () => {
			const appCache = await caches.open(CACHE_NAME);
			const dataCache = await caches.open(DATA_CACHE);

			// 1. Precache immediato di tutti gli asset di build (JS, CSS) e statici
			await appCache.addAll(PRECACHE_ASSETS);

			// 2. Precache delle rotte HTML e dati critici
			await Promise.allSettled(
				CRITICAL_ROUTES.map(async (route) => {
					try {
						const res = await fetch(route, { cache: 'no-cache' });
						if (res.ok) {
							if (route.startsWith('/api/') || route.endsWith('.json')) {
								await dataCache.put(route, res.clone());
							} else {
								await appCache.put(route, res.clone());
							}
						}
					} catch {
						// Ignora errori se offline durante l'install iniziale
					}
				})
			);

			// Forza l'attivazione immediata del nuovo Service Worker
			(self as any).skipWaiting();
		})()
	);
});

// ─── ACTIVATE: pulizia cache obsolete e controllo immediato client ───────────
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

// ─── FETCH: strategie intelligenti per risorse offline ────────────────────────
self.addEventListener('fetch', (event: any) => {
	const { request } = event;

	if (request.method !== 'GET') return;
	const url = new URL(request.url);

	// Ignora richieste verso origini esterne non statiche (Discord OAuth, etc.)
	if (url.origin !== self.location.origin) {
		if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
			event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
		}
		return;
	}

	// 1. Gestione navigazione HTML (Document requests per qualsiasi pagina o reload)
	if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
		event.respondWith(handleNavigation(request));
		return;
	}

	// 2. Richieste dati SvelteKit client-side router (`__data.json`)
	if (url.pathname.includes('__data.json')) {
		event.respondWith(handleSvelteKitData(request));
		return;
	}

	// 3. Dati schede e note API (/api/cards, /api/notes, /data/cards.json)
	if (
		url.pathname === '/api/cards' ||
		url.pathname.startsWith('/api/notes') ||
		url.pathname === '/api/ignored-cards' ||
		url.pathname === '/data/cards.json' ||
		url.pathname.endsWith('.json')
	) {
		event.respondWith(handleDataApi(request));
		return;
	}

	// 4. Immagini, upload, emoji 3D e file multimediali: Cache-First con fallback
	if (
		url.pathname.startsWith('/emoji/') ||
		url.pathname.startsWith('/uploads/') ||
		url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg|ico|woff2?|ttf|eot)$/)
	) {
		event.respondWith(cacheFirst(request, CACHE_NAME));
		return;
	}

	// 5. Asset di build versionati (JS, CSS): Cache-First
	if (PRECACHE_ASSETS.includes(url.pathname) || url.pathname.startsWith('/_app/')) {
		event.respondWith(cacheFirst(request, CACHE_NAME));
		return;
	}

	// 6. Altre risorse generiche: Stale-While-Revalidate
	event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
});

// ─── HANDLER SPECIFICI PER GARANTIRE 100% OFFLINE SENZA ERRORI ─────────────────

/**
 * Gestisce la navigazione HTML: se offline, serve sempre la pagina richiesta in cache
 * o la Shell principale '/', permettendo all'app SvelteKit di avviarsi offline.
 */
async function handleNavigation(request: Request): Promise<Response> {
	const appCache = await caches.open(CACHE_NAME);
	const url = new URL(request.url);

	try {
		// Tenta prima il network per avere la versione più recente
		const networkResponse = await fetch(request);
		if (networkResponse.ok) {
			appCache.put(request, networkResponse.clone());
			appCache.put(url.pathname, networkResponse.clone());
		}
		return networkResponse;
	} catch {
		// 1. Cerca per Request esatta
		const cachedByReq = await appCache.match(request);
		if (cachedByReq) return cachedByReq;

		// 2. Cerca per pathname (es. '/notes')
		const cachedByPath = await appCache.match(url.pathname);
		if (cachedByPath) return cachedByPath;

		// 3. Fallback: restituisci la Root App Shell '/' (SvelteKit router farà il routing client-side)
		const appShell = await appCache.match('/');
		if (appShell) return appShell;

		// 4. Ultima spiaggia: restituisci il primo HTML disponibile in cache
		const keys = await appCache.keys();
		for (const key of keys) {
			if (key.url.endsWith('/') || CRITICAL_ROUTES.some((r) => key.url.endsWith(r))) {
				const match = await appCache.match(key);
				if (match) return match;
			}
		}

		return new Response('App Offline', { status: 200, headers: { 'Content-Type': 'text/html' } });
	}
}

/**
 * Gestisce le richieste di dati client-side router di SvelteKit (`__data.json`).
 * Se offline, restituisce dati validi per impedire a SvelteKit di forzare una navigazione browser interrotta.
 */
async function handleSvelteKitData(request: Request): Promise<Response> {
	const dataCache = await caches.open(DATA_CACHE);
	const url = new URL(request.url);

	try {
		const networkResponse = await fetch(request);
		if (networkResponse.ok) {
			dataCache.put(request, networkResponse.clone());
			dataCache.put(url.pathname, networkResponse.clone());
		}
		return networkResponse;
	} catch {
		const cached = (await dataCache.match(request)) || (await dataCache.match(url.pathname));
		if (cached) return cached;

		// Struttura dati SvelteKit valida per non far fallire il router client-side offline
		const svelteKitDataFallback = {
			type: 'data',
			nodes: [
				{ type: 'data', data: [{ user: null, initialCards: [] }] },
				{ type: 'data', data: [{ user: null, initialNotes: [], error: null }] }
			]
		};

		return new Response(JSON.stringify(svelteKitDataFallback), {
			status: 200,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'x-sveltekit-data': 'true'
			}
		});
	}
}

/**
 * Gestisce gli endpoint API (/api/cards, /api/notes, ecc.) con fallback intelligente su dati locali.
 */
async function handleDataApi(request: Request): Promise<Response> {
	const dataCache = await caches.open(DATA_CACHE);
	const url = new URL(request.url);

	try {
		const response = await fetch(request);
		if (response.ok) {
			dataCache.put(request, response.clone());
			dataCache.put(url.pathname, response.clone());
		}
		return response;
	} catch {
		const cached = (await dataCache.match(request)) || (await dataCache.match(url.pathname));
		if (cached) return cached;

		// Fallback specifici in base alla risorsa
		if (url.pathname === '/api/cards' || url.pathname === '/data/cards.json') {
			const staticCards = await dataCache.match('/data/cards.json');
			if (staticCards) return staticCards;
		}

		if (url.pathname.startsWith('/api/notes')) {
			return new Response(JSON.stringify([]), {
				status: 200,
				headers: { 'Content-Type': 'application/json; charset=utf-8' }
			});
		}

		if (url.pathname === '/api/ignored-cards') {
			return new Response(JSON.stringify({ ignoredCardIds: [] }), {
				status: 200,
				headers: { 'Content-Type': 'application/json; charset=utf-8' }
			});
		}

		return new Response(JSON.stringify({ offline: true }), {
			status: 200,
			headers: { 'Content-Type': 'application/json; charset=utf-8' }
		});
	}
}

/** Cache-First: risponde istantaneamente dalla cache, tenta la rete se assente */
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
		return new Response('Asset offline', {
			status: 503,
			headers: { 'Content-Type': 'text/plain; charset=utf-8' }
		});
	}
}

/** Stale-While-Revalidate: risponde subito dalla cache e aggiorna in background */
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

	return new Response('Risorsa non disponibile', { status: 503 });
}
