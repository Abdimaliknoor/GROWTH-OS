/* ╔══════════════════════════════════════════════════════════════╗
   ║  LANDING  ·  js/landing.js                                   ║
   ║  Already using Growth OS on this device? Skip the sales page.║
   ╚══════════════════════════════════════════════════════════════╝

   The site address (your-site.web.app/) always opens index.html.
   New visitor        → sees the landing page.
   Finished setup     → goes straight to Today.
   index.html?home    → the landing page anyway (to read it or share it).

   Loaded in <head>, not at the end of <body>: it must run BEFORE the
   page is drawn, or a returning user sees the landing flash for a moment.
   It never touches the HTML, so it doesn't need the page to exist yet.

   Later, with sign-in: "finished setup" becomes "signed in".
   ══════════════════════════════════════════════════════════════════ */

const wantsLanding = new URLSearchParams(window.location.search).has("home");

if (!wantsLanding && isOnboardingComplete()) {
    window.location.replace("app/today.html");   // replace: Back won't return to the landing
}