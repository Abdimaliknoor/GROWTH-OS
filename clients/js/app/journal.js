/* =========================================================
   JOURNAL  (app/journal.html)

   A write box at the top, then every day (newest first) with 3 kinds of entries:
     ✍️ write  your words        → you can edit or delete these
     🎯 focus  a focus session   → read-only (made by Focus)
     ⏭ skip   a skipped habit    → read-only (made by Today)

   Data: getJournal() → insight.js     add/update/deleteJournalEntry() → state.js

   1. Guard   2. Elements   3. Settings   4. Page state
   5. Helpers   6. Renderers   7. Actions   8. Page load   9. Events
   ========================================================= */


/* ---------- 1. Guard ---------- */

// Same as Today: not finished onboarding → nothing to show yet.
const journalReady = isOnboardingComplete();
if (!journalReady) {
    window.location.replace("../startup/welcome.html");
}


/* ---------- 2. Elements ---------- */

const entryCount = document.getElementById("entryCount");
const writeForm = document.getElementById("writeForm");
const writeText = document.getElementById("writeText");
const journalEmpty = document.getElementById("journalEmpty");
const journalDays = document.getElementById("journalDays");

const dayTemplate = document.getElementById("dayTemplate");
const writeTemplate = document.getElementById("writeTemplate");
const focusTemplate = document.getElementById("focusTemplate");
const skipTemplate = document.getElementById("skipTemplate");

const editSheet = document.getElementById("editSheet");
const editWhen = document.getElementById("editWhen");
const editText = document.getElementById("editText");
const editCancel = document.getElementById("editCancel");
const editSave = document.getElementById("editSave");
const editDelete = document.getElementById("editDelete");

const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");


/* ---------- 3. Settings ---------- */

// Mood number → word. Spot 0 is empty so MOOD_WORDS[4] = "Good".
const MOOD_WORDS = ["", "Hard", "Tough", "Okay", "Good", "Great"];
const TOAST_MS = 3000;


/* ---------- 4. Page state ---------- */

let editingId = null;      // which entry the edit sheet is open for
let toastTimer = null;


/* ---------- 5. Helpers (work things out, never draw) ---------- */

// "2026-10-19" → "Today"   "2026-10-18" → "Yesterday"   older → "Friday 16 October"
function formatDayTitle(date) {
    if (date === todayDate()) return "Today";
    if (date === addDaysTo(todayDate(), -1)) return "Yesterday";
    // "T00:00" = read it as LOCAL midnight (without it the browser uses UTC → can show the wrong day)
    return new Date(date + "T00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

// A timestamp → "21:02"
function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// 4 → "Good"     null → ""
function moodText(mood) {
    return mood ? MOOD_WORDS[mood] : "";
}

// A focus session as one short line:
//   time habit (unit "min")  → "25 min"            (the amount IS the minutes)
//   done/not-done (no unit)  → "25 min"
//   amount habit             → "25 min · 4 pages"
function focusDetail(entry) {
    const parts = [`${entry.minutes} min`];
    if (entry.amount > 0 && entry.unit && entry.unit !== "min") {
        parts.push(`${entry.amount} ${entry.unit}`);
    }
    return parts.join(" · ");
}

// Which mood pill is picked in a group? → 1–5, or null
//   chosenMood("writeMood") → 4
function chosenMood(groupName) {
    const picked = document.querySelector(`input[name="${groupName}"]:checked`);
    return picked ? Number(picked.value) : null;
}

// Tick the right pill (or none) in a group.
//   setMood("editMood", 3) → pill 3 ticked
function setMood(groupName, mood) {
    document.querySelectorAll(`input[name="${groupName}"]`).forEach(input => {
        input.checked = Number(input.value) === mood;
    });
}
/* ---------- 6. Renderers (they draw) ---------- */

// Show the mood tag, or hide it when there is no mood.
function fillMood(card, mood) {
    const tag = card.querySelector(".entry-mood");
    tag.textContent = moodText(mood);
    tag.hidden = !mood;
}

// ✍️ "You wrote · 21:02 · [Good]" + your words + •••
function buildWriteEntry(entry) {
    const card = writeTemplate.content.cloneNode(true).querySelector("li");
    card.dataset.entryId = entry.id;                         // the ••• button finds the id here
    card.querySelector(".entry-time").textContent = formatTime(entry.time);
    card.querySelector(".entry-text").textContent = entry.text;
    fillMood(card, entry.mood);
    return card;
}

// 🎯 "Focus · Read · 17:56 · [Good]" + "25 min · 4 pages" + the note
function buildFocusEntry(entry) {
    const card = focusTemplate.content.cloneNode(true).querySelector("li");
    card.querySelector(".entry-kind").textContent = `Focus · ${entry.habitName}`;
    card.querySelector(".entry-time").textContent = formatTime(entry.time);
    card.querySelector(".entry-detail").textContent = focusDetail(entry);
    const note = card.querySelector(".entry-text");
    note.textContent = entry.note;
    note.hidden = !entry.note;                               // no note? hide the empty line
    fillMood(card, entry.mood);
    return card;
}

// ⏭ "Skipped Run" + "sick"
function buildSkipEntry(entry) {
    const card = skipTemplate.content.cloneNode(true).querySelector("li");
    card.querySelector(".entry-kind").textContent = `Skipped ${entry.habitName}`;
    card.querySelector(".entry-detail").textContent = entry.reason || "No reason given";
    return card;
}

// The picker: which template for which kind?
function buildEntry(entry) {
    if (entry.kind === "write") return buildWriteEntry(entry);
    if (entry.kind === "focus") return buildFocusEntry(entry);
    return buildSkipEntry(entry);
}

// One day: the title + all its cards.
function buildDay(day) {
    const section = dayTemplate.content.cloneNode(true).querySelector("section");
    section.querySelector(".journal-day-title").textContent = formatDayTitle(day.date);
    const list = section.querySelector(".journal-list");
    day.entries.forEach(entry => list.append(buildEntry(entry)));
    return section;
}

// Every day, newest first. Nothing at all? The empty message instead.
function renderJournal() {
    const days = getJournal();
    journalDays.replaceChildren(...days.map(buildDay));     // remove the old days, put the new ones in
    journalEmpty.hidden = days.length > 0;

    // Top bar: "12 entries"  ("1 entry" without the s)
    const total = days.reduce((sum, day) => sum + day.entries.length, 0);
    entryCount.textContent = total === 1 ? "1 entry" : `${total} entries`;
}

function updatePage() {
    renderJournal();
}

/* ---------- 7. Actions (they change data, then redraw) ---------- */

// Save button in the write box.
function saveEntry() {
    const entry = addJournalEntry(writeText.value, chosenMood("writeMood"));
    if (!entry) {                     // empty box → nothing was saved
        writeText.focus();            // put the cursor back in the box
        return;
    }
    writeForm.reset();                // empty the box, untick the mood
    updatePage();                     // redraw: the new card appears
    showToast("Saved");
}

// ••• on one of your entries → open the sheet filled with its words and mood.
function openEdit(id) {
    const entry = getJournalEntries().find(item => item.id === id);
    if (!entry) return;
    editingId = id;                   // remember WHICH entry we're editing
    editWhen.textContent = `${formatDayTitle(entry.date)} · ${formatTime(entry.createdAt)}`;
    editText.value = entry.text;
    setMood("editMood", entry.mood);
    editSheet.showModal();
}

function closeEdit() {
    editSheet.close();
    editingId = null;
}

// Save inside the sheet.
function saveEdit() {
    const text = editText.value.trim();
    if (!text) {                      // emptied it? Delete is the button for that
        editText.focus();
        return;
    }
    updateJournalEntry(editingId, { text, mood: chosenMood("editMood") });
    closeEdit();
    updatePage();
    showToast("Updated");
}

// "Delete this entry" inside the sheet.
function deleteEntry() {
    if (!confirm("Delete this entry? This can't be undone.")) return;   // Cancel → stop here
    deleteJournalEntry(editingId);
    closeEdit();
    updatePage();
    showToast("Deleted");
}

// "Saved" at the bottom for 3 seconds.
function showToast(message) {
    toastText.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);                             // a new toast restarts the 3 seconds
    toastTimer = setTimeout(() => { toast.hidden = true; }, TOAST_MS);
}


/* ---------- 8. Page load ---------- */

if (journalReady) {
    updatePage();
}
/* ---------- 9. Events ---------- */

// The form's Save button.
// preventDefault = DON'T reload the page (what a form does by default).
writeForm.addEventListener("submit", event => {
    event.preventDefault();
    saveEntry();
});

// Ctrl+Enter (Cmd+Enter on a Mac) in the box = Save.  Plain Enter = a new line.
writeText.addEventListener("keydown", event => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        saveEntry();
    }
});

// ONE listener for ALL ••• buttons, even cards drawn later (event delegation, like Today).
journalDays.addEventListener("click", event => {
    const button = event.target.closest('[data-action="edit"]');
    if (!button) return;                                  // clicked something else → ignore
    openEdit(button.closest("[data-entry-id]").dataset.entryId);
});

editCancel.addEventListener("click", closeEdit);
editSave.addEventListener("click", saveEdit);
editDelete.addEventListener("click", deleteEntry);