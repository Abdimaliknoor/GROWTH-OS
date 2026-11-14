/* ╔══════════════════════════════════════════════════════════════╗
   ║  SERVICE WORKER  ·  sw.js                                    ║
   ║  Lets Growth OS open with no internet, like an installed app.║
   ╚══════════════════════════════════════════════════════════════╝

   WHAT IT IS
     A small script the browser keeps running in the background,
     between the app and the internet. Every file the app asks for
     passes through here first.

   WHY IT LIVES AT THE ROOT (next to index.html)
     A service worker only controls pages in its own folder and below.
     At the root → it covers app/, startup/, everything.

   THE RULE: "network first, saved copy if offline"
     Online  → get the newest file (and keep a copy of it).
     Offline → use the saved copy.
     Slow    → wait 4 seconds, then use the saved copy.
     So a new `firebase deploy` reaches everyone as soon as they're online.

   ✍️ WHEN YOU DEPLOY
     Change CACHE_VERSION ("v1" → "v2"). The browser sees sw.js changed,
     installs the new one, and the old saved copies are thrown away.

   MAP
     1. Settings    version, the app's files, the timeout
     2. Install     save the app's files once
     3. Activate    delete old saved copies
     4. Fetch       network first, saved copy if offline
   ══════════════════════════════════════════════════════════════════ */


/* ═══════════ 1. SETTINGS ═══════════ */

const CACHE_VERSION = "v4";
const CACHE_NAME = `growth-os-${CACHE_VERSION}`;

// The app itself: saved on install, so it opens offline from day one.
// Other pages (onboarding, landing) are saved the first time they're opened.
const APP_FILES = [
    "app/today.html",
    "app/plan.html",
    "app/journal.html",
    "app/note.html",
    "app/progress.html",
    "app/me.html",
    "app/focus.html",

    "css/base.css",
    "css/app/app.css",
    "css/app/today.css",
    "css/app/plan.css",
    "css/app/journal.css",
    "css/app/note.css",
    "css/app/progress.css",
    "css/app/me.css",
    "css/app/focus.css",

    "js/pwa.js",
    "manifest.webmanifest",

    "js/data/storage.js",
    "js/data/state.js",
    "js/data/insight.js",
    "js/data/photos.js",
    "js/data/sync.js",
    "js/app/signin.js",
    "js/app/nav.js",
    "js/app/item-sheet.js",
    "js/app/focus-bar.js",
    "js/app/today.js",
    "js/app/plan.js",
    "js/app/journal.js",
    "js/app/note.js",
    "js/app/progress.js",
    "js/app/me.js",
    "js/app/focus.js",

    "assets/icons/unnamed.png",
    "assets/app-icons/icon-192.png",
];

const NETWORK_TIMEOUT = 4000;   // ms: on slow data, don't make the user wait longer than this


/* ═══════════ 2. INSTALL: save the app's files ═══════════ */

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            // allSettled: one missing file must not stop the others being saved
            // cache: "reload" = download fresh from Firebase, never the phone's old copy
            Promise.allSettled(APP_FILES.map(file => cache.add(new Request(file, { cache: "reload" }))))
        )
    );
    self.skipWaiting();             // use the new version straight away, don't wait for every tab to close
});


/* ═══════════ 3. ACTIVATE: delete old saved copies ═══════════ */

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(
                names
                    .filter(name => name.startsWith("growth-os-") && name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            ))
            .then(() => self.clients.claim())   // take control of pages that are already open
    );
});


/* ═══════════ 4. FETCH: network first, saved copy if offline ═══════════ */

self.addEventListener("fetch", event => {
    const request = event.request;
    if (request.method !== "GET") return;             // only reading is saved, never sending

    const url = new URL(request.url);
    const isOurs = url.origin === self.location.origin;
    const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";

    if (isFont) {
        event.respondWith(savedFirst(request));      // fonts never change: the saved copy is fine
    } else if (isOurs) {
        event.respondWith(networkFirst(request));
    }
    // Anything else (other websites): the browser handles it as normal.
});

// Online → newest file (and save it). Offline or too slow → the saved copy.
async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const response = await withTimeout(fetch(request), NETWORK_TIMEOUT);
        if (response.ok) cache.put(request, response.clone());   // clone: a response can only be read once
        return response;
    } catch {
        // ignoreSearch: "today.html?done=h1" still finds the saved "today.html"
        // ignoreVary:  iPhone Safari is strict about Firebase's "Vary" note and would say
        //              "not found" for a file that IS saved (the unstyled offline page)
        const saved = await cache.match(request, { ignoreSearch: true, ignoreVary: true });
        if (saved) return saved;

        // A page we never saved, while offline → open Today instead of the browser's error page
        if (request.mode === "navigate") {
            const today = await cache.match("app/today.html", { ignoreVary: true });
            if (today) return today;
        }
        return Response.error();
    }
}

// The saved copy if there is one, otherwise download it and save it.
async function savedFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const saved = await cache.match(request, { ignoreVary: true });
    if (saved) return saved;

    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
}

// fetch() can hang for a long time on bad data. This gives up after `ms`.
function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), ms);
        promise.then(
            value => { clearTimeout(timer); resolve(value); },
            error => { clearTimeout(timer); reject(error); }
        );
    });
}