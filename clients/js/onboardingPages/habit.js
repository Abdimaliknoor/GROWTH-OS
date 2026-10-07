/* =========================================================
   HABIT PAGE  (startup/habit.html)

   What this page does:
     The user builds 1 to 3 daily habits that support their goal.
     The builder (top form) creates or edits ONE habit at a time.
     The list (below) holds the habits made so far.
     Continue saves the whole list with replaceGoalHabits()
     from state.js, then goes to routine.html.

   The big difference from goal.js:
     goal.js edits ONE thing (the goal) straight in the form.
     habit.js keeps a LIST in memory (the `habits` array) and the
     form only works on one item of that list at a time.
     Nothing is saved to localStorage until Continue.

   How this file is organized (same order as goal.js):
     1. Guard      → is the user allowed on this page?
     2. Elements   → grab every HTML element we need, once
     3. Settings   → named numbers, the goal and the area
     4. Page state → the habits list + which one is being edited
     5. Readers    → look at the form and answer a question
     6. Renderers  → draw things on the screen
     7. Actions    → change something, then redraw
     8. Page load  → what runs when the page opens
     9. Events     → connect clicks and typing to actions
   ========================================================= */


/* ---------- 1. Guard ---------- */

// Habits belong to a goal, so no saved goal = they skipped a step.
// getGoals()[0]: onboarding creates exactly one goal.
// Note: replace() starts leaving the page but does NOT stop this script,
// so section 8 checks `if (goal)` before using it.
const goal = getGoals()[0] || null;
if (!goal) {
    window.location.replace("goal.html");
}


/* ---------- 2. Elements ---------- */

const goalName = document.getElementById("goalName");
const goalFinish = document.getElementById("goalFinish");

const habitForm = document.getElementById("habitForm");
const builderHeading = document.getElementById("builderHeading");
const habitName = document.getElementById("habitName");
const habitChips = document.getElementById("habitChips");
const amountField = document.getElementById("amountField");
const amountLabel = document.getElementById("amountLabel");
const habitTarget = document.getElementById("habitTarget");
const habitUnit = document.getElementById("habitUnit");
const habitUnitChips = document.getElementById("habitUnitChips");
const daysRow = document.getElementById("daysRow");
const habitError = document.getElementById("habitError");
const cancelEditButton = document.getElementById("cancelEditButton");
const addHabitButton = document.getElementById("addHabitButton");
const addHabitIcon = document.getElementById("addHabitIcon");
const addHabitText = document.getElementById("addHabitText");

const habitList = document.getElementById("habitList");
const habitEmpty = document.getElementById("habitEmpty");
const habitCount = document.getElementById("habitCount");
const projection = document.getElementById("projection");
const continueButton = document.getElementById("continueButton");


/* ---------- 3. Settings ---------- */

const MIN_NAME_LENGTH = 2;
const MAX_HABITS = 3;                    // "One habit is enough to start. Add up to 3."
const TIME_UNITS = ["min", "hours"];

// The area picked on the Direction page → its habit suggestions and units.
const area = getAreaById(getDirection().area);

// One icon per habit type, used in the list.
const TYPE_ICONS = { quantity: "straighten", time: "timer", completion: "task_alt" };


/* ---------- 4. Page state ----------
   `let`, not `const`, because these CHANGE while the page is open.
   This is the page's memory. The screen is drawn FROM these values. */

// The habits made so far. Each one has the shape state.js expects:
// { id, goalId, name, type, target, unit, days, log, archived, createdAt }
let habits = [];

// The id of the habit being edited in the builder, or null when adding a new one.
let editingId = null;


/* ---------- 5. Readers: they only LOOK, never change anything ---------- */

// Which type card is selected: "quantity", "time" or "completion".
function getType() {
    return habitForm.querySelector('input[name="habitType"]:checked').value;
}

// The ticked days, e.g. ["mon", "wed", "fri"].
// :checked finds only ticked checkboxes; .map reads each one's value.
function getSelectedDays() {
    return [...daysRow.querySelectorAll("input:checked")].map(input => input.value);
}

// Same as goal.js: empty box → null, so "empty" and "0" stay different.
function readNumber(input) {
    return input.value.trim() === "" ? null : Number(input.value);
}

// Compare names without caring about capitals or spaces:
// "Memorize New " and "memorize new" count as the same habit.
function sameName(a, b) {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// Is there already a habit in the list with this name?
// The habit being edited doesn't count (it's allowed to keep its own name).
function nameIsTaken(name) {
    return habits.some(habit => habit.id !== editingId && sameName(habit.name, name));
}

// Is the list full? (Editing doesn't add, so it's never "full" while editing.)
function listIsFull() {
    return editingId === null && habits.length >= MAX_HABITS;
}

// What's wrong with the habit in the builder? A message, or "" if it's ready.
// Same idea as getProblem() in goal.js: ONE function decides both the
// hint text and whether the Add button works.
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
//   quantity → the goal's unit first (so the habit can feed the goal),
//              then the area's units. "%" is a score, not a daily amount.
// new Set(...) removes duplicates, then [...] turns it back into an array.
function getUnitSuggestions() {
    if (getType() === "time") return TIME_UNITS;
    const fromArea = area ? area.units : [];
    return [...new Set([goal.unit, ...fromArea])]
        .filter(unit => unit && unit !== "%" && !TIME_UNITS.includes(unit));
}


/* ---------- 6. Renderers: they DRAW things on the screen ---------- */

// The goal card at the top. textContent: the title is the user's text.
function renderGoalCard() {
    goalName.textContent = goal.title;
    goalFinish.textContent = describeGoalFinish();
}

// One button per suggested habit from areas.js.
// dataset.index remembers which suggestion each button is.
function renderHabitChips() {
    habitChips.innerHTML = "";
    (area ? area.habits : []).forEach((suggestion, index) => {
        const chip = document.createElement("button");
        chip.type = "button";                  // must not submit the builder form
        chip.className = "habit-chip";
        chip.dataset.index = index;
        chip.textContent = suggestion.name;
        habitChips.append(chip);
    });
}

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

// Builds ONE list row:  [icon]  Name               [edit] [remove]
//                               1 pages · Every day
// User text (name, unit) goes in with textContent, never innerHTML.
// The buttons carry data-action + data-id, so ONE click listener on the
// list can tell which button of which habit was clicked (delegation).
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
    // describeHabitAmount + describeDays live in state.js, because the
    // Routine page and the Dashboard will describe habits the same way.
    detail.textContent = `${describeHabitAmount(habit)} · ${describeDays(habit.days)}`;
    text.append(name, detail);

    const edit = createItemButton("edit", "edit", `Edit ${habit.name}`, habit.id);
    const remove = createItemButton("remove", "close", `Remove ${habit.name}`, habit.id);
    remove.classList.add("is-remove");

    item.append(icon, text, edit, remove);
    return item;
}

// A small icon button for a list row.
// aria-label gives it a name ("Edit Memorize new"), because an icon
// alone means nothing to a screen reader.
function createItemButton(action, iconName, label, habitId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "habit-item-button";
    button.dataset.action = action;
    button.dataset.id = habitId;
    button.setAttribute("aria-label", label);
    button.innerHTML = `<span class="icon" aria-hidden="true">${iconName}</span>`; // our fixed text: safe
    return button;
}

// Redraw the whole list from the `habits` array.
// With at most 3 items, redrawing everything is simplest and never goes out of sync.
function renderHabitList() {
    habitList.innerHTML = "";
    habits.forEach(habit => habitList.append(createHabitItem(habit)));
    habitEmpty.hidden = habits.length > 0;
    habitCount.textContent = `${habits.length} / ${MAX_HABITS}`;
}

// Adds a piece of text to an element, bold or normal.
// Lets us build a sentence with <strong> parts WITHOUT innerHTML,
// because parts of it (the unit) are the user's text.
function appendText(element, text, bold = false) {
    const node = bold ? document.createElement("strong") : document.createTextNode("");
    node.textContent = text;
    element.append(node);
}

// THE GOAL → HABIT CONNECTION, as a sentence.
// For "total" goals: if some habits use the same unit as the goal,
// add up what they do in a week and work out how many weeks to finish.
//   Example: goal 20 pages · habit 1 page × 5 days = 5 pages a week
//            20 / 5 = 4 → "about 4 weeks"
function renderProjection() {
    projection.innerHTML = "";
    projection.hidden = habits.length === 0;
    if (habits.length === 0) return;

    // Habits that move the goal's number: same unit, and not done/not habits.
    const feeding = goal.measure === "total"
        ? habits.filter(habit => habit.type !== "completion" && sameName(habit.unit, goal.unit))
        : [];

    if (feeding.length === 0) {
        appendText(projection, "These habits are how you'll reach ");
        appendText(projection, `"${goal.title}"`, true);
        appendText(projection, ". Next, you'll give them a time in your day.");
        return;
    }

    // reduce: walk the list and keep a running total. Starts at 0.
    // Each habit adds (amount per day × number of days per week).
    const perWeek = feeding.reduce((sum, habit) => sum + habit.target * habit.days.length, 0);
    const weeks = Math.ceil(goal.target / perWeek);      // ceil: 3.2 weeks → 4 weeks
    const rounded = Math.round(perWeek * 10) / 10;      // 2.5, not 2.4999999

    appendText(projection, "At this pace, ");
    appendText(projection, `${rounded.toLocaleString()} ${goal.unit} a week`, true);
    appendText(projection, ", you'll reach ");
    appendText(projection, `${goal.target.toLocaleString()} ${goal.unit}`, true);
    appendText(projection, " in about ");
    appendText(projection, `${weeks} ${weeks === 1 ? "week" : "weeks"}`, true);
    appendText(projection, ".");

    // If the goal has a date, compare it with the estimate.
    if (goal.deadline) {
        const finish = new Date();
        finish.setDate(finish.getDate() + weeks * 7);    // today + the weeks needed
        const [year, month, day] = goal.deadline.split("-").map(Number);
        const deadline = new Date(year, month - 1, day);
        appendText(projection, finish <= deadline
            ? " That's before your target date."
            : " That's after your target date. Try a bigger daily amount or more days.");
    }
}

// THE HEART OF THE FILE (same pattern as goal.js).
// Reads the form + the page state and makes the WHOLE screen match.
// Every event changes something small, then calls updatePage().
function updatePage() {
    const type = getType();
    const problem = getBuilderProblem();
    const isEditing = editingId !== null;

    // a) Builder: amount only for amount/time habits
    amountField.hidden = type === "completion";
    amountLabel.textContent = type === "time" ? "How long each day?" : "How much each day?";

    // b) Builder: adding vs editing
    habitForm.classList.toggle("is-editing", isEditing);
    builderHeading.textContent = isEditing ? "Editing habit" : "New habit";
    addHabitText.textContent = isEditing ? "Save changes" : "Add habit";
    addHabitIcon.textContent = isEditing ? "check" : "add";
    cancelEditButton.hidden = !isEditing;

    // c) Chips: suggestions already in the list can't be added twice;
    //    the unit chip matching the unit box looks selected
    habitChips.querySelectorAll(".habit-chip").forEach(chip => {
        chip.disabled = nameIsTaken(chip.textContent);
    });
    habitUnitChips.querySelectorAll(".unit-chip").forEach(chip => {
        const isSelected = chip.dataset.unit === habitUnit.value.trim();
        chip.classList.toggle("is-selected", isSelected);
        chip.setAttribute("aria-pressed", isSelected);
    });

    // d) Hint + Add button. The hint waits until they've typed a name
    //    (no nagging on page load), except "list is full", shown at once.
    const hasStarted = habitName.value.trim().length >= MIN_NAME_LENGTH;
    habitError.hidden = !(problem && (hasStarted || listIsFull()));
    habitError.textContent = problem;
    addHabitButton.disabled = problem !== "";

    // e) The list, the connection sentence, and Continue
    renderHabitList();
    renderProjection();
    continueButton.disabled = habits.length === 0;
}


/* ---------- 7. Actions: they CHANGE something ---------- */

// Select a type card from code, and fix the unit so it makes sense:
//   switching to Time with "pages" in the box → "min"
//   switching to Amount with "min" in the box → empty (choose a real unit)
// The unit chips change with the type, so they're redrawn here.
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

// A suggestion chip was tapped: fill the builder from it.
// The user can still change anything before pressing Add.
function applySuggestion(suggestion) {
    habitName.value = suggestion.name;
    setType(suggestion.type);
    habitTarget.value = suggestion.type === "completion" ? "" : suggestion.target;
    habitUnit.value = suggestion.unit;
    setDays(suggestion.days || WEEK_DAYS);   // WEEK_DAYS comes from state.js
    updatePage();
}

// Empty the builder, ready for a new habit.
function clearBuilder() {
    habitName.value = "";
    setType("quantity");
    habitTarget.value = "";
    habitUnit.value = "";
    setDays(WEEK_DAYS);
}

// Pack the builder into one habit object, the shape state.js expects.
// When editing, keep the id, log and createdAt of the original:
// the id matters because the Routine page will point at it (habitId).
function buildHabitFromForm() {
    const type = getType();
    const original = habits.find(habit => habit.id === editingId);
    return {
        id: original ? original.id : generateId("habit"),
        goalId: goal.id,                                   // ← the Goal → Habit link
        name: habitName.value.trim(),
        type: type,
        target: type === "completion" ? 1 : readNumber(habitTarget),
        unit: type === "completion" ? "" : habitUnit.value.trim(),
        days: getSelectedDays(),
        log: original ? original.log : {},
        archived: false,
        createdAt: original ? original.createdAt : Date.now()
    };
}

// The builder form was submitted: add a new habit, or save the edited one.
function saveFromBuilder() {
    const habit = buildHabitFromForm();
    if (editingId === null) {
        habits.push(habit);                                // add at the end
    } else {
        // map: copy the list, swapping the edited habit for the new version
        habits = habits.map(existing => existing.id === editingId ? habit : existing);
        editingId = null;
    }
    clearBuilder();
    updatePage();
    habitName.focus();                                     // ready to add another
}

// Put a habit from the list into the builder for editing.
function startEditing(habitId) {
    const habit = habits.find(item => item.id === habitId);
    if (!habit) return;
    editingId = habitId;
    habitName.value = habit.name;
    setType(habit.type);
    habitTarget.value = habit.type === "completion" ? "" : habit.target;
    habitUnit.value = habit.unit;
    setDays(habit.days);
    updatePage();
    habitForm.scrollIntoView({ behavior: "smooth", block: "start" });
    habitName.focus({ preventScroll: true });              // don't fight the smooth scroll
}

function stopEditing() {
    editingId = null;
    clearBuilder();
    updatePage();
}

// filter: keep every habit EXCEPT the removed one.
// If it was the one being edited, leave edit mode too.
function removeHabit(habitId) {
    habits = habits.filter(habit => habit.id !== habitId);
    if (editingId === habitId) {
        editingId = null;
        clearBuilder();
    }
    updatePage();
    habitName.focus();      // the clicked button is gone, so put focus somewhere sensible
}

// Turn a habit from getHabitsForGoal() (which has extra display fields
// like `detail` and `todayAmount`) back into the clean shape we store.
function toStoredHabit(habit) {
    return {
        id: habit.id,
        goalId: habit.goalId,
        name: habit.name,
        type: habit.type,
        target: habit.target,
        unit: habit.unit,
        days: habit.days,
        log: habit.log,
        archived: habit.archived,
        createdAt: habit.createdAt
    };
}


/* ---------- 8. Page load ---------- */

if (goal) {
    // Coming back from Routine? Load the habits already saved for this goal.
    habits = getHabitsForGoal(goal.id).map(toStoredHabit);

    // If the goal has a unit, suggest it: a habit in the same unit feeds the goal.
    habitUnit.placeholder = goal.unit || "pages";

    renderGoalCard();
    renderHabitChips();
    renderUnitChips();
    updatePage();
}


/* ---------- 9. Events ---------- */

// Suggestion chips (event delegation, like goal.js).
habitChips.addEventListener("click", (event) => {
    const chip = event.target.closest(".habit-chip");
    if (!chip || chip.disabled) return;
    applySuggestion(area.habits[chip.dataset.index]);
});

// "change": a type card or a day was picked.
habitForm.addEventListener("change", (event) => {
    if (event.target.name === "habitType") setType(event.target.value);
    updatePage();
});

// "input": any typing in the builder.
habitForm.addEventListener("input", updatePage);

habitUnitChips.addEventListener("click", (event) => {
    const chip = event.target.closest(".unit-chip");
    if (!chip) return;
    habitUnit.value = chip.dataset.unit;
    updatePage();
});

// Every day / Weekdays / Weekends. The day lists come from state.js.
document.querySelector(".day-presets").addEventListener("click", (event) => {
    const preset = event.target.closest(".day-preset");
    if (!preset) return;
    const DAY_PRESETS = { every: WEEK_DAYS, weekdays: WEEKDAYS, weekend: WEEKEND };
    setDays(DAY_PRESETS[preset.dataset.preset]);
    updatePage();
});

// Add habit / Save changes (button or Enter key).
habitForm.addEventListener("submit", (event) => {
    event.preventDefault();                  // stop the page reloading
    if (getBuilderProblem()) return;         // safety net
    saveFromBuilder();
});

cancelEditButton.addEventListener("click", stopEditing);

// Edit / remove buttons in the list. One listener for all rows:
// data-action says WHAT, data-id says WHICH habit.
habitList.addEventListener("click", (event) => {
    const button = event.target.closest(".habit-item-button");
    if (!button) return;
    if (button.dataset.action === "edit") startEditing(button.dataset.id);
    if (button.dataset.action === "remove") removeHabit(button.dataset.id);
});

// Continue: NOW we save, all habits of this goal at once.
continueButton.addEventListener("click", () => {
    if (habits.length === 0) return;
    replaceGoalHabits(goal.id, habits);      // state.js does the saving
    setCurrentStep(5);
    window.location.href = "routine.html";
});