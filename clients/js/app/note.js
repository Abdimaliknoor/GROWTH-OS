/* =========================================================
   NOTE  (app/note.html?id=note-…)

   One note, full screen. No Save button:
     you type → wait 0.5 s → saved  ("Saving…" → "✓ Saved")
   Leave it completely empty → it's deleted when you go back.

   Where the data comes from:
     getNoteById, updateNote, togglePinNote, deleteNote   → state.js
     describeNoteFolder, getNoteFolders                   → insights.js
     savePhoto, getPhotoUrl, deletePhotos, MAX_PHOTOS     → photos.js

   1. Guard   2. Elements   3. Settings   4. Page state
   5. Helpers   6. Renderers   7. Actions   8. Page load   9. Events
   ========================================================= */


/* ---------- 1. Guard ---------- */

// No onboarding → welcome.  No note with this id (deleted, old link) → back to Notes.
const noteId = new URLSearchParams(window.location.search).get("id");
const noteReady = isOnboardingComplete() && Boolean(getNoteById(noteId));
if (!isOnboardingComplete()) window.location.replace("../startup/welcome.html");
else if (!noteReady) window.location.replace("journal.html?view=notes");


/* ---------- 2. Elements ---------- */

const notePage = document.getElementById("notePage");
const noteWhere = document.getElementById("noteWhere");
const noteWhereIcon = document.getElementById("noteWhereIcon");
const noteWhereName = document.getElementById("noteWhereName");
const notePin = document.getElementById("notePin");
const noteDelete = document.getElementById("noteDelete");

const noteTitle = document.getElementById("noteTitle");
const noteMeta = document.getElementById("noteMeta");
const noteText = document.getElementById("noteText");
const notePhotos = document.getElementById("notePhotos");

const noteColors = document.getElementById("noteColors");
const cameraButton = document.getElementById("cameraButton");
const cameraInput = document.getElementById("cameraInput");
const galleryButton = document.getElementById("galleryButton");
const galleryInput = document.getElementById("galleryInput");
const colorButton = document.getElementById("colorButton");
const noteSaved = document.getElementById("noteSaved");
const noteSavedText = document.getElementById("noteSavedText");

const folderSheet = document.getElementById("folderSheet");
const folderList = document.getElementById("folderList");
const folderClose = document.getElementById("folderClose");

const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");


/* ---------- 3. Settings ---------- */

const SAVE_DELAY_MS = 500;      // wait this long after the last key, then save
const TOAST_MS = 3000;


/* ---------- 4. Page state ---------- */

let saveTimer = null;           // the waiting save (cancelled if you keep typing)
let toastTimer = null;


/* ---------- 5. Helpers ---------- */

function currentNote() {
    return getNoteById(noteId);
}

// Nothing in it at all? (no title, no text, no photos)
function isEmptyNote(note) {
    return !note.title.trim() && !note.text.trim() && note.photos.length === 0;
}

// 1761… → "Edited today 20:14" / "Edited yesterday 09:02" / "Edited 12 Oct"
function describeEdited(timestamp) {
    const date = dateOf(timestamp);
    const time = new Date(timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (date === todayDate()) return `Edited today ${time}`;
    if (date === addDaysTo(todayDate(), -1)) return `Edited yesterday ${time}`;
    return `Edited ${new Date(date + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}


/* ---------- 6. Renderers ---------- */

// The text box grows with what you write: height = exactly what the text needs
function fitText() {
    noteText.style.height = "auto";
    noteText.style.height = noteText.scrollHeight + "px";
}

function renderWhere(note) {
    const where = describeNoteFolder(note.folder);
    noteWhereIcon.textContent = where ? where.icon : "folder_open";
    noteWhereName.textContent = where ? where.name : "No folder";
}

function renderColor(note) {
    if (note.color) notePage.dataset.color = note.color;
    else delete notePage.dataset.color;                      // no attribute = normal background
    noteColors.querySelectorAll(".note-swatch").forEach(swatch => {
        swatch.setAttribute("aria-pressed", String(swatch.dataset.color === (note.color || "")));
    });
}

function renderPhotos(note) {
    notePhotos.hidden = note.photos.length === 0;
    notePhotos.classList.toggle("is-one", note.photos.length === 1);
    notePhotos.replaceChildren(...note.photos.map(id => {
        const photo = document.createElement("div");
        photo.className = "journal-photo";
        photo.dataset.photoId = id;
        photo.innerHTML = `<img alt="">
            <button class="journal-photo-remove" type="button" aria-label="Remove photo">
                <span class="icon" aria-hidden="true">close</span>
            </button>`;
        getPhotoUrl(id).then(url => { if (url) photo.querySelector("img").src = url; });
        return photo;
    }));
    const full = note.photos.length >= MAX_PHOTOS;
    cameraButton.classList.toggle("is-full", full);
    galleryButton.classList.toggle("is-full", full);
}

// Everything except the title and text (those are only filled once, at load:
// redrawing them while you type would jump the cursor)
function renderExtras() {
    const note = currentNote();
    notePin.setAttribute("aria-pressed", String(note.pinned));
    notePin.setAttribute("aria-label", note.pinned ? "Unpin note" : "Pin note");
    noteMeta.textContent = describeEdited(note.updatedAt);
    renderWhere(note);
    renderColor(note);
    renderPhotos(note);
}

function showSaved(saving) {
    noteSaved.classList.toggle("is-saving", saving);
    noteSavedText.textContent = saving ? "Saving…" : "Saved";
}

// One row in "Move to"
function buildFolderOption(name, icon, folder, current) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "folder-option";
    button.dataset.folder = folder ? JSON.stringify(folder) : "";
    button.setAttribute("aria-pressed", String(folder ? sameFolder(folder, current) : !current));
    button.innerHTML = `<span class="icon" aria-hidden="true">${icon}</span>`;
    button.append(name);                                     // plain text, never HTML
    return button;
}


/* ---------- 7. Actions ---------- */

/* ── 7a. Typing: save a moment after you stop ── */

// Every key restarts the wait. 10 quick keys → ONE save, 0.5 s after the last one.
function queueSave() {
    showSaved(true);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, SAVE_DELAY_MS);
}

function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    updateNote(noteId, { title: noteTitle.value, text: noteText.value });
    noteMeta.textContent = describeEdited(Date.now());
    showSaved(false);
}

// Leaving the page: save what's waiting; an empty note is deleted (no blank cards in your list)
function leavePage() {
    if (saveTimer) saveNow();
    const note = currentNote();
    if (note && isEmptyNote(note)) deleteNote(noteId);
}

/* ── 7b. The top bar ── */

function togglePin() {
    const note = togglePinNote(noteId);
    renderExtras();
    showToast(note.pinned ? "Pinned" : "Unpinned");
}

async function removeNote() {
    if (!confirm("Delete this note? This can't be undone.")) return;
    const note = deleteNote(noteId);
    await deletePhotos(note.photos);
    window.location.replace("journal.html?view=notes");      // replace: Back won't return to a deleted note
}

function openFolders() {
    const current = currentNote().folder;
    folderList.replaceChildren(
        buildFolderOption("No folder", "folder_open", null, current),
        ...getNoteFolders().map(item => buildFolderOption(item.name, item.icon, item.folder, current))
    );
    folderSheet.showModal();
}

function moveTo(option) {
    const folder = option.dataset.folder ? JSON.parse(option.dataset.folder) : null;
    updateNote(noteId, { folder });
    folderSheet.close();
    renderExtras();
}

/* ── 7c. Colour ── */

function toggleColors() {
    noteColors.hidden = !noteColors.hidden;
    colorButton.setAttribute("aria-pressed", String(!noteColors.hidden));
}

function chooseColor(swatch) {
    updateNote(noteId, { color: swatch.dataset.color || null });
    renderExtras();
}

/* ── 7d. Photos ── */

async function addPhoto(file) {
    const note = currentNote();
    if (!file || note.photos.length >= MAX_PHOTOS) return;
    showSaved(true);
    try {
        const id = await savePhoto(file);
        updateNote(noteId, { photos: [...currentNote().photos, id] });
        renderExtras();
    } catch {
        showToast("That photo couldn't be added");
    }
    showSaved(false);
}

// A note has no Cancel (it saves as you go), so ✕ removes the photo for good, right away
function removePhoto(id) {
    updateNote(noteId, { photos: currentNote().photos.filter(item => item !== id) });
    deletePhotos([id]);
    renderExtras();
}

/* ── 7e. Small things ── */

function showToast(message) {
    toastText.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, TOAST_MS);
}


/* ---------- 8. Page load ---------- */

if (noteReady) {
    const note = currentNote();
    noteTitle.value = note.title;
    noteText.value = note.text;
    renderExtras();
    fitText();
    document.title = `${getNoteTitle(note)} | Growth OS`;

    // A brand-new note: cursor in the title, ready to type
    if (isEmptyNote(note)) noteTitle.focus();
}


/* ---------- 9. Events ---------- */

noteTitle.addEventListener("input", queueSave);
noteText.addEventListener("input", () => {
    fitText();
    queueSave();
});

// Enter in the title → jump to the text (a title is one line)
noteTitle.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        noteText.focus();
    }
});

notePin.addEventListener("click", togglePin);
noteDelete.addEventListener("click", removeNote);
noteWhere.addEventListener("click", openFolders);

folderList.addEventListener("click", event => {
    const option = event.target.closest(".folder-option");
    if (option) moveTo(option);
});
folderClose.addEventListener("click", () => folderSheet.close());

colorButton.addEventListener("click", toggleColors);
noteColors.addEventListener("click", event => {
    const swatch = event.target.closest(".note-swatch");
    if (swatch) chooseColor(swatch);
});

[cameraInput, galleryInput].forEach(input => input.addEventListener("change", () => {
    addPhoto(input.files[0]);
    input.value = "";                                        // the same photo can be picked again
}));

notePhotos.addEventListener("click", event => {
    const button = event.target.closest(".journal-photo-remove");
    if (button) removePhoto(button.closest("[data-photo-id]").dataset.photoId);
});

// pagehide = the page is going away (Back, another tab, closing the app). Last chance to save.
window.addEventListener("pagehide", leavePage);