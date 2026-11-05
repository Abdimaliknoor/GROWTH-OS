/* ╔══════════════════════════════════════════════════════════════╗
   ║  PWA  ·  js/pwa.js                                           ║
   ║  Switches on the service worker (sw.js): offline + install.  ║
   ╚══════════════════════════════════════════════════════════════╝

   USED BY  index.html and every app page (one line each).
   Registering more than once is fine: the browser keeps just one.

   The path comes from this script's own address, so it works from
   index.html (root) and from app/today.html (one folder down).
   ══════════════════════════════════════════════════════════════════ */

if ("serviceWorker" in navigator) {
    const root = new URL("../", document.currentScript.src);   // js/pwa.js → the site root

    // After the page has loaded: the app's own files come first.
    window.addEventListener("load", () => {
        navigator.serviceWorker.register(new URL("sw.js", root)).catch(error => {
            console.warn("Offline mode is off:", error.message);   // the app still works online
        });
    });
}
