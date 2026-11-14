/* =========================================================
   WELCOME  (startup/welcome.html)

   Someone who already finished setup taps "Start free" on the
   landing page again → no welcome screen, straight to their day.

   New phone? "Already have an account? Sign in":
     account has progress → sync.js brings it down, the page reloads,
                            and the check below sends them to Today.
     account is empty     → they stay here, signed in, and set up as normal
                            (every save from now on goes to the account).

   1. Already set up?   2. Elements   3. Sign in   4. Events
   ========================================================= */


/* ---------- 1. Already set up? ---------- */

if (isOnboardingComplete()) {
    window.location.replace("../app/today.html");
}


/* ---------- 2. Elements ---------- */

const welcomeSignIn = document.getElementById("welcomeSignIn");
const welcomeSignInNote = document.getElementById("welcomeSignInNote");


/* ---------- 3. Sign in ---------- */

// A small line under the button ("" = hide it)
function showSignInNote(text) {
    welcomeSignInNote.textContent = text;
    welcomeSignInNote.hidden = !text;
}

// Signed in, but nothing came down (an empty account) → say so, hide the button.
function updateWelcome() {
    const account = getAccount();                        // sync.js
    welcomeSignIn.hidden = Boolean(account);
    if (account) showSignInNote(`Signed in as ${account.email}. No saved progress yet, so let's set you up.`);
}

async function signInFromWelcome() {
    welcomeSignIn.disabled = true;
    showSignInNote("Opening Google…");
    try {
        await startSignIn();                             // sync.js. On our site the page leaves for Google here.
        updateWelcome();                                 // laptop pop-up: still here = the account was empty
    } catch (error) {
        const closedIt = error?.code === "auth/popup-closed-by-user" || error?.code === "auth/cancelled-popup-request";
        showSignInNote(closedIt ? "" : "Couldn't sign in. Check your internet and try again.");
    } finally {
        welcomeSignIn.disabled = false;
    }
}


/* ---------- 4. Events ---------- */

welcomeSignIn.addEventListener("click", signInFromWelcome);
window.addEventListener("growthos:sync", updateWelcome);   // back from Google (our site): sync.js finished