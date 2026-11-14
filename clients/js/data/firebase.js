/* ╔══════════════════════════════════════════════════════════════╗
   ║  FIREBASE  ·  js/data/firebase.js                            ║
   ║  The ONLY file that talks to Firebase (Google sign-in +      ║
   ║  the database). Like storage.js is for localStorage.         ║
   ╚══════════════════════════════════════════════════════════════╝

   An ES module: it uses `import` to load Firebase from Google's CDN.
   It is NOT in any <script> tag. sync.js loads it only when needed:
       const cloud = await import("./firebase.js");
   So someone who never signs in never downloads Firebase at all.

   In the database, each user has ONE document:   users/<their id>
       { json: "<all their data as text>", updatedAt: 1731400000000, dataVersion: 2 }
   The Firestore rules (in the Firebase console) let ONLY that
   signed-in user read or write it.

   Why "json" as text, not the object itself?
     · Firestore would index every field of every log (it has limits on that).
     · Firestore refuses `undefined` values; JSON.stringify just drops them.
     · It goes back exactly as it came in: JSON.parse.

   The config below is NOT a secret: every Firebase website shows it.
   It only says WHICH project to talk to. The rules keep the data safe.

   Map
     1. Load Firebase ............. imports from the CDN
     2. Connect ................... config, app, auth, db
     3. The signed-in user ........ toUser, whenUserKnown
     4. Sign in / out ............. signIn, finishRedirect, signOutUser
     5. The account's data ........ readAccount, writeAccount
   ══════════════════════════════════════════════════════════════════ */


/* ════════════════════ 1. LOAD FIREBASE ════════════════════
   One version for all three files. To update Firebase later,
   change the number in all three lines (and test). */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


/* ════════════════════ 2. CONNECT ════════════════════ */

// Our own addresses on Firebase Hosting.
const OUR_DOMAINS = ["growloo.web.app", "growloo.firebaseapp.com"];
const onOurDomain = OUR_DOMAINS.includes(window.location.hostname);

const firebaseConfig = {
    apiKey: "AIzaSyDyOEs-RBiLFW2gQu0znc_G9tB8je_6vyA",
    // authDomain = the site that runs the Google sign-in step.
    // On our own site we use THAT address (same site = iPhone Safari allows it).
    // Anywhere else (Live Server on your laptop) → the default one.
    authDomain: onOurDomain ? window.location.hostname : "growloo.firebaseapp.com",
    projectId: "growloo",
    storageBucket: "growloo.firebasestorage.app",
    messagingSenderId: "439553585362",
    appId: "1:439553585362:web:592c7f538959abd4753d0b"
    // No measurementId: no Analytics. The privacy page promises no trackers.
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


/* ════════════════════ 3. THE SIGNED-IN USER ════════════════════ */

// Firebase's user object is big. The app only needs four things.
//   Firebase user → { uid: "a1B2…", name: "Abdimalik", email: "…", photo: "https://…" }
//   nobody        → null
function toUser(firebaseUser) {
    if (!firebaseUser) return null;
    return {
        uid: firebaseUser.uid,                      // the id that names their document
        name: firebaseUser.displayName || "",
        email: firebaseUser.email || "",
        photo: firebaseUser.photoURL || ""
    };
}

// Who is signed in? Firebase needs a moment to check when a page opens,
// so this waits for its first answer.   → user or null
export function whenUserKnown() {
    return new Promise(resolve => {
        const stopListening = onAuthStateChanged(auth, firebaseUser => {
            stopListening();                        // we only need the first answer
            resolve(toUser(firebaseUser));
        });
    });
}


/* ════════════════════ 4. SIGN IN / OUT ════════════════════ */

// "Continue with Google".
//   On our site → REDIRECT: the page goes to Google and comes back.
//     (A pop-up window often fails in an iPhone home-screen bookmark.)
//     Nothing comes back here: the page is leaving. finishRedirect() picks it up.
//   On your laptop (Live Server) → a POP-UP window, easier for testing.  → user
export async function signIn() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });   // always let them pick the account

    if (onOurDomain) {
        await signInWithRedirect(auth, provider);
        return null;
    }
    const result = await signInWithPopup(auth, provider);
    return toUser(result.user);
}

// After the redirect, back on our page: did it work?
//   → the user who just signed in, or null (no sign-in was happening).
//   Throws if Google said no (they cancelled, no internet…).
export async function finishRedirect() {
    const result = await getRedirectResult(auth);
    return toUser(result && result.user);
}

export function signOutUser() {
    return signOut(auth);
}


/* ════════════════════ 5. THE ACCOUNT'S DATA ════════════════════ */

// Read users/<uid>.   → { data, updatedAt }, or null if they have nothing saved yet.
// Throws when offline (sync.js catches it and tries again later).
export async function readAccount(uid) {
    const snapshot = await getDoc(doc(db, "users", uid));
    if (!snapshot.exists()) return null;

    const saved = snapshot.data();
    return {
        data: JSON.parse(saved.json),
        updatedAt: saved.updatedAt || 0
    };
}

// Save everything to users/<uid> (replaces what was there).
export function writeAccount(uid, data) {
    return setDoc(doc(db, "users", uid), {
        json: JSON.stringify(data),
        updatedAt: data.updatedAt || Date.now(),
        dataVersion: data.version || 1
    });
}