/* =========================================================
   ME  (app/me.html)

   You ........... your name (change it), your goal (→ Plan)
   Account ....... "Back up and sync" (signed out)  ·  who, "Synced", Sign out (signed in)
   Backup ........ save a file  ·  bring one back  ·  undo that
   Start over .... reset everything (data AND photos)

   Where the data comes from:
     getName, saveName, getDirection, getActiveGoals         → state.js
     exportData, readBackupFile, restoreData, undoRestore   → state.js (14. Backup)
     cleanUnusedPhotos                                      → photos.js
     getAccount, getSyncStatus, signOutAndClear, uploadNow  → sync.js
     openSignIn                                             → signin.js

   1. Guard   2. Elements   3. Settings   4. Helpers
   5. Renderers   6. Actions   7. Page load   8. Events
   ========================================================= */


/* ---------- 1. Guard ---------- */

const meReady = isOnboardingComplete();
if (!meReady) {
    window.location.replace("../startup/welcome.html");
}


/* ---------- 2. Elements ---------- */

const meAvatar = document.getElementById("meAvatar");
const meName = document.getElementById("meName");
const meArea = document.getElementById("meArea");
const nameRow = document.getElementById("nameRow");
const nameSub = document.getElementById("nameSub");
const goalRowTitle = document.getElementById("goalRowTitle");
const goalSub = document.getElementById("goalSub");

const syncRow = document.getElementById("syncRow");
const accountRow = document.getElementById("accountRow");
const accountPhoto = document.getElementById("accountPhoto");
const accountName = document.getElementById("accountName");
const accountEmail = document.getElementById("accountEmail");
const syncStatusRow = document.getElementById("syncStatusRow");
const syncStatusIcon = document.getElementById("syncStatusIcon");
const syncStatusText = document.getElementById("syncStatusText");
const syncStatusSub = document.getElementById("syncStatusSub");
const signOutRow = document.getElementById("signOutRow");

const backupNote = document.getElementById("backupNote");
const saveBackup = document.getElementById("saveBackup");
const backupInput = document.getElementById("backupInput");
const undoRestoreRow = document.getElementById("undoRestoreRow");
const resetRow = document.getElementById("resetRow");
const resetSub = document.getElementById("resetSub");

const nameSheet = document.getElementById("nameSheet");
const nameInput = document.getElementById("nameInput");
const nameCancel = document.getElementById("nameCancel");
const nameSave = document.getElementById("nameSave");

const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");


/* ---------- 3. Settings ---------- */

const TOAST_MS = 3000;
let toastTimer = null;


/* ---------- 4. Helpers ---------- */

// The file's name, with today's date:  "growth-os-backup-2026-10-30.json"
function backupFileName() {
    return `growth-os-backup-${todayDate()}.json`;
}

// "2026-10-30T07:15:00.000Z" → "30 Oct 2026"   (unknown → "this file")
function describeSavedAt(savedAt) {
    if (!savedAt) return "this file";
    return new Date(savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}


// A time stamp → "just now" · "5 min ago" · "3 h ago" · "12 Nov"
function timeAgo(time) {
    const minutes = Math.floor((Date.now() - time) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
    return new Date(time).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// What sync is doing → what Me shows.   status (sync.js) → [icon, title, small text]
const SYNC_WORDS = {
    synced:   ["cloud_done", "Synced", ""],                                   // the small text = "2 min ago"
    saving:   ["sync", "Syncing…", "Saving your latest changes"],
    checking: ["sync", "Syncing…", "Checking your account"],
    off:      ["sync", "Syncing…", "Connecting to your account"],
    offline:  ["cloud_off", "Offline", "Your changes will sync when you're back online"],
    error:    ["error", "Couldn't sync", "We'll try again. Check your internet."],
    conflict: ["sync_problem", "Waiting for your choice", "Pick which progress to keep"]
};


/* ---------- 5. Renderers ---------- */

function updatePage() {
    const name = getName() || "You";
    const goals = getActiveGoals();                      // main goal first
    meAvatar.textContent = name.trim()[0].toUpperCase();
    meName.textContent = name;
    meArea.textContent = getDirection().areaLabel || "";
    nameSub.textContent = name;
    // 1 goal → "Your goal · Run 5 km"   3 goals → "Your goals · Run 5 km + 2 more"
    goalRowTitle.textContent = goals.length > 1 ? "Your goals" : "Your goal";
    if (goals.length === 0) goalSub.textContent = "No goal yet";
    else if (goals.length === 1) goalSub.textContent = goals[0].title;
    else goalSub.textContent = `${goals[0].title} + ${goals.length - 1} more`;
    undoRestoreRow.hidden = !canUndoRestore();
    renderAccount();
}

// Signed out → one row: "Back up and sync".   Signed in → who · status · Sign out.
function renderAccount() {
    const account = getAccount();
    syncRow.hidden = Boolean(account);
    accountRow.hidden = !account;
    syncStatusRow.hidden = !account;
    signOutRow.hidden = !account;

    backupNote.textContent = account
        ? "Your data is also saved to your Google account. A backup file is extra safety."
        : "Your data lives on this phone. Save a backup now and then, so you never lose it.";
    resetSub.textContent = account
        ? "Deletes all your data, on this device and in your account"
        : "Deletes all your data and photos on this phone";

    if (!account) return;

    accountName.textContent = account.name || "Signed in";
    accountEmail.textContent = account.email;
    renderPhoto(account);
    renderSyncStatus();
}

// Their first letter now; their Google photo once it has loaded (if it loads).
function renderPhoto(account) {
    accountPhoto.textContent = (account.name || account.email || "?").trim()[0].toUpperCase();
    if (!account.photo) return;

    const photo = new Image();
    photo.alt = "";
    photo.referrerPolicy = "no-referrer";                // Google's photo server can refuse otherwise
    photo.addEventListener("load", () => accountPhoto.replaceChildren(photo));
    photo.src = account.photo;
}

function renderSyncStatus() {
    const account = getAccount();
    if (!account) return;

    const status = getSyncStatus();
    const [icon, title, sub] = SYNC_WORDS[status] || SYNC_WORDS.off;
    syncStatusIcon.textContent = icon;
    syncStatusText.textContent = title;
    syncStatusSub.textContent = status === "synced" ? `Last synced ${timeAgo(account.lastSyncedAt)}` : sub;
    syncStatusRow.classList.toggle("is-problem", status === "error" || status === "offline");
}

function showToast(message) {
    toastText.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, TOAST_MS);
}


/* ---------- 6. Actions ---------- */

/* ── 6a. Name ── */

function openName() {
    nameInput.value = getName();
    nameSheet.showModal();
}

function saveNewName() {
    const name = nameInput.value.trim();
    if (!name) {
        nameInput.focus();
        return;
    }
    saveName(name);
    nameSheet.close();
    updatePage();
    showToast("Name saved");
}

/* ── 6b. Save a backup ──
   text → a Blob (a file in memory) → a temporary link → click it → the browser downloads it */
function downloadBackup() {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFileName();                        // download = "save it", don't open it
    link.click();
    URL.revokeObjectURL(url);                                // free the memory
    showToast("Backup saved to your downloads");
}

/* ── 6c. Bring back a backup ── */

async function bringBack(file) {
    if (!file) return;
    const backup = readBackupFile(await file.text());        // file.text() is async: it reads the file
    if (!backup) {
        showToast("That file isn't a Growth OS backup");
        return;
    }
    const when = describeSavedAt(backup.savedAt);
    if (!confirm(`Bring back the backup from ${when}?\n\nIt replaces everything on this phone now. You can undo this once.`)) return;
    restoreData(backup.data);
    window.location.replace("me.html?restored=1");           // reload: every number on the page is new
}

function undoLastRestore() {
    if (!confirm("Go back to what you had before the last restore?")) return;
    undoRestore();
    window.location.replace("me.html?undone=1");
}

/* ── 6d. Account ── */

// Sign out: sync.js sends the last changes, signs out, empties this device, goes to the start.
async function signOut() {
    if (!confirm("Sign out?\n\nYour data will be removed from this device. It stays safe in your Google account.")) return;
    signOutRow.disabled = true;
    try {
        await signOutAndClear();
    } catch (error) {
        signOutRow.disabled = false;
        showToast(error.message === "not-uploaded"
            ? "Connect to the internet first, so your latest changes are saved"
            : "Couldn't sign out. Please try again.");
    }
}

/* ── 6e. Start over ── */

async function resetEverything() {
    const account = getAccount();
    const question = account
        ? "Delete ALL your data, on this device AND in your Google account?\n\nThis can't be undone. Save a backup first if you might want it back."
        : "Delete ALL your data and photos on this phone?\n\nThis can't be undone. Save a backup first if you might want it back.";
    if (!confirm(question)) return;

    await cleanUnusedPhotos([], Infinity);                   // "no photo is used", any age → delete them all
    clearSafetyCopy();
    resetUser();
    if (account) await uploadNow();                          // the empty start goes to the account too
    window.location.replace("../startup/welcome.html");
}


/* ---------- 7. Page load ---------- */

if (meReady) {
    updatePage();

    // Coming back from a restore / undo: say what happened, then clean the address
    const params = new URLSearchParams(window.location.search);
    if (params.has("restored")) showToast("Backup brought back");
    if (params.has("undone")) showToast("Restore undone");
    if (params.has("restored") || params.has("undone")) history.replaceState(null, "", "me.html");
}


/* ---------- 8. Events ---------- */

nameRow.addEventListener("click", openName);
nameCancel.addEventListener("click", () => nameSheet.close());
nameSave.addEventListener("click", saveNewName);
nameInput.addEventListener("keydown", event => {
    if (event.key === "Enter") saveNewName();
});

syncRow.addEventListener("click", () => openSignIn());      // signin.js loads AFTER me.js: look it up on tap
signOutRow.addEventListener("click", signOut);
window.addEventListener("growthos:sync", renderAccount);     // sync.js: status changed (or just signed in)
setInterval(renderSyncStatus, 60 * 1000);                    // keep "2 min ago" up to date

saveBackup.addEventListener("click", downloadBackup);
backupInput.addEventListener("change", () => {
    bringBack(backupInput.files[0]);
    backupInput.value = "";                                  // the same file can be picked again
});
undoRestoreRow.addEventListener("click", undoLastRestore);
resetRow.addEventListener("click", resetEverything);