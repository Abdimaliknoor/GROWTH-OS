/* ╔══════════════════════════════════════════════════════════════╗
   ║  SIGN-IN SHEETS  ·  js/app/signin.js                         ║
   ║  "Keep your progress safe" + "Which one do you want to keep?"║
   ╚══════════════════════════════════════════════════════════════╝

   The sheets' HTML is in the page (Today, Me), the look in app.css.
   This file decides WHEN they show and what the buttons do.
   The real work (Google, uploading) is in sync.js.

   When does "Keep your progress safe" show by itself?
     · not signed in · setup finished · the New-here tip already seen
     · the 1st time right away, then again 3 days after "Not now"
     · at most 3 times. After that: only from Me.

   Map
     1. Settings + elements .... PROMPT_MAX, PROMPT_GAP_DAYS, the sheet parts
     2. Small helpers .......... countLabel, describeWhen, signInMessage
     3. When to offer it ....... shouldOfferSignIn
     4. Open / close ........... openSignIn, updateSignInButton, closeSignIn
     5. "Continue with Google" . continueWithGoogle
     6. "Which one?" ........... showConflict, chooseVersion
     7. Events + start
   ══════════════════════════════════════════════════════════════════ */


/* ════════════════════ 1. SETTINGS + ELEMENTS ════════════════════ */

const PROMPT_MAX = 3;                  // show it by itself at most 3 times
const PROMPT_GAP_DAYS = 3;             // after "Not now", wait 3 days
const DAY_MS = 24 * 60 * 60 * 1000;    // one day in milliseconds

const signinSheet = document.getElementById("signinSheet");
const signinGoals = document.getElementById("signinGoals");
const signinHabits = document.getElementById("signinHabits");
const signinStreakItem = document.getElementById("signinStreakItem");
const signinStreak = document.getElementById("signinStreak");
const signinGoogle = document.getElementById("signinGoogle");
const signinGoogleText = document.getElementById("signinGoogleText");
const signinError = document.getElementById("signinError");
const signinLater = document.getElementById("signinLater");

const topbarSignIn = document.getElementById("topbarSignIn");   // the "Sign in" pill (Today)

const conflictSheet = document.getElementById("conflictSheet");
const conflictAccount = document.getElementById("conflictAccount");
const conflictPhone = document.getElementById("conflictPhone");


/* ════════════════════ 2. SMALL HELPERS ════════════════════ */

// 1 → "1 goal"   3 → "3 goals"
function countLabel(count, word) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// A time stamp → "today" · "yesterday" · "8 Nov"
function describeWhen(time) {
    if (!time) return "never";
    const day = new Date(time).toDateString();
    if (day === new Date().toDateString()) return "today";
    if (day === new Date(Date.now() - DAY_MS).toDateString()) return "yesterday";
    return new Date(time).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// Firebase's error → words a person understands ("" = say nothing, they just closed it)
function signInMessage(error) {
    const code = error?.code || "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "";
    if (code === "auth/popup-blocked") return "Your browser blocked the Google window. Allow pop-ups and try again.";
    if (code === "auth/unauthorized-domain") return "Sign-in isn't allowed on this address yet.";
    if (!navigator.onLine || code === "auth/network-request-failed" || error instanceof TypeError) {
        return "No internet. Connect and try again.";      // TypeError = Firebase couldn't even download
    }
    return "Couldn't sign in. Please try again.";
}


/* ════════════════════ 3. WHEN TO OFFER IT ════════════════════ */

function shouldOfferSignIn() {
    if (!signinSheet) return false;                       // this page has no sheet
    if (!document.querySelector('[data-page="today"]')) return false;   // by itself only on Today (Me: their tap)
    if (getAccount()) return false;                       // already signed in
    if (!isOnboardingComplete()) return false;            // still setting up
    if (!hasSeenTip("today")) return false;               // let the New-here tip go first

    const sync = readSyncState();
    const shown = sync.promptShown || 0;
    if (shown >= PROMPT_MAX) return false;                // asked enough: Me only now
    if (shown === 0) return true;                         // first time: right away
    return Date.now() - (sync.promptLastAt || 0) >= PROMPT_GAP_DAYS * DAY_MS;
}


/* ════════════════════ 4. OPEN / CLOSE ════════════════════ */

// Fill in THEIR numbers, then open. Me's "Back up and sync" row calls this too.
function openSignIn() {
    const goals = getActiveGoals().length;
    const habits = getHabits().filter(habit => !habit.archived).length;
    const streak = getStreak();

    signinGoals.textContent = countLabel(goals, "goal");
    signinHabits.textContent = countLabel(habits, "habit");
    signinStreakItem.hidden = streak < 1;                 // no "0-day streak"
    signinStreak.textContent = `${streak}-day streak`;
    signinError.hidden = true;

    prepareSignIn();                                      // sync.js: load Firebase now, before the tap
    signinSheet.showModal();
}

// The "Sign in" pill in the top bar: shown only while signed out.
function updateSignInButton() {
    if (topbarSignIn) topbarSignIn.hidden = Boolean(getAccount());
}

// "Not now" (or Esc): count this time, so it waits 3 days.
function closeSignIn() {
    const sync = readSyncState();
    writeSyncState({ ...sync, promptShown: (sync.promptShown || 0) + 1, promptLastAt: Date.now() });
    signinSheet.close();
}


/* ════════════════════ 5. "CONTINUE WITH GOOGLE" ════════════════════ */

async function continueWithGoogle() {
    signinGoogle.disabled = true;                         // no double taps
    signinGoogleText.textContent = "Opening Google…";
    signinError.hidden = true;

    try {
        await startSignIn();                              // sync.js. On our site the page leaves here.
        signinSheet.close();                              // pop-up (laptop): signed in, done
        if (getAccount()) showToast("Signed in. Your progress is safe ✓", false);
    } catch (error) {
        const message = signInMessage(error);
        signinError.textContent = message;
        signinError.hidden = !message;
    } finally {
        signinGoogle.disabled = false;
        signinGoogleText.textContent = "Continue with Google";
    }
}


/* ════════════════════ 6. "WHICH ONE DO YOU WANT TO KEEP?" ════════════════════ */

// sync.js found two different copies → fill in both, ask.
//   detail = { phone: { goals, habits, lastUsed }, account: { … } }
function showConflict(event) {
    if (!conflictSheet) return;
    const { phone, account } = event.detail;
    const describe = copy => `${countLabel(copy.goals, "goal")} · ${countLabel(copy.habits, "habit")} · used ${describeWhen(copy.lastUsed)}`;

    conflictAccount.textContent = describe(account);
    conflictPhone.textContent = describe(phone);
    if (signinSheet?.open) signinSheet.close();
    conflictSheet.showModal();
}

// Their answer: "account" (comes down, page reloads) or "phone" (goes up).
async function chooseVersion(which) {
    conflictSheet.querySelectorAll("[data-keep]").forEach(button => { button.disabled = true; });
    await keepVersion(which);                             // sync.js
    conflictSheet.close();                                // only "phone" gets here: "account" reloads the page
    showToast("Saved to your account ✓", false);
}


/* ════════════════════ 7. EVENTS + START ════════════════════ */

if (signinSheet) {
    signinGoogle.addEventListener("click", continueWithGoogle);
    signinLater.addEventListener("click", closeSignIn);
    signinSheet.addEventListener("cancel", event => {     // Esc = "Not now"
        event.preventDefault();
        closeSignIn();
    });
}

if (conflictSheet) {
    conflictSheet.addEventListener("click", event => {
        const button = event.target.closest("[data-keep]");
        if (button) chooseVersion(button.dataset.keep);
    });
    conflictSheet.addEventListener("cancel", event => event.preventDefault());   // they must choose
}

window.addEventListener("growthos:conflict", showConflict);  // sync.js asks

if (topbarSignIn) topbarSignIn.addEventListener("click", openSignIn);
window.addEventListener("growthos:sync", updateSignInButton);  // signed in → the pill goes
updateSignInButton();

// Offer it a moment after the page appears (not in their face on load).
if (shouldOfferSignIn()) setTimeout(openSignIn, 800);