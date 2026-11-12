/* Service worker: precaches every file of the build (the list is injected at build time), so the app works offline.
   Navigations fall back to index.html, which is how a single-page app is served from the cache. */
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare global { interface Window { __WB_MANIFEST: { url: string; revision: string | null }[] } }

(self as unknown as { skipWaiting: () => void }).skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));
