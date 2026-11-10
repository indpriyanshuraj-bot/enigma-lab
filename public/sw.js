/* Enigma Lab service worker.
 *
 * Strategy:
 *  - app shell + hashed assets: cache first, because hashed URLs never change;
 *  - navigations: network first, falling back to the cached shell so the
 *    simulator opens on a train with no signal;
 *  - everything else: stale-while-revalidate.
 *
 * The asset list is written by scripts/postbuild.mjs as precache.json, so this
 * file never needs to know the hashed filenames.
 */
const VERSION_URL = './precache.json';
const CACHE_PREFIX = 'enigma-lab-';
let cacheName = `${CACHE_PREFIX}dev`;

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const response = await fetch(VERSION_URL, { cache: 'no-store' });
			const manifest = await response.json();
			cacheName = `${CACHE_PREFIX}${manifest.version}`;
			const cache = await caches.open(cacheName);
			await cache.addAll(manifest.urls);
			await self.skipWaiting();
		})(),
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const names = await caches.keys();
			await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== cacheName).map((name) => caches.delete(name)));
			await self.clients.claim();
		})(),
	);
});

self.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	if (request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					const fresh = await fetch(request);
					const cache = await caches.open(cacheName);
					cache.put('./index.html', fresh.clone());
					return fresh;
				} catch {
					const cache = await caches.open(cacheName);
					return (await cache.match('./index.html')) ?? Response.error();
				}
			})(),
		);
		return;
	}

	event.respondWith(
		(async () => {
			const cache = await caches.open(cacheName);
			const cached = await cache.match(request);
			if (cached) {
				// Refresh in the background, but answer instantly.
				event.waitUntil(
					fetch(request)
						.then((fresh) => (fresh.ok ? cache.put(request, fresh.clone()) : undefined))
						.catch(() => undefined),
				);
				return cached;
			}
			try {
				const fresh = await fetch(request);
				if (fresh.ok) cache.put(request, fresh.clone());
				return fresh;
			} catch {
				return Response.error();
			}
		})(),
	);
});
