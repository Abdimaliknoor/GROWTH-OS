// storage.js
// The ONLY file that talks to localStorage.
// When we move to a database, only this file changes.

const STORAGE_KEY = "growthOS";

// Read everything. Returns an object, or null on the first visit.
function readStorage() {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return null;
    try {
        return JSON.parse(text);          // text → object
    } catch {
        return null;                      // broken text → act like a first visit
    }
}

// Save everything.
function writeStorage(data) {
    data.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    const sync = readSyncState();
    if (sync.uid) writeSyncState({ ...sync, pending: true });       
    window.dispatchEvent(new Event("growthos:saved"));             
}
// Save a copy exactly as it is, WITHOUT a new stamp and without telling sync.
// Only sync.js uses it: when the account's copy comes DOWN, it must keep the
// account's time (else it would look "newer" and be sent straight back up).
function replaceStorage(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Delete everything.
function clearStorage() {
    localStorage.removeItem(STORAGE_KEY);
}

// ── Safety copy: what you had just before you brought back a backup (one "undo") ──
const SAFETY_KEY = "growthOS-before-restore";

function keepSafetyCopy(data) {
    localStorage.setItem(SAFETY_KEY, JSON.stringify(data));
}

function readSafetyCopy() {
    const text = localStorage.getItem(SAFETY_KEY);
    try {
        return text ? JSON.parse(text) : null;
    } catch {
        return null;
    }
}

function clearSafetyCopy() {
    localStorage.removeItem(SAFETY_KEY);
}



/* ════════════════════ 3. SYNC STATE ════════════════════
   What this phone knows about the account:
     uid            who is signed in here ("" = nobody)
     pending        true = a change is waiting to upload (offline, or not sent yet)
     lastSyncedAt   when the two copies were last the same (for "Synced 2 min ago")
     signingIn      true = we just left for Google's sign-in page (redirect)
   Kept separate from your data: it describes THIS phone, not you,
   so it never goes up to the account or into a backup file. */

const SYNC_KEY = "growthOS-sync";

const EMPTY_SYNC = { uid: "", pending: false, lastSyncedAt: 0, signingIn: false };

function readSyncState() {
    const text = localStorage.getItem(SYNC_KEY);
    try {
        return { ...EMPTY_SYNC, ...(text ? JSON.parse(text) : {}) };   // missing parts get defaults
    } catch {
        return { ...EMPTY_SYNC };
    }
}

function writeSyncState(state) {
    localStorage.setItem(SYNC_KEY, JSON.stringify(state));
}

function clearSyncState() {
    localStorage.removeItem(SYNC_KEY);
}