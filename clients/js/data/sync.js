/* ╔══════════════════════════════════════════════════════════════╗
   ║  SYNC  ·  js/data/sync.js                                    ║
   ║  Keeps the account's copy (Firestore) the same as the        ║
   ║  phone's copy (localStorage).                                ║
   ╚══════════════════════════════════════════════════════════════╝

   The app always reads and writes the PHONE's copy (storage.js).
   This file works in the background: no page needs to know it exists.

   Never signed in on this phone?  → this file does nothing, and
   Firebase is never downloaded.

   The 5 moments
     1. First sign-in, phone has data      → phone's copy goes UP
     2. Sign-in on a new device (empty)    → account's copy comes DOWN
     3. Both have DIFFERENT data           → ask: "which one do you want to keep?"
     4. Every save                         → upload 2 seconds later (many taps = 1 upload)
     5. Offline                            → "pending" stays marked → upload when back online

   Opening a page while signed in:
     account newer → download     phone has a pending change → upload     same → nothing

   Talks to the page with events (like "click", but our own):
     hears     "growthos:saved"     from storage.js: something changed
     announces "growthos:sync"      { status } → Me shows "Synced ✓" / "Offline"…
     announces "growthos:conflict"  { phone, account } → the "which one?" sheet

   For the pages (buttons call these):
     prepareSignIn()       load Firebase early (when the sign-in sheet opens)
     startSignIn()         "Continue with Google"
     keepVersion(which)    answer to the conflict: "phone" or "account"
     signOutAndClear()     sign out + clear this phone
     getAccount()          { name, email, photo, lastSyncedAt, pending } or null
     getSyncStatus()       "off" · "checking" · "saving" · "synced" · "offline" · "error" · "conflict"

   Map
     1. Settings ............... UPLOAD_DELAY_MS, SITE_ROOT
     2. Load Firebase .......... loadCloud, prepareSignIn
     3. Status ................. setStatus, getSyncStatus, getAccount
     4. Small helpers .......... hasRealData, describeCopy
     5. Compare the two copies . checkAccount
     6. Up and down ............ uploadSoon, uploadNow, download
     7. Conflict ............... askWhichVersion, keepVersion
     8. Sign in / out .......... startSignIn, rememberUser, signOutAndClear
     9. Page load .............. startSync
    10. Events ................. saved, online, leaving the page
   ══════════════════════════════════════════════════════════════════ */


/* ════════════════════ 1. SETTINGS ════════════════════ */

const UPLOAD_DELAY_MS = 2000;     // wait this long after a save: 5 quick taps = 1 upload

// The site's main folder, worked out from where THIS file lives (…/js/data/sync.js).
// Works from any page: app/today.html, startup/welcome.html, index.html…
const SITE_ROOT = new URL("../../", document.currentScript.src).href;

let cloud = null;                 // firebase.js, once loaded
let accountReady = null;          // a Promise: finished checking who is signed in
let uploadTimer = null;           // the 2-second wait before an upload
let syncStatus = "off";
let waitingAccountCopy = null;    // the account's copy, while the conflict question is open


/* ════════════════════ 2. LOAD FIREBASE (only when needed) ════════════════════ */

// The first call downloads firebase.js (and Firebase from Google). Later calls reuse it.
async function loadCloud() {
    if (!cloud) cloud = await import("./firebase.js");
    return cloud;
}

// Call when the sign-in sheet OPENS, so Firebase is ready by the time they tap.
// (Browsers block a sign-in pop-up that opens too long after the tap.)
function prepareSignIn() {
    loadCloud().catch(() => {});  // no internet? fine, startSignIn will say so
}


/* ════════════════════ 3. STATUS ════════════════════ */

// Remember the status and tell any page that listens (Me shows it).
function setStatus(status) {
    syncStatus = status;
    window.dispatchEvent(new CustomEvent("growthos:sync", { detail: { status } }));
}

function getSyncStatus() {
    return syncStatus;
}

// Who is signed in on this phone?  → { name, email, photo, lastSyncedAt, pending } or null
function getAccount() {
    const sync = readSyncState();
    if (!sync.uid) return null;
    return {
        name: sync.name || "",
        email: sync.email || "",
        photo: sync.photo || "",
        lastSyncedAt: sync.lastSyncedAt,
        pending: sync.pending
    };
}


/* ════════════════════ 4. SMALL HELPERS ════════════════════ */

// Is there anything worth keeping? Finished setup, or at least one goal.
function hasRealData(data) {
    return Boolean(data && (data.onboarding?.completed || data.goals?.length > 0));
}

// A short summary for the "which one?" question.
//   → { goals: 3, habits: 9, lastUsed: 1731400000000 }
function describeCopy(data) {
    return {
        goals: (data.goals || []).filter(goal => goal.status === "active").length,
        habits: (data.habits || []).filter(habit => !habit.archived).length,
        lastUsed: data.updatedAt || 0
    };
}


/* ════════════════════ 5. COMPARE THE TWO COPIES ════════════════════
   Runs when a page opens (signed in) and right after signing in.
   newHere = true the first time this account is used on this phone. */

async function checkAccount(uid, newHere) {
    setStatus("checking");

    let account;
    try {
        account = await cloud.readAccount(uid);
    } catch {
        setStatus("offline");                   // no internet: try again on "online"
        return;
    }

    const phone = readStorage();
    const phoneHasData = hasRealData(phone);

    // Nothing in the account yet → moment 1: send the phone's copy up
    // (also when a change is waiting, like a name typed during setup)
    if (!account) {
        if (phoneHasData || readSyncState().pending) await uploadNow();
        else markSynced();
        return;
    }

    // First time on this phone
    if (newHere) {
        if (!phoneHasData) return download(account);                          // moment 2
        if ((phone.updatedAt || 0) === account.updatedAt) return markSynced();
        return askWhichVersion(phone, account);                               // moment 3
    }

    // A phone we already know
    if (readSyncState().pending) return uploadNow();                          // moment 5: catch up
    if (account.updatedAt > (phone?.updatedAt || 0)) return download(account); // changed on another device
    markSynced();
}

// Both copies are the same now.
function markSynced() {
    writeSyncState({ ...readSyncState(), pending: false, lastSyncedAt: Date.now() });
    setStatus("synced");
}


/* ════════════════════ 6. UP AND DOWN ════════════════════ */

// After a save: wait 2 seconds, then upload. Another save restarts the wait.
function uploadSoon() {
    if (!readSyncState().uid) return;           // not signed in: nothing to do
    clearTimeout(uploadTimer);
    uploadTimer = setTimeout(uploadNow, UPLOAD_DELAY_MS);
}

// Send the phone's copy to the account now.   → true if it arrived
async function uploadNow() {
    clearTimeout(uploadTimer);
    uploadTimer = null;

    const sync = readSyncState();
    if (!sync.uid) return false;
    if (!navigator.onLine) {
        setStatus("offline");                   // "pending" is still marked: we'll be back
        return false;
    }

    const data = readStorage();
    if (!data) return false;

    setStatus("saving");
    try {
        await accountReady;                     // Firebase must know who we are first
        await cloud.writeAccount(sync.uid, data);
    } catch {
        setStatus(navigator.onLine ? "error" : "offline");
        return false;
    }

    // Saved again WHILE uploading? Then that newer change is still pending.
    const changedMeanwhile = readStorage()?.updatedAt !== data.updatedAt;
    writeSyncState({
        ...readSyncState(),
        pending: changedMeanwhile,
        lastSyncedAt: Date.now()
    });
    setStatus("synced");
    if (changedMeanwhile) uploadSoon();
    return true;
}

// Put the account's copy on this phone, then reload so every page shows it.
function download(account) {
    const phone = readStorage();
    if (hasRealData(phone)) keepSafetyCopy(phone);   // one "undo", like bringing back a backup

    replaceStorage(account.data);                     // keeps the account's time: no ping-pong
    writeSyncState({ ...readSyncState(), pending: false, lastSyncedAt: Date.now() });
    window.location.reload();
}


/* ════════════════════ 7. CONFLICT: "WHICH ONE DO YOU WANT TO KEEP?" ════════════════════ */

// The page (signin.js) shows the question when it hears this event.
function askWhichVersion(phone, account) {
    waitingAccountCopy = account;
    setStatus("conflict");
    window.dispatchEvent(new CustomEvent("growthos:conflict", {
        detail: {
            phone: describeCopy(phone),
            account: describeCopy({ ...account.data, updatedAt: account.updatedAt })
        }
    }));
}

// Their answer: "phone" → phone's copy goes up.  "account" → account's copy comes down.
async function keepVersion(which) {
    if (which === "account" && waitingAccountCopy) {
        download(waitingAccountCopy);
        return;
    }
    waitingAccountCopy = null;
    writeSyncState({ ...readSyncState(), pending: true });
    await uploadNow();
}


/* ════════════════════ 8. SIGN IN / OUT ════════════════════ */

// "Continue with Google" (call it straight from the tap).
//   On our site the page leaves for Google here; startSync finishes it on the way back.
//   On a laptop a pop-up opens and we continue right away.
//   Throws if it fails or they cancel: the button shows a message.
async function startSignIn() {
    await loadCloud();
    writeSyncState({ ...readSyncState(), signingIn: true });
    try {
        const user = await cloud.signIn();
        if (user) await rememberUser(user);     // pop-up: done now
    } finally {
        // Pop-up finished, failed or was closed: no sign-in is in progress any more.
        // (A redirect never gets here: the page has already left for Google.)
        writeSyncState({ ...readSyncState(), signingIn: false });
    }
}

// Signed in: remember who on this phone, then compare the two copies.
async function rememberUser(user) {
    const before = readSyncState();
    const newHere = before.uid !== user.uid;
    writeSyncState({
        ...before,
        uid: user.uid,
        name: user.name,
        email: user.email,
        photo: user.photo,
        signingIn: false
    });
    accountReady = Promise.resolve(user);
    await checkAccount(user.uid, newHere);
}

// Sign out: make sure the last change reached the account, then empty this phone.
//   Throws "not-uploaded" if a change could not be sent (offline): nothing is deleted then.
async function signOutAndClear() {
    if (readSyncState().pending) {
        const arrived = await uploadNow();
        if (!arrived) throw new Error("not-uploaded");
    }
    await loadCloud();
    await cloud.signOutUser();

    clearStorage();
    clearSyncState();
    clearSafetyCopy();
    window.location.href = SITE_ROOT + "index.html";
}


/* ════════════════════ 9. PAGE LOAD ════════════════════ */

async function startSync() {
    const sync = readSyncState();
    if (!sync.uid && !sync.signingIn) return;   // never signed in here: Firebase is never loaded

    try {
        await loadCloud();
    } catch {
        setStatus("offline");                   // couldn't even download Firebase
        return;
    }

    // Coming back from Google's sign-in page?
    if (sync.signingIn) {
        writeSyncState({ ...readSyncState(), signingIn: false });
        try {
            const user = await cloud.finishRedirect();
            if (user) return rememberUser(user);
        } catch {
            setStatus("error");                 // cancelled or failed: stay signed out
            return;
        }
    }

    accountReady = cloud.whenUserKnown();
    const user = await accountReady;

    // Firebase forgot them (signed out on another device, or the sign-in expired).
    // Keep the phone's data; just stop syncing until they sign in again.
    if (!user) {
        writeSyncState({ ...readSyncState(), uid: "" });
        setStatus("off");
        return;
    }

    // A different Google account than last time? Treat it like a new sign-in here.
    if (user.uid !== sync.uid) return rememberUser(user);

    await checkAccount(user.uid, false);
}


/* ════════════════════ 10. EVENTS ════════════════════ */

window.addEventListener("growthos:saved", uploadSoon);          // storage.js: something changed

window.addEventListener("online", () => {                         // internet is back
    const sync = readSyncState();
    if (!sync.uid) return;
    if (sync.pending) uploadNow();
    else if (syncStatus === "offline") startSync();
});

// Leaving the page or switching apps: send a waiting upload NOW.
// (A phone may freeze the page before the 2 seconds are over.)
document.addEventListener("visibilitychange", () => {
    if (document.hidden && uploadTimer) uploadNow();
});

startSync();