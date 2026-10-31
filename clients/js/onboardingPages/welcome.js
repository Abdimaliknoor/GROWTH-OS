/* =========================================================
   WELCOME  (startup/welcome.html)

   Someone who already finished setup taps "Start free" on the
   landing page again → no welcome screen, straight to their day.
   ========================================================= */

if (isOnboardingComplete()) {
    window.location.replace("../app/today.html");
}