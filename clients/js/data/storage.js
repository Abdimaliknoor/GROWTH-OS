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