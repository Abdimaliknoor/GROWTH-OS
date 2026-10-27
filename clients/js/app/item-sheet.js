/* ╔══════════════════════════════════════════════════════════════╗
   ║  SCHEDULE SHEET  ·  js/app/item-sheet.js                     ║
   ║  Add or change a schedule item, from any page.               ║
   ╚══════════════════════════════════════════════════════════════╝

   One sheet, used by Today and Plan:
     openAddItem(onDone)        → empty sheet
     openEditItem(id, onDone)   → the sheet filled with that item
   After Save / Remove it calls onDone("Added for Tomorrow"), so the page
   that opened it can redraw itself and show a toast. The sheet never
   needs to know WHICH page it is on.

   LOAD   storage → state → insight → item-sheet.js → the page's script
   ══════════════════════════════════════════════════════════════════ */


/* ════════════════════ 1. BUILD THE SHEET (once) ════════════════════ */

const itemSheet = document.createElement("dialog");
itemSheet.className = "sheet";
itemSheet.id = "itemSheet";
itemSheet.setAttribute("aria-labelledby", "itemTitle");
// Our own fixed markup: safe. Your words go in later with .value / textContent.
itemSheet.innerHTML = `
    <h2 class="sheet-title" id="itemTitle"></h2>
    <p class="sheet-habit" id="itemHint"></p>

    <div class="item-field" id="itemLabelBox">
        <label class="sheet-label" for="itemLabel">What?</label>
        <input class="sheet-note item-input" id="itemLabel" type="text" maxlength="40"
               placeholder="e.g. Class, Exam, Gym" autocomplete="off" />
    </div>

    <div class="item-field" id="itemNoteBox">
        <label class="sheet-label" for="itemNote">Note <span class="sheet-optional">(optional)</span></label>
        <input class="sheet-note item-input" id="itemNote" type="text" maxlength="80"
               placeholder="e.g. Bring the printed assignment" autocomplete="off" />
    </div>

    <div class="item-field">
        <label class="sheet-label" for="itemTime">Time</label>
        <input class="sheet-note item-input item-time-input" id="itemTime" type="time" />
    </div>

    <div class="item-field">
        <p class="sheet-label" id="itemRepeatLabel">When?</p>
        <div class="item-repeat" id="itemRepeat" role="group" aria-labelledby="itemRepeatLabel">
            <button class="chip" type="button" data-repeat="once">One day</button>
            <button class="chip" type="button" data-repeat="every">Every day</button>
            <button class="chip" type="button" data-repeat="weekdays">Weekdays</button>
            <button class="chip" type="button" data-repeat="weekend">Weekend</button>
        </div>
        <label class="visually-hidden" for="itemDate">Date</label>
        <input class="sheet-note item-input item-date" id="itemDate" type="date" hidden />
    </div>

    <div class="sheet-actions">
        <button class="btn btn-ghost" id="itemCancel" type="button">Cancel</button>
        <button class="btn btn-primary" id="itemSave" type="button">Save</button>
    </div>

    <button class="item-remove" id="itemRemove" type="button" hidden>Remove from schedule</button>`;
document.body.append(itemSheet);

const itemTitle = document.getElementById("itemTitle");
const itemHint = document.getElementById("itemHint");
const itemLabelBox = document.getElementById("itemLabelBox");
const itemLabel = document.getElementById("itemLabel");
const itemNoteBox = document.getElementById("itemNoteBox");
const itemNote = document.getElementById("itemNote");
const itemTime = document.getElementById("itemTime");
const itemRepeat = document.getElementById("itemRepeat");
const itemDate = document.getElementById("itemDate");
const itemCancel = document.getElementById("itemCancel");
const itemSave = document.getElementById("itemSave");
const itemRemove = document.getElementById("itemRemove");


/* ════════════════════ 2. SETTINGS + STATE ════════════════════ */

// "When?" chips → days. ("once" uses a date instead.)
const REPEAT_DAYS = { every: WEEK_DAYS, weekdays: WEEKDAYS, weekend: WEEKEND };

let editingItemId = null;            // null = adding a new item
let itemRepeatChoice = "once";       // once / every / weekdays / weekend / custom
let itemDone = null;                 // the page's "redraw + toast" function


/* ════════════════════ 3. HELPERS ════════════════════ */

// Which chip fits an item?   a date → "once"   WEEKDAYS → "weekdays"   other days → "custom"
function repeatOf(item) {
    if (item.date) return "once";
    const key = Object.keys(REPEAT_DAYS).find(name => REPEAT_DAYS[name].join() === item.days.join());
    return key || "custom";
}

// Select one chip. "One day" also shows the date box.
function chooseRepeat(choice) {
    itemRepeatChoice = choice;
    itemDate.hidden = choice !== "once";
    itemRepeat.querySelectorAll("[data-repeat]").forEach(chip => {
        chip.setAttribute("aria-pressed", chip.dataset.repeat === choice);
    });
}


/* ════════════════════ 4. OPEN ════════════════════ */

// Empty sheet. Starts on "One day · today": most things you add are one-offs.
function openAddItem(onDone) {
    itemDone = onDone;
    editingItemId = null;
    itemTitle.textContent = "Add to your schedule";
    itemHint.textContent = "Class, an exam, a reminder… today, another day, or every week.";
    itemLabelBox.hidden = false;
    itemLabel.value = "";
    itemNoteBox.hidden = false;
    itemNote.value = "";
    itemTime.value = "";
    itemDate.value = todayDate();
    itemDate.min = todayDate();
    chooseRepeat("once");
    itemRemove.hidden = true;
    itemSheet.showModal();
    itemLabel.focus();
}

// The same sheet, filled in. Wake up / Sleep: only time and days.
function openEditItem(id, onDone) {
    const item = getRoutine().find(entry => entry.id === id);
    if (!item) return;
    itemDone = onDone;
    const isActivity = item.kind === "activity";
    editingItemId = id;
    itemTitle.textContent = isActivity ? "Change this" : item.label;
    itemHint.textContent = isActivity ? "Change the name, note, time or days." : "Change the time or the days.";
    itemLabelBox.hidden = !isActivity;
    itemLabel.value = item.label;
    itemNoteBox.hidden = !isActivity;
    itemNote.value = item.note || "";
    itemTime.value = item.time;
    itemDate.value = item.date || todayDate();
    itemDate.min = todayDate();
    chooseRepeat(repeatOf(item));
    itemRemove.hidden = !isActivity;
    itemSheet.showModal();
}


/* ════════════════════ 5. SAVE / REMOVE ════════════════════ */

function saveItemSheet() {
    const label = itemLabel.value.trim();
    if (!itemLabelBox.hidden && !label) { itemLabel.focus(); return; }
    if (!itemTime.value) { itemTime.focus(); return; }

    // "One day" → that date, no days.  A repeat → days, no date.
    const once = itemRepeatChoice === "once";
    const repeat = once
        ? { days: [], date: itemDate.value || todayDate() }
        : { days: REPEAT_DAYS[itemRepeatChoice], date: null };

    if (editingItemId) {
        // "custom" (e.g. only Mondays): keep the days it already had
        const changes = itemRepeatChoice === "custom" ? { time: itemTime.value } : { time: itemTime.value, ...repeat };
        if (!itemLabelBox.hidden) changes.label = label;
        if (!itemNoteBox.hidden) changes.note = itemNote.value.trim();
        updateRoutineItem(editingItemId, changes);
        finishItem("Changed");
    } else {
        addRoutineItem({ label, time: itemTime.value, note: itemNote.value, ...repeat });
        const later = once && repeat.date !== todayDate();
        finishItem(later ? `Added for ${describeUpcomingDay(repeat.date)}` : once ? "Added for today" : "Added to your schedule");
    }
}

function removeItemSheet() {
    if (!confirm("Remove this from your schedule?")) return;
    removeRoutineItem(editingItemId);
    finishItem("Removed");
}

// Close, then hand back to the page that opened the sheet.
function finishItem(message) {
    itemSheet.close();
    editingItemId = null;
    if (itemDone) itemDone(message);
}


/* ════════════════════ 6. EVENTS ════════════════════ */

itemRepeat.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-repeat]");
    if (chip) chooseRepeat(chip.dataset.repeat);
});
itemSave.addEventListener("click", saveItemSheet);
itemCancel.addEventListener("click", () => itemSheet.close());
itemRemove.addEventListener("click", removeItemSheet);
itemLabel.addEventListener("keydown", (event) => {           // Enter in the name = Save
    if (event.key === "Enter") {
        event.preventDefault();
        saveItemSheet();
    }
});