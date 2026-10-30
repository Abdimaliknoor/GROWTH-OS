/* =========================================================
   JOURNAL  (app/journal.html)

   Two views:
     DAYS   a write box (words, mood, photos), then every day, newest first:
              ✍️ write   your words          ••• edit / delete
              🎯 focus   a focus session     ••• edit reflection / undo
              ⏭ skip    a skipped habit
              ⊕ record  logged with + or the record sheet
     NOTES  things to keep: search, folders (your goal + its habits), pinned, +
            Tap a note → note.html (the editor)

   Where the data comes from:
     getJournal, getNoteList, getNoteFolders, getNoteTitle …   → insights.js
     addJournalEntry, updateFocus, addNote, undoFocus …        → state.js
     savePhoto, getPhotoUrl, deletePhotos                      → photos.js

   1. Guard   2. Elements   3. Settings   4. Page state
   5. Helpers   6. Renderers   7. Actions   8. Page load   9. Events
   ========================================================= */


/* ---------- 1. Guard ---------- */

const journalReady = isOnboardingComplete();
if (!journalReady) {
    window.location.replace("../startup/welcome.html");
}


/* ---------- 2. Elements ---------- */

const topMeta = document.getElementById("topMeta");
const switchTabs = document.querySelectorAll(".journal-switch-tab");
const daysView = document.getElementById("daysView");
const notesView = document.getElementById("notesView");

// Days
const writeForm = document.getElementById("writeForm");
const writePrompt = document.getElementById("writePrompt");
const writeText = document.getElementById("writeText");
const writePhotos = document.getElementById("writePhotos");
const writePhotoButton = document.getElementById("writePhotoButton");
const writePhotoInput = document.getElementById("writePhotoInput");
const writeStreak = document.getElementById("writeStreak");
const writeStreakText = document.getElementById("writeStreakText");
const daysEmpty = document.getElementById("daysEmpty");
const journalDays = document.getElementById("journalDays");

// Notes
const noteSearch = document.getElementById("noteSearch");
const noteFolders = document.getElementById("noteFolders");
const notesEmpty = document.getElementById("notesEmpty");
const notesEmptyTitle = document.getElementById("notesEmptyTitle");
const notesEmptyText = document.getElementById("notesEmptyText");
const pinnedBox = document.getElementById("pinnedBox");
const pinnedGrid = document.getElementById("pinnedGrid");
const othersBox = document.getElementById("othersBox");
const othersTitle = document.getElementById("othersTitle");
const othersGrid = document.getElementById("othersGrid");
const noteAdd = document.getElementById("noteAdd");

// Templates
const dayTemplate = document.getElementById("dayTemplate");
const writeTemplate = document.getElementById("writeTemplate");
const focusTemplate = document.getElementById("focusTemplate");
const skipTemplate = document.getElementById("skipTemplate");
const recordTemplate = document.getElementById("recordTemplate");
const noteTemplate = document.getElementById("noteTemplate");
const photoTemplate = document.getElementById("photoTemplate");

// Edit sheet (your entry)
const editSheet = document.getElementById("editSheet");
const editWhen = document.getElementById("editWhen");
const editText = document.getElementById("editText");
const editPhotos = document.getElementById("editPhotos");
const editCancel = document.getElementById("editCancel");
const editSave = document.getElementById("editSave");
const editDelete = document.getElementById("editDelete");

// Focus sheet
const focusSheet = document.getElementById("focusSheet");
const focusTitle = document.getElementById("focusTitle");
const focusWhen = document.getElementById("focusWhen");
const focusNote = document.getElementById("focusNote");
const focusCancel = document.getElementById("focusCancel");
const focusSave = document.getElementById("focusSave");
const focusClear = document.getElementById("focusClear");
const focusUndo = document.getElementById("focusUndo");

const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");


/* ---------- 3. Settings ---------- */

// Mood number → word. Index 0 is empty so MOOD_WORDS[4] = "Good".
const MOOD_WORDS = ["", "Hard", "Tough", "Okay", "Good", "Great"];
const TOAST_MS = 3000;

// One question per day of the week (Sunday first, like getDay())
const PROMPTS = [
    "What are you grateful for this week?",
    "What do you want this week to be about?",
    "What went well today?",
    "What was hard today, and why?",
    "What did you learn today?",
    "What would you do differently?",
    "What are you proud of this week?"
];


/* ---------- 4. Page state ---------- */

let view = "days";              // "days" or "notes"
let writePhotoIds = [];         // photos picked in the write box, not saved in an entry yet
let editingId = null;           // the entry in the edit sheet
let editPhotoIds = [];          // its photos while editing (✕ removes from here)
let focusId = null;             // the session in the focus sheet
let folderChoice = null;        // Notes: null = All, or { kind, id }
let toastTimer = null;


/* ---------- 5. Helpers (work things out, never draw) ---------- */

// "2026-10-18" → "Today"   "2026-10-17" → "Yesterday"   older → "Friday 16 October"
function formatDayTitle(date) {
    if (date === todayDate()) return "Today";
    if (date === addDaysTo(todayDate(), -1)) return "Yesterday";
    return new Date(date + "T00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

// "2026-10-27" → "Tue 27 Oct"
function formatShortDate(date) {
    return new Date(date + "T00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

// A timestamp → "21:02"
function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// 4 → "Good"     null → ""
function moodText(mood) {
    return MOOD_WORDS[mood] || "";                           // anything that isn't 1–5 → "" (e.g. a strange backup file)
}

// A focus session as one line: "25 min · 4 pages"  (time habits: just "25 min")
function focusDetail(entry) {
    const parts = [`${entry.minutes} min`];
    if (entry.amount > 0 && entry.unit && entry.unit !== "min") parts.push(`${entry.amount} ${entry.unit}`);
    return parts.join(" · ");
}

// A record line: "Memorize new · 3 pages"   (done/not-done habits: "Recite with teacher · done")
function recordText(line) {
    if (line.tick) return `${line.habitName} · done`;
    const unit = line.amount === 1 ? line.unit.replace(/s$/, "") : line.unit;   // 1 pages → 1 page
    return `${line.habitName} · ${line.amount} ${unit}`.trim();
}

// "1 entry" / "12 entries"
function countWords(count, one, many) {
    return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

// Which mood pill is picked in a group? → 1–5, or null
function chosenMood(groupName) {
    const picked = document.querySelector(`input[name="${groupName}"]:checked`);
    return picked ? Number(picked.value) : null;
}

// Tick the right pill (or none) in a group.
function setMood(groupName, mood) {
    document.querySelectorAll(`input[name="${groupName}"]`).forEach(input => {
        input.checked = Number(input.value) === mood;
    });
}

// A template → a real element, ready to fill
function copyTemplate(template) {
    return template.content.cloneNode(true).firstElementChild;
}


/* ---------- 6. Renderers (they draw) ---------- */

/* ── 6a. Photos ── */

// Photos into a box. canRemove = show ✕ on each.
// The pictures load a moment later (IndexedDB is async): the boxes appear first, then fill in.
function renderPhotos(box, ids, canRemove = false) {
    box.hidden = ids.length === 0;
    box.classList.toggle("is-one", ids.length === 1);
    box.replaceChildren(...ids.map(id => {
        const photo = copyTemplate(photoTemplate);
        photo.dataset.photoId = id;
        photo.querySelector(".journal-photo-remove").hidden = !canRemove;
        getPhotoUrl(id).then(url => { if (url) photo.querySelector("img").src = url; });
        return photo;
    }));
}

// 📷 is greyed out once there are MAX_PHOTOS
function renderWritePhotos() {
    renderPhotos(writePhotos, writePhotoIds, true);
    writePhotoButton.classList.toggle("is-full", writePhotoIds.length >= MAX_PHOTOS);
}

/* ── 6b. Days ── */

function fillMood(card, mood) {
    const tag = card.querySelector(".entry-mood");
    tag.textContent = moodText(mood);
    tag.dataset.mood = mood || "";                           // the dot's colour (journal.css)
    tag.hidden = !mood;
}

function buildWriteEntry(entry) {
    const card = copyTemplate(writeTemplate);
    card.dataset.entryId = entry.id;
    card.querySelector(".entry-time").textContent = formatTime(entry.time);
    const text = card.querySelector(".entry-text");
    text.textContent = entry.text;
    text.hidden = !entry.text;                               // a photo with no words
    fillMood(card, entry.mood);
    renderPhotos(card.querySelector(".journal-photos"), entry.photos);
    return card;
}

function buildFocusEntry(entry) {
    const card = copyTemplate(focusTemplate);
    card.dataset.entryId = entry.id;
    card.querySelector(".entry-kind").textContent = `Focus · ${entry.habitName}`;
    card.querySelector(".entry-time").textContent = formatTime(entry.time);
    card.querySelector(".entry-detail").textContent = focusDetail(entry);
    const note = card.querySelector(".entry-text");
    note.textContent = entry.note;
    note.hidden = !entry.note;
    fillMood(card, entry.mood);
    return card;
}

function buildSkipEntry(entry) {
    const card = copyTemplate(skipTemplate);
    card.querySelector(".entry-kind").textContent = `Skipped ${entry.habitName}`;
    card.querySelector(".entry-detail").textContent = entry.reason || "No reason given";
    return card;
}

function buildRecordLine(line) {
    const row = copyTemplate(recordTemplate);
    row.querySelector(".entry-record-text").textContent = recordText(line);
    return row;
}

function buildEntry(entry) {
    if (entry.kind === "write") return buildWriteEntry(entry);
    if (entry.kind === "focus") return buildFocusEntry(entry);
    return buildSkipEntry(entry);
}

// "✓ 3 of 4 habits"  "⏱ 25 min focus"  "● Good day": only the ones that have something to say
function buildStats(stats) {
    const pills = [];
    const pill = (icon, text, good = false) => {
        const span = document.createElement("span");
        span.className = good ? "journal-stat is-good" : "journal-stat";
        span.innerHTML = `<span class="icon" aria-hidden="true">${icon}</span>`;
        span.append(text);                                   // append = plain text, never HTML
        pills.push(span);
    };
    if (stats.habits) pill("check_circle", `${stats.habits.done} of ${stats.habits.total} habits`, stats.habits.done === stats.habits.total);
    if (stats.focusMinutes) pill("timer", `${stats.focusMinutes} min focus`);
    if (stats.mood) {
        const mood = document.createElement("span");
        mood.className = "journal-stat";
         const tag = document.createElement("span");          // built piece by piece: data never goes into innerHTML
        tag.className = "mood-tag";
        tag.dataset.mood = stats.mood;
        tag.textContent = `${moodText(stats.mood)} day`;
        mood.append(tag);
        pills.push(mood);
    }
    return pills;
}

function buildDay(day) {
    const section = copyTemplate(dayTemplate);
    section.querySelector(".journal-day-title").textContent = formatDayTitle(day.date);
    section.querySelector(".journal-day-date").textContent = formatShortDate(day.date);
    section.querySelector(".journal-stats").append(...buildStats(day.stats));
    section.querySelector(".journal-list").append(...day.entries.map(buildEntry), ...day.records.map(buildRecordLine));
    return section;
}

function renderDays() {
    const days = getJournal();
    journalDays.replaceChildren(...days.map(buildDay));
    daysEmpty.hidden = days.length > 0;
    const total = days.reduce((sum, day) => sum + day.entries.length, 0);
    topMeta.textContent = countWords(total, "entry", "entries");

    // 🔥 only from 2 days: "1 day in a row" isn't a streak yet
    const streak = getWriteStreak();
    writeStreak.hidden = streak < 2;
    writeStreakText.textContent = `You've written ${streak} days in a row`;
}

/* ── 6c. Notes ── */

// One chip: [⚑ Memorize a new juz 3]. aria-pressed = chosen.
function buildFolderChip(name, icon, count, folder) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.folder = folder ? JSON.stringify(folder) : "";
    chip.setAttribute("aria-pressed", String(folder ? sameFolder(folder, folderChoice) : !folderChoice));
    if (icon) chip.innerHTML = `<span class="icon" aria-hidden="true">${icon}</span>`;
    chip.append(name + " ");
    const number = document.createElement("span");
    number.className = "note-count";
    number.textContent = count;
    chip.append(number);
    return chip;
}

function renderFolders() {
    const folders = getNoteFolders();
    noteFolders.replaceChildren(
        buildFolderChip("All", "", getNotes().length, null),
        ...folders
            .filter(item => item.count > 0 || sameFolder(item.folder, folderChoice))   // no empty chips
            .map(item => buildFolderChip(item.name, item.icon, item.count, item.folder))
    );
}

function buildNoteCard(note) {
    const card = copyTemplate(noteTemplate);
    card.href = `note.html?id=${encodeURIComponent(note.id)}`;
    if (note.color) card.dataset.color = note.color;          // its tint (journal.css)
    card.querySelector(".note-card-title").textContent = getNoteTitle(note);
    card.querySelector(".note-card-text").textContent = note.title.trim() ? note.text : note.text.split("\n").slice(1).join("\n");

    const where = describeNoteFolder(note.folder);
    if (where) {
        card.querySelector(".note-card-where").hidden = false;
        card.querySelector(".note-card-where .icon").textContent = where.icon;
        card.querySelector(".note-card-where-name").textContent = where.name;
    }

    // First photo as the cover
    if (note.photos.length) {
        const img = card.querySelector(".note-card-photo");
        getPhotoUrl(note.photos[0]).then(url => {
            if (!url) return;
            img.src = url;
            img.hidden = false;
        });
    }
    return card;
}

function renderNotes() {
    renderFolders();
    const list = getNoteList(folderChoice, noteSearch.value);
    const searching = noteSearch.value.trim() !== "";

    pinnedGrid.replaceChildren(...list.pinned.map(buildNoteCard));
    othersGrid.replaceChildren(...list.others.map(buildNoteCard));
    pinnedBox.hidden = list.pinned.length === 0;
    othersBox.hidden = list.others.length === 0;
    othersTitle.textContent = searching ? "Results" : list.pinned.length ? "Recent" : "Notes";

    const nothing = list.pinned.length + list.others.length === 0;
    notesEmpty.hidden = !nothing;
    notesEmptyTitle.textContent = searching ? "Nothing found" : "No notes yet";
    notesEmptyText.textContent = searching
        ? "Try another word."
        : "Tap + to keep something: what your teacher said, a plan, a photo of your notes.";

    topMeta.textContent = countWords(getNotes().length, "note", "notes");
}

/* ── 6d. The page ── */

function updatePage() {
    switchTabs.forEach(tab => tab.setAttribute("aria-selected", String(tab.dataset.view === view)));
    daysView.hidden = view !== "days";
    notesView.hidden = view !== "notes";
    if (view === "days") renderDays();
    else renderNotes();
}


/* ---------- 7. Actions (they change data, then redraw) ---------- */

/* ── 7a. Switch view ── */

// The view is kept in the address (journal.html?view=notes), so Back from a note lands on Notes.
function chooseView(name) {
    view = name;
    history.replaceState(null, "", name === "notes" ? "journal.html?view=notes" : "journal.html");
    updatePage();
}

/* ── 7b. Write box ── */

// 📷 picked a photo → shrink + save it now, show it in the box. It joins the entry on Save.
async function addWritePhoto(file) {
    if (!file || writePhotoIds.length >= MAX_PHOTOS) return;
    try {
        writePhotoIds.push(await savePhoto(file));
        renderWritePhotos();
    } catch {
        showToast("That photo couldn't be added");
    }
}

// ✕ on a photo in the write box: it isn't in any entry yet, so delete it for good
function removeWritePhoto(id) {
    writePhotoIds = writePhotoIds.filter(item => item !== id);
    deletePhotos([id]);
    renderWritePhotos();
}

function saveEntry() {
    const entry = addJournalEntry(writeText.value, chosenMood("writeMood"), writePhotoIds);
    if (!entry) {                                            // no words, no photos → nothing to save
        writeText.focus();
        return;
    }
    writeForm.reset();
    writePhotoIds = [];
    renderWritePhotos();
    updatePage();
    showToast("Saved");
}

/* ── 7c. Edit your entry ── */

function openEdit(id) {
    const entry = getJournalEntries().find(item => item.id === id);
    if (!entry) return;
    editingId = id;
    editPhotoIds = [...(entry.photos || [])];                // a copy: Cancel must leave the entry as it was
    editWhen.textContent = `${formatDayTitle(entry.date)} · ${formatTime(entry.createdAt)}`;
    editText.value = entry.text;
    setMood("editMood", entry.mood);
    renderPhotos(editPhotos, editPhotoIds, true);
    editSheet.showModal();
}

function saveEdit() {
    const text = editText.value.trim();
    if (!text && editPhotoIds.length === 0) {                // emptied everything? use Delete instead
        editText.focus();
        return;
    }
    const entry = getJournalEntries().find(item => item.id === editingId);
    const removed = (entry.photos || []).filter(id => !editPhotoIds.includes(id));
    updateJournalEntry(editingId, { text, mood: chosenMood("editMood"), photos: editPhotoIds });
    deletePhotos(removed);                                   // ✕'d photos are gone only once you Save
    editSheet.close();
    updatePage();
    showToast("Updated");
}

function deleteEntry() {
    if (!confirm("Delete this entry? This can't be undone.")) return;
    const entry = getJournalEntries().find(item => item.id === editingId);
    deleteJournalEntry(editingId);
    deletePhotos(entry.photos || []);
    editSheet.close();
    updatePage();
    showToast("Deleted");
}

/* ── 7d. A focus session ── */

function openFocusSheet(id) {
    const session = getFocusById(id);
    if (!session) return;
    focusId = id;
    focusTitle.textContent = `Focus · ${habitNameOf(session.habitId)}`;
    focusWhen.textContent = `${formatDayTitle(session.date)} · ${formatTime(session.startedAt)}`;
    setMood("focusMood", session.mood);
    focusNote.value = session.note;
    focusSheet.showModal();
}

function saveFocusSheet() {
    updateFocus(focusId, { mood: chosenMood("focusMood"), note: focusNote.value.trim() });
    focusSheet.close();
    updatePage();
    showToast("Updated");
}

function clearReflection() {
    removeFocusReflection(focusId);
    focusSheet.close();
    updatePage();
    showToast("Reflection removed");
}

// Takes the pages away from Today, Plan and Progress too, so: ask first
function undoSession() {
    if (!confirm("Undo this session? Its minutes and what it logged will be removed from your progress.")) return;
    undoFocus(focusId);
    focusSheet.close();
    updatePage();
    showToast("Session undone");
}

/* ── 7e. Notes ── */

function chooseFolder(chip) {
    folderChoice = chip.dataset.folder ? JSON.parse(chip.dataset.folder) : null;
    renderNotes();
}

// + → a new empty note in the folder you're looking at → open it
function newNote() {
    const note = addNote(folderChoice);
    window.location.href = `note.html?id=${encodeURIComponent(note.id)}`;
}

/* ── 7f. Small things ── */

function showToast(message) {
    toastText.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, TOAST_MS);
}


/* ---------- 8. Page load ---------- */

if (journalReady) {
    view = new URLSearchParams(window.location.search).get("view") === "notes" ? "notes" : "days";
    writePrompt.textContent = PROMPTS[new Date().getDay()];
    updatePage();

    // Photos: ask the browser to keep them, and sweep away any no entry or note uses
    keepPhotosSafe();
    const usedPhotos = [...getJournalEntries(), ...getNotes()].flatMap(item => item.photos || []);
    cleanUnusedPhotos(usedPhotos);

    // From Today's evening card (journal.html#write): cursor in the box, ready to type
    if (window.location.hash === "#write") {
        writeText.focus();
        history.replaceState(null, "", "journal.html");
    }
}


/* ---------- 9. Events ---------- */

switchTabs.forEach(tab => tab.addEventListener("click", () => chooseView(tab.dataset.view)));

// Write box
writeForm.addEventListener("submit", event => {
    event.preventDefault();
    saveEntry();
});

writeText.addEventListener("keydown", event => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        saveEntry();
    }
});

writePhotoInput.addEventListener("change", () => {
    addWritePhoto(writePhotoInput.files[0]);
    writePhotoInput.value = "";                              // so the same photo can be picked again
});

writePhotos.addEventListener("click", event => {
    const button = event.target.closest('[data-action="remove-photo"]');
    if (button) removeWritePhoto(button.closest("[data-photo-id]").dataset.photoId);
});

// ••• on entries (event delegation: works for entries drawn later too)
journalDays.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const id = button.closest("[data-entry-id]").dataset.entryId;
    if (button.dataset.action === "edit-write") openEdit(id);
    if (button.dataset.action === "edit-focus") openFocusSheet(id);
});

// Edit sheet
editPhotos.addEventListener("click", event => {
    const button = event.target.closest('[data-action="remove-photo"]');
    if (!button) return;
    const id = button.closest("[data-photo-id]").dataset.photoId;
    editPhotoIds = editPhotoIds.filter(item => item !== id);
    renderPhotos(editPhotos, editPhotoIds, true);
});
editCancel.addEventListener("click", () => editSheet.close());
editSave.addEventListener("click", saveEdit);
editDelete.addEventListener("click", deleteEntry);
editSheet.addEventListener("close", () => { editingId = null; });

// Focus sheet
focusCancel.addEventListener("click", () => focusSheet.close());
focusSave.addEventListener("click", saveFocusSheet);
focusClear.addEventListener("click", clearReflection);
focusUndo.addEventListener("click", undoSession);
focusSheet.addEventListener("close", () => { focusId = null; });

// Notes
noteSearch.addEventListener("input", renderNotes);
noteFolders.addEventListener("click", event => {
    const chip = event.target.closest(".chip");
    if (chip) chooseFolder(chip);
});
noteAdd.addEventListener("click", newNote);