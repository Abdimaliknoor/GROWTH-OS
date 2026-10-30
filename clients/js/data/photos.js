/* ╔══════════════════════════════════════════════════════════════╗
   ║  PHOTOS  ·  js/data/photos.js                                ║
   ║  Where pictures live: IndexedDB, the browser's big storage.  ║
   ╚══════════════════════════════════════════════════════════════╝

   WHY NOT localStorage?
     localStorage holds about 5 MB for EVERYTHING. One phone photo is 2–5 MB.
     IndexedDB holds hundreds of MB, and it stores files (Blobs) as they are.

   HOW IT FITS
     A note / journal entry saves only the photo IDS:   photos: ["photo-…", "photo-…"]
     This file saves the pictures under those ids.
     Later, the backend replaces this file (cloud storage). Pages don't change.

   NEW IDEA: async / await
     IndexedDB is slow-ish, so it never answers straight away. It answers LATER.
     An "async" function returns a Promise (= "the answer, later").
     "await" waits for that answer:   const id = await savePhoto(file);

   MAP
     1. Settings
     2. Open the database ...... openPhotoDB
     3. Make it smaller ........ shrinkPhoto
     4. Save / read / delete ... savePhoto, getPhotoUrl, deletePhotos
     5. Keep it tidy ........... keepPhotosSafe, cleanUnusedPhotos
   ══════════════════════════════════════════════════════════════════ */


/* ════════════════════ 1. SETTINGS ════════════════════ */

const PHOTO_DB = "growthOS-photos";
const PHOTO_STORE = "photos";
const MAX_PHOTOS = 3;              // per note / journal entry
const PHOTO_MAX_SIDE = 1280;       // px: sharp on any phone, ~200 KB instead of ~4 MB
const PHOTO_QUALITY = 0.8;         // JPEG quality, 0–1


/* ════════════════════ 2. OPEN THE DATABASE ════════════════════ */

// The first time, the browser creates the database and its one "table" (store).
// Opened once, then reused: photoDB holds the Promise.
let photoDB = null;

function openPhotoDB() {
    if (photoDB) return photoDB;
    photoDB = new Promise((resolve, reject) => {
        const request = indexedDB.open(PHOTO_DB, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(PHOTO_STORE, { keyPath: "id" });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    return photoDB;
}

// One read or write. mode: "readonly" or "readwrite".
//   await photoRequest("readwrite", store => store.put({ id, blob }))
async function photoRequest(mode, action) {
    const db = await openPhotoDB();
    return new Promise((resolve, reject) => {
        const request = action(db.transaction(PHOTO_STORE, mode).objectStore(PHOTO_STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}


/* ════════════════════ 3. MAKE IT SMALLER ════════════════════ */

// A 4000×3000 phone photo → 1280×960 JPEG.  Draw it small on a canvas, then save the canvas.
//   await shrinkPhoto(file) → a Blob of ~150–300 KB
async function shrinkPhoto(file) {
    const image = await createImageBitmap(file);
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(image.width, image.height));   // never make it BIGGER
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close();
    return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", PHOTO_QUALITY));
}


/* ════════════════════ 4. SAVE / READ / DELETE ════════════════════ */

// A file from <input type="file"> → shrunk → saved. Returns the new id.
//   const id = await savePhoto(input.files[0]);   → "photo-1761…-482"
// Not a picture (a PDF, a broken file)? → throws "not-a-photo": the page shows a message.
// Bonus: redrawing on a canvas drops the hidden data inside the photo (GPS location, phone model).
async function savePhoto(file) {
    if (!file || !file.type.startsWith("image/")) throw new Error("not-a-photo");
    const blob = await shrinkPhoto(file).catch(() => { throw new Error("not-a-photo"); });
    const id = generateId("photo");
    await photoRequest("readwrite", store => store.put({ id, blob, createdAt: Date.now() }));
    return id;
}

// id → a URL an <img> can show:  img.src = await getPhotoUrl(id)
// Gone (deleted, or another phone)? → null, and the page shows nothing.
async function getPhotoUrl(id) {
    const saved = await photoRequest("readonly", store => store.get(id));
    return saved ? URL.createObjectURL(saved.blob) : null;
}

// Delete several at once (a note's photos when the note is deleted).
async function deletePhotos(ids) {
    for (const id of ids) {
        await photoRequest("readwrite", store => store.delete(id));
    }
}


/* ════════════════════ 5. KEEP IT TIDY ════════════════════ */

// Ask the browser NOT to clear our storage when the phone is low on space.
// (Without this, Chrome may delete it to free room.) Returns true if it agreed.
async function keepPhotosSafe() {
    if (!navigator.storage || !navigator.storage.persist) return false;
    return navigator.storage.persist();
}

// Safety net: delete pictures that no note or journal entry points to any more
// (e.g. the page closed halfway through saving).  usedIds = every id still in use.
// Safety net: delete pictures that no note or journal entry points to any more
// (e.g. the page closed halfway through saving).  usedIds = every id still in use.
// Only photos saved BEFORE `before` are touched: a photo you're adding right now
// (in the write box, not in an entry yet) must never be swept away.
async function cleanUnusedPhotos(usedIds, before = Date.now()) {
    const saved = await photoRequest("readonly", store => store.getAll());
    const unused = saved
        .filter(photo => !usedIds.includes(photo.id) && photo.createdAt < before)
        .map(photo => photo.id);
    await deletePhotos(unused);
    return unused.length;
}