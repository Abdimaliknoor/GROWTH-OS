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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));   // object → text
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