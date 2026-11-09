/* ╔══════════════════════════════════════════════════════════════╗
   ║  HABITS  ·  js/onboardingPages/habit.js                      ║
   ║  Build the daily habits that move your goal.                 ║
   ╚══════════════════════════════════════════════════════════════╝

   HOW THIS PAGE WORKS
     The builder (top form) makes or edits ONE habit at a time.
     The list (below) holds them in memory: the `habits` array.
     Nothing is saved until Continue → replaceGoalHabits() in state.js.

   TWO JOBS, ONE PAGE
     habit.html              → onboarding: up to 3 habits, Continue → routine.html
     habit.html?mode=edit    → from Plan:  no habit limit, Save → back to Plan
     ?goal=goal-123          → that goal's habits (edit-mode.js getGoalToEdit)
     habit.html?...&add=1    → from Plan's "＋ Add a habit": cursor in the name box

   MAP
     1. Guard       is there a goal?
     2. Elements    every HTML element we use, found once
     3. Settings    named numbers, the area
     4. Page state  the habits list + which one is being edited
     5. Readers     look at the form, answer a question (never change anything)
     6. Renderers   draw the screen
     7. Actions     change something, then redraw
     8. Page load
     9. Events      all at the top level

   Uses: state.js (data) · insight.js (convertAmount: min ↔ hours)
         areas.js (suggestions) · edit-mode.js (editMode, applyEditMode)
   ══════════════════════════════════════════════════════════════════ */


/* ════════════════════ 1. GUARD ════════════════════ */

// Habits belong to a goal. No goal = they skipped a step.
// replace() starts leaving, but the script keeps running,
// so section 8 checks `if (goal)` before using it.
// Which goal? (edit-mode.js: ?goal=… from Plan, otherwise the main goal)
const goal = getGoalToEdit();
if (!goal) {
    window.location.replace(editMode ? PLAN_PAGE : "goal.html");
}


/* ════════════════════ 2. ELEMENTS ════════════════════ */

// ── Goal card ──
const goalName = document.getElementById("goalName");
const goalFinish = document.getElementById("goalFinish");

// ── Builder ──
const habitForm = document.getElementById("habitForm");
const builderHeading = document.getElementById("builderHeading");
const habitName = document.getElementById("habitName");
const habitChips = document.getElementById("habitChips");
const amountField = document.getElementById("amountField");
const amountLabel = document.getElementById("amountLabel");
const habitTarget = document.getElementById("habitTarget");
const habitUnit = document.getElementById("habitUnit");
const habitUnitChips = document.getElementById("habitUnitChips");
const countsField = document.getElementById("countsField");
const habitCounts = document.getElementById("habitCounts");
const countsHint = document.getElementById("countsHint");
const daysRow = document.getElementById("daysRow");
const habitError = document.getElementById("habitError");
const cancelEditButton = document.getElementById("cancelEditButton");
const addHabitButton = document.getElementById("addHabitButton");
const addHabitIcon = document.getElementById("addHabitIcon");
const addHabitText = document.getElementById("addHabitText");

// ── List + footer ──
const habitList = document.getElementById("habitList");
const habitEmpty = document.getElementById("habitEmpty");
const habitCount = document.getElementById("habitCount");
const projection = document.getElementById("projection");
const continueButton = document.getElementById("continueButton");


/* ════════════════════ 3. SETTINGS ════════════════════ */

const MIN_NAME_LENGTH = 2;
const MAX_HABITS = editMode ? Infinity : 3;   // onboarding: 3 (start small) · from Plan: no limit
const TIME_UNITS = ["min", "hours"];
const MINUTES_IN_DAY = 24 * 60;               // 1440: no habit can take longer than a day

// One icon per habit type, for the list.
const TYPE_ICONS = { quantity: "straighten", time: "timer", completion: "task_alt" };

// The GOAL's area → its habit suggestions and units (a Studies goal gets Studies habits).
// Older goals without an area use the Direction's.
const area = getAreaById((goal && goal.area) || getDirection().area);


/* ════════════════════ 4. PAGE STATE ════════════════════
   `let`: these CHANGE while the page is open. The screen is drawn FROM them. */

// The habits so far, in the shape state.js saves:
// { id, goalId, name, type, target, unit, days, countsToGoal, archived, createdAt }
let habits = [];

// The habit being edited in the builder, or null when adding a new one.
let editingId = null;


/* ════════════════════ 5. READERS ════════════════════
   They only LOOK. They never change anything. */

// "quantity", "time" or "completion"
function getType() {
    return habitForm.querySelector('input[name="habitType"]:checked').value;
}

// The ticked days → ["mon", "wed", "fri"]
function getSelectedDays() {
    return [...daysRow.querySelectorAll("input:checked")].map(input => input.value);
}

// Empty box → null, so "empty" and "0" stay different.
function readNumber(input) {
    return input.value.trim() === "" ? null : Number(input.value);
}

// "Memorize New " and "memorize new" → the same name.
function sameName(a, b) {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// Another habit already has this name? (The one being edited may keep its own.)
function nameIsTaken(name) {
    return habits.some(habit => habit.id !== editingId && sameName(habit.name, name));
}

// No room for a new one? (Editing doesn't add, so it's never "full" while editing.)
function listIsFull() {
    return editingId === null && habits.length >= MAX_HABITS;
}

// CAN this habit count toward the goal? Then the checkbox asks "does it?".
//   goal 20 pages · habit 2 pages   → true
//   goal 50 hours · habit 30 min    → true   (min ↔ hours converts)
//   goal 20 pages · habit 15 min    → false  (minutes can't become pages)
//   consistency / milestones goal   → false  (they don't add up amounts)
function canCount() {
    const unit = habitUnit.value.trim();
    return (goal.measure === "total" || goal.measure === "level")
        && getType() !== "completion"
        && unit !== ""
        && convertAmount(1, unit, goal.unit) !== null;
}

// What's wrong with the habit in the builder? A message, or "" when it's ready.
// ONE function decides both the hint and whether "Add habit" works.
function getBuilderProblem() {
    const name = habitName.value.trim();

    if (listIsFull()) {
        return `That's ${MAX_HABITS} habits, the most for now. Remove one to add another.`;
    }
    if (name.length < MIN_NAME_LENGTH) {
        return "Give your habit a name.";
    }
    if (nameIsTaken(name)) {
        return "You already have a habit with this name.";
    }
    if (getType() !== "completion") {
        const target = readNumber(habitTarget);
        if (target === null || !(target > 0)) return "Add how much each day: a number greater than 0.";
        if (habitUnit.value.trim() === "") return "Add a unit, like pages or minutes.";
    }
    // A day has 24 hours. "90 hours a day" is a typo for 90 min.
    if (getType() === "time") {
        const minutes = convertAmount(readNumber(habitTarget), habitUnit.value.trim(), "min");
        if (minutes > MINUTES_IN_DAY) return "That's more than a whole day. Did you mean minutes?";
    }
    if (getSelectedDays().length === 0) {
        return "Pick at least one day.";
    }
    return "";
}

// The goal's finish line in a few words, for the card at the top.
function describeGoalFinish() {
    switch (goal.measure) {
        case "total":      return `${goal.target.toLocaleString()} ${goal.unit} in total`;
        case "level":      return `can do ${goal.target.toLocaleString()} ${goal.unit}`;
        case "milestones": return `${goal.milestones.length} steps`;
        default:           return "stay consistent";
    }
}

// The unit chips depend on the type:
//   time     → min, hours
//   quantity → the goal's unit first (so it can feed the goal), then the area's units
// new Set removes duplicates. "%" is a score, not a daily amount.
function getUnitSuggestions() {
    if (getType() === "time") return TIME_UNITS;
    const fromArea = area ? area.units : [];
    return [...new Set([goal.unit, ...fromArea])]
        .filter(unit => unit && unit !== "%" && !TIME_UNITS.includes(unit));
}


/* ════════════════════ 6. RENDERERS ════════════════════
   They DRAW. User text always goes in with textContent, never innerHTML. */

// ── The goal card at the top ──
function renderGoalCard() {
    goalName.textContent = goal.title;
    goalFinish.textContent = describeGoalFinish();
}

// ── Suggestion chips (from areas.js). dataset.index = which suggestion. ──
function renderHabitChips() {
    habitChips.innerHTML = "";
    (area ? area.habits : []).forEach((suggestion, index) => {
        const chip = document.createElement("button");
        chip.type = "button";                  // must not submit the form
        chip.className = "habit-chip";
        chip.dataset.index = index;
        chip.textContent = suggestion.name;
        habitChips.append(chip);
    });
}

// ── Unit chips ──
function renderUnitChips() {
    habitUnitChips.innerHTML = "";
    getUnitSuggestions().forEach(unit => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "unit-chip";
        chip.dataset.unit = unit;
        chip.textContent = unit;
        habitUnitChips.append(chip);
    });
}

// ── One list row ──
//   [icon]  Memorize new            [edit] [remove]
//           1 pages · Every day
// The buttons carry data-action + data-id, so ONE listener handles every row.
function createHabitItem(habit) {
    const item = document.createElement("li");
    item.className = "habit-item";
    if (habit.id === editingId) item.classList.add("is-editing");

    const icon = document.createElement("span");
    icon.className = "icon habit-item-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = TYPE_ICONS[habit.type];

    const text = document.createElement("div");
    text.className = "habit-item-text";
    const name = document.createElement("span");
    name.className = "habit-item-name";
    name.textContent = habit.name;
    const detail = document.createElement("span");
    detail.className = "habit-item-detail";
    detail.textContent = `${describeHabitAmount(habit)} · ${describeDays(habit.days)}`;   // both in state.js
    text.append(name, detail);

    const edit = createItemButton("edit", "edit", `Edit ${habit.name}`, habit.id);
    const remove = createItemButton("remove", "close", `Remove ${habit.name}`, habit.id);
    remove.classList.add("is-remove");

    item.append(icon, text, edit, remove);
    return item;
}

// A small icon button for a row. aria-label gives it a name for screen readers.
function createItemButton(action, iconName, label, habitId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "habit-item-button";
    button.dataset.action = action;
    button.dataset.id = habitId;
    button.setAttribute("aria-label", label);
    button.innerHTML = `<span class="icon" aria-hidden="true">${iconName}</span>`;   // our own fixed text: safe
    return button;
}

// ── The whole list, redrawn from `habits` ──
function renderHabitList() {
    habitList.innerHTML = "";
    habits.forEach(habit => habitList.append(createHabitItem(habit)));
    habitEmpty.hidden = habits.length > 0;
    // "2 / 3" while setting up · just "4" from Plan (no limit)
    habitCount.textContent = Number.isFinite(MAX_HABITS) ? `${habits.length} / ${MAX_HABITS}` : habits.length;
}

// Add a piece of text, bold or plain. Builds a sentence with <strong>
// parts WITHOUT innerHTML (parts of it are the user's text).
function appendText(element, text, bold = false) {
    const node = bold ? document.createElement("strong") : document.createTextNode("");
    node.textContent = text;
    element.append(node);
}

// ── "At this pace…" (total goals) ──
//   goal 20 pages · habit 1 page × 5 days = 5 pages a week → 20 / 5 = about 4 weeks
function renderProjection() {
    projection.innerHTML = "";
    projection.hidden = habits.length === 0;
    if (habits.length === 0) return;

    // The habits that move the goal's number: ticked "Counts", and a unit that converts.
    const feeding = goal.measure === "total"
        ? habits.filter(habit => habit.type !== "completion"
            && habit.countsToGoal !== false
            && convertAmount(1, habit.unit, goal.unit) !== null)
        : [];

    if (feeding.length === 0) {
        appendText(projection, "These habits are how you'll reach ");
        appendText(projection, `"${goal.title}"`, true);
        appendText(projection, ". Next, you'll give them a time in your day.");
        return;
    }

    // Each habit adds (amount a day, in the goal's unit) × (days a week).
    //   30 min a day toward an hours goal = 0.5 hours a day
    const perWeek = feeding.reduce((sum, habit) =>
        sum + convertAmount(habit.target, habit.unit, goal.unit) * habit.days.length, 0);
    const weeks = Math.ceil(goal.target / perWeek);      // 3.2 weeks → 4
    const rounded = Math.round(perWeek * 10) / 10;      // 2.5, not 2.4999999

    appendText(projection, "At this pace, ");
    appendText(projection, `${rounded.toLocaleString()} ${goal.unit} a week`, true);
    appendText(projection, ", you'll reach ");
    appendText(projection, `${goal.target.toLocaleString()} ${goal.unit}`, true);
    appendText(projection, " in about ");
    appendText(projection, `${weeks} ${weeks === 1 ? "week" : "weeks"}`, true);
    appendText(projection, ".");

    // Has a date? Compare it with the estimate.
    if (goal.deadline) {
        const finish = new Date();
        finish.setDate(finish.getDate() + weeks * 7);
        const [year, month, day] = goal.deadline.split("-").map(Number);
        const deadline = new Date(year, month - 1, day);
        appendText(projection, finish <= deadline
            ? " That's before your target date."
            : " That's after your target date. Try a bigger daily amount or more days.");
    }
}

// ── Redraw everything ──
// Reads the form + page state and makes the WHOLE screen match.
// Every event does its small change, then calls this.
function updatePage() {
    const type = getType();
    const problem = getBuilderProblem();
    const isEditing = editingId !== null;

    // a) Amount: only for Amount / Time habits
    amountField.hidden = type === "completion";
    amountLabel.textContent = type === "time" ? "How long each day?" : "How much each day?";

    // b) Adding vs editing
    habitForm.classList.toggle("is-editing", isEditing);
    builderHeading.textContent = isEditing ? "Editing habit" : "New habit";
    addHabitText.textContent = isEditing ? "Save changes" : "Add habit";
    addHabitIcon.textContent = isEditing ? "check" : "add";
    cancelEditButton.hidden = !isEditing;

    // c) Chips: a suggestion already in the list can't be added twice;
    //    the unit chip matching the unit box looks selected
    habitChips.querySelectorAll(".habit-chip").forEach(chip => {
        chip.disabled = nameIsTaken(chip.textContent);
    });
    habitUnitChips.querySelectorAll(".unit-chip").forEach(chip => {
        const isSelected = chip.dataset.unit === habitUnit.value.trim();
        chip.classList.toggle("is-selected", isSelected);
        chip.setAttribute("aria-pressed", isSelected);
    });

    // d) "Counts toward my goal": only when it CAN count. The hint follows the tick.
    const counts = canCount();
    countsField.hidden = !counts;
    if (counts) {
        countsHint.textContent = habitCounts.checked
            ? `What you log adds to your ${goal.target.toLocaleString()} ${goal.unit}.`
            : "Tracked on its own. Your goal bar won't move.";
    }

    // e) Hint + Add button. The hint waits until a name is typed (no nagging),
    //    except "list is full", shown at once.
    const hasStarted = habitName.value.trim().length >= MIN_NAME_LENGTH;
    habitError.hidden = !(problem && (hasStarted || listIsFull()));
    habitError.textContent = problem;
    addHabitButton.disabled = problem !== "";

    // f) The list, the "At this pace" sentence, Continue
    renderHabitList();
    renderProjection();
    continueButton.disabled = habits.length === 0;
}


/* ════════════════════ 7. ACTIONS ════════════════════
   They CHANGE something, then redraw. */

// ── Builder helpers ──

// Pick a type card from code, and keep the unit sensible:
//   Time with "pages" in the box → "min"
//   Amount with "min" in the box → empty (choose a real unit)
function setType(type) {
    habitForm.querySelector(`input[name="habitType"][value="${type}"]`).checked = true;
    const unit = habitUnit.value.trim();
    if (type === "time" && !TIME_UNITS.includes(unit)) habitUnit.value = "min";
    if (type === "quantity" && TIME_UNITS.includes(unit)) habitUnit.value = "";
    renderUnitChips();
}

// Tick exactly these days, untick the rest.
function setDays(days) {
    daysRow.querySelectorAll("input").forEach(input => {
        input.checked = days.includes(input.value);
    });
}

// A suggestion chip was tapped: fill the builder. They can still change anything.
function applySuggestion(suggestion) {
    habitName.value = suggestion.name;
    setType(suggestion.type);
    habitTarget.value = suggestion.type === "completion" ? "" : suggestion.target;
    habitUnit.value = suggestion.unit;
    setDays(suggestion.days || WEEK_DAYS);              // WEEK_DAYS: state.js
    habitCounts.checked = true;
    updatePage();
}

// Empty the builder, ready for the next habit.
function clearBuilder() {
    habitName.value = "";
    setType("quantity");
    habitTarget.value = "";
    habitUnit.value = "";
    setDays(WEEK_DAYS);
    habitCounts.checked = true;                         // new habits count, unless unticked
}

// Pack the builder into ONE habit object.
// Editing keeps the original id (the routine points at it) and createdAt.
function buildHabitFromForm() {
    const type = getType();
    const original = habits.find(habit => habit.id === editingId);
    return {
        id: original ? original.id : generateId("habit"),
        goalId: goal.id,                                // the Goal → Habit link
        name: habitName.value.trim(),
        type: type,
        target: type === "completion" ? 1 : readNumber(habitTarget),
        unit: type === "completion" ? "" : habitUnit.value.trim(),
        days: getSelectedDays(),
        countsToGoal: canCount() ? habitCounts.checked : true,   // box hidden? the unit already decides
        archived: false,
        createdAt: original ? original.createdAt : Date.now()
    };
}

// A saved habit → the clean shape we keep in the list (drops extra display fields).
// Every field we want to keep must be listed here.
function toStoredHabit(habit) {
    return {
        id: habit.id,
        goalId: habit.goalId,
        name: habit.name,
        type: habit.type,
        target: habit.target,
        unit: habit.unit,
        days: habit.days,
        countsToGoal: habit.countsToGoal !== false,      // old habits have no field → they count
        archived: habit.archived,
        createdAt: habit.createdAt
    };
}

// ── List actions ──

// "Add habit" / "Save changes"
function saveFromBuilder() {
    const habit = buildHabitFromForm();
    if (editingId === null) {
        habits.push(habit);
    } else {
        habits = habits.map(existing => existing.id === editingId ? habit : existing);
        editingId = null;
    }
    clearBuilder();
    updatePage();
    habitName.focus();                                  // ready for another
}

// ✏️ on a row: put that habit into the builder.
function startEditing(habitId) {
    const habit = habits.find(item => item.id === habitId);
    if (!habit) return;
    editingId = habitId;
    habitName.value = habit.name;
    setType(habit.type);
    habitTarget.value = habit.type === "completion" ? "" : habit.target;
    habitUnit.value = habit.unit;
    setDays(habit.days);
    habitCounts.checked = habit.countsToGoal !== false;
    updatePage();
    habitForm.scrollIntoView({ behavior: "smooth", block: "start" });
    habitName.focus({ preventScroll: true });           // don't fight the smooth scroll
}

// "Cancel" in the builder.
function stopEditing() {
    editingId = null;
    clearBuilder();
    updatePage();
}

// ✕ on a row: keep every habit EXCEPT this one.
function removeHabit(habitId) {
    habits = habits.filter(habit => habit.id !== habitId);
    if (editingId === habitId) {
        editingId = null;
        clearBuilder();
    }
    updatePage();
    habitName.focus();                                  // the clicked button is gone
}


/* ════════════════════ 8. PAGE LOAD ════════════════════ */

if (goal) {
    // Coming back (Back, or edit from Plan)? Start from the saved habits.
    habits = getHabitsForGoal(goal.id).map(toStoredHabit);

    // Suggest the goal's unit: a habit in the same unit feeds the goal.
    habitUnit.placeholder = goal.unit || "pages";

    renderGoalCard();
    renderHabitChips();
    renderUnitChips();
    updatePage();

    // From Plan (?mode=edit): Cancel / Save go back to Plan.
    if (editMode) applyEditMode("Editing your habits", continueButton);

    // From Plan's "＋ Add a habit" (?add=1): cursor straight into the name box.
    if (new URLSearchParams(window.location.search).get("add") === "1") habitName.focus();
}


/* ════════════════════ 9. EVENTS ════════════════════
   All at the top level. Lists use event delegation (one listener each). */

// Suggestion chips
habitChips.addEventListener("click", (event) => {
    const chip = event.target.closest(".habit-chip");
    if (!chip || chip.disabled) return;
    applySuggestion(area.habits[chip.dataset.index]);
});

// A type card, a day or the "Counts" box changed
habitForm.addEventListener("change", (event) => {
    if (event.target.name === "habitType") setType(event.target.value);
    updatePage();
});

// Any typing in the builder
habitForm.addEventListener("input", updatePage);

// Unit chips
habitUnitChips.addEventListener("click", (event) => {
    const chip = event.target.closest(".unit-chip");
    if (!chip) return;
    habitUnit.value = chip.dataset.unit;
    updatePage();
});

// Every day / Weekdays / Weekends (the lists come from state.js)
document.querySelector(".day-presets").addEventListener("click", (event) => {
    const preset = event.target.closest(".day-preset");
    if (!preset) return;
    const DAY_PRESETS = { every: WEEK_DAYS, weekdays: WEEKDAYS, weekend: WEEKEND };
    setDays(DAY_PRESETS[preset.dataset.preset]);
    updatePage();
});

// "Add habit" / "Save changes" (button or Enter)
habitForm.addEventListener("submit", (event) => {
    event.preventDefault();                             // don't reload the page
    if (getBuilderProblem()) return;                    // safety net
    saveFromBuilder();
});

cancelEditButton.addEventListener("click", stopEditing);

// ✏️ / ✕ on any row: data-action says WHAT, data-id says WHICH
habitList.addEventListener("click", (event) => {
    const button = event.target.closest(".habit-item-button");
    if (!button) return;
    if (button.dataset.action === "edit") startEditing(button.dataset.id);
    if (button.dataset.action === "remove") removeHabit(button.dataset.id);
});

// Continue / Save: NOW we save, all habits of this goal at once.
continueButton.addEventListener("click", () => {
    if (habits.length === 0) return;
    replaceGoalHabits(goal.id, habits);
    if (editMode) { leaveEditMode(); return; }          // edit: back to Plan
    setCurrentStep(5);
    window.location.href = "routine.html";
});