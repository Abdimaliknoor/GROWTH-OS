/* =========================================================
   GOAL PAGE  (startup/goal.html)

   What this page does:
     The user names ONE goal and says what "done" looks like.
     We save it with saveGoal() from state.js, then go to habit.html.

   How this file is organized (read it top to bottom):
     1. Guard      → is the user allowed on this page?
     2. Elements   → grab every HTML element we need, once
     3. Settings   → named numbers and the data we start from
     4. Readers    → look at the form and answer a question
     5. Renderers  → draw things on the screen
     6. Actions    → change something, then redraw
     7. Page load  → what runs when the page opens
     8. Events     → connect clicks and typing to actions
   ========================================================= */


/* ---------- 1. Guard ---------- */

// No saved direction means the user skipped the Direction step.
// replace() (not href) removes this page from history, so the
// browser's Back button can't bounce them into a loop.
const direction = getDirection();
if (!direction.area) {
    window.location.replace("identity.html");
}


/* ---------- 2. Elements ---------- */

// Looked up ONCE here. Searching the page every time we need
// an element would be slower and repeat the same line everywhere.
const goalForm = document.getElementById("goalForm");
const goalTitle = document.getElementById("goalTitle");
const goalChips = document.getElementById("goalChips");
const numberDetails = document.getElementById("numberDetails");
const finishLead = document.getElementById("finishLead");
const finishTail = document.getElementById("finishTail");
const targetInput = document.getElementById("targetInput");
const unitInput = document.getElementById("unitInput");
const unitChips = document.getElementById("unitChips");
const currentField = document.getElementById("currentField");
const currentInput = document.getElementById("currentInput");
const stepsDetails = document.getElementById("stepsDetails");
const stepsList = document.getElementById("stepsList");
const addStepButton = document.getElementById("addStepButton");
const consistencyNote = document.getElementById("consistencyNote");
const whyInput = document.getElementById("whyInput");
const deadlineInput = document.getElementById("deadlineInput");
const goalHint = document.getElementById("goalError");
const continueButton = document.getElementById("continueButton");

const preview = document.getElementById("goalPreview");
const previewTitle = document.getElementById("previewTitle");
const previewMeasure = document.getElementById("previewMeasure");
const previewWhy = document.getElementById("previewWhy");
const previewDate = document.getElementById("previewDate");


/* ---------- 3. Settings ---------- */

// Named constants: "steps < MIN_STEPS" explains itself,
// "steps < 2" makes the reader guess what 2 means.
const MIN_TITLE_LENGTH = 3;
const MIN_STEPS = 2;
const MAX_STEPS = 8;
const FALLBACK_UNITS = ["pages", "hours", "times"];   // for "Something else" areas

// The area they picked on the Direction page (from areas.js).
const area = getAreaById(direction.area);

// The goal they already saved, if they came back with Back.
// null the first time. Onboarding only ever creates one goal.
const existingGoal = getGoals()[0] || null;


/* ---------- 4. Readers: they only LOOK, never change anything ---------- */

// Today's date as "YYYY-MM-DD" in LOCAL time.
// Why not new Date().toISOString()? That gives the date in UTC.
// Kenya is UTC+3, so between 00:00 and 03:00 it would say YESTERDAY.
function todayLocal() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");  // months start at 0
    const day = String(now.getDate()).padStart(2, "0");         // 6 → "06"
    return `${now.getFullYear()}-${month}-${day}`;
}

// "2027-03-31" → "31 Mar 2027", for showing to people.
function formatDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day)
        .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Which measure card is selected: "consistency", "total", "level" or "milestones".
function getMeasure() {
    return goalForm.querySelector('input[name="measure"]:checked').value;
}

// Only "total" and "level" need a number + unit.
function usesNumber() {
    const measure = getMeasure();
    return measure === "total" || measure === "level";
}

// The number in a box, or null if the box is empty.
// Why not just Number(input.value)? Because Number("") is 0, so an
// empty box and someone typing "0" would look the same. They aren't.
function readNumber(input) {
    return input.value.trim() === "" ? null : Number(input.value);
}

// The steps the user typed, with empty boxes skipped.
// [...list] turns the list of inputs into a real array so we can
// use .map (get each value) and .filter (drop the empty ones).
function getSteps() {
    return [...stepsList.querySelectorAll("input")]
        .map(input => input.value.trim())
        .filter(text => text.length > 0);
}

// What is still missing? Returns a message, or "" when all is good.
// Rules are checked in order and the FIRST problem is returned.
// Both the hint text AND the Continue button use this one function,
// so they can never disagree with each other.
function getProblem() {
    if (goalTitle.value.trim().length < MIN_TITLE_LENGTH) {
        return "Give your goal a name.";
    }
    if (usesNumber()) {
        const target = readNumber(targetInput);
        if (target === null || !(target > 0)) return "Add your finish line: a number greater than 0.";
        if (unitInput.value.trim() === "") return "Add a unit, like pages or km.";
        const current = readNumber(currentInput);
        if (current !== null && current < 0) return "Where you are now can't be below 0.";
    }
    if (getMeasure() === "milestones" && getSteps().length < MIN_STEPS) {
        return `Add at least ${MIN_STEPS} steps.`;
    }
    // "YYYY-MM-DD" strings sort like dates, so < works on them directly.
    if (deadlineInput.value && deadlineInput.value < todayLocal()) {
        return "Pick a target date from today onwards.";
    }
    return "";
}


/* ---------- 5. Renderers: they DRAW things on the screen ---------- */

// The goal suggestion buttons, from area.goals in areas.js.
// dataset.index remembers WHICH suggestion each button is,
// so the click handler can look it up later.
function renderGoalChips() {
    goalChips.innerHTML = "";
    (area ? area.goals : []).forEach((suggestion, index) => {
        const chip = document.createElement("button");
        chip.type = "button";            // "button", not "submit": must not submit the form
        chip.className = "goal-chip";
        chip.dataset.index = index;
        chip.textContent = suggestion.title;
        goalChips.append(chip);
    });
}

// The unit buttons (pages, rub', juz...). Areas without their
// own list (like "Something else") get FALLBACK_UNITS.
function renderUnitChips() {
    const units = area && area.units.length ? area.units : FALLBACK_UNITS;
    unitChips.innerHTML = "";
    units.forEach(unit => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "unit-chip";
        chip.dataset.unit = unit;
        chip.textContent = unit;
        unitChips.append(chip);
    });
}

// Clear the step list, then draw one row per text.
function renderSteps(stepTexts) {
    stepsList.innerHTML = "";
    stepTexts.forEach(text => addStepRow(text));
    updateStepButtons();
}

// Build ONE step row: a text box + a remove (×) button.
// Steps hold the USER's text, so it goes in .value, never innerHTML.
// (innerHTML with user text = XSS, remember the Direction page.)
// Returns the input so the caller can focus it.
function addStepRow(text = "") {
    const row = document.createElement("li");
    row.className = "step-row";

    const input = document.createElement("input");
    input.className = "ob-input";
    input.type = "text";
    input.maxLength = 60;
    input.placeholder = "Describe this step";
    input.value = text;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "step-remove";
    remove.innerHTML = '<span class="icon" aria-hidden="true">close</span>'; // our own fixed markup: safe

    row.append(input, remove);
    stepsList.append(row);
    return input;
}

// After rows are added or removed:
//   - relabel them "Step 1", "Step 2"... (for screen readers)
//   - hide × when only MIN_STEPS are left (can't go below 2)
//   - hide "Add a step" at MAX_STEPS
function updateStepButtons() {
    const rows = stepsList.querySelectorAll(".step-row");
    rows.forEach((row, index) => {
        row.querySelector("input").setAttribute("aria-label", `Step ${index + 1}`);
        const remove = row.querySelector(".step-remove");
        remove.setAttribute("aria-label", `Remove step ${index + 1}`);
        remove.disabled = rows.length <= MIN_STEPS;
    });
    addStepButton.disabled = rows.length >= MAX_STEPS;
}

// The "Finish line: ..." sentence in the preview.
// Always finish-line language, so a goal never reads like a daily habit.
function describeMeasure() {
    const target = readNumber(targetInput);
    const unit = unitInput.value.trim();
    const amount = target !== null ? `${target.toLocaleString()} ${unit}`.trim() : "…";
    //                                 ↑ 50000 → "50,000"

    switch (getMeasure()) {
        case "total":
            return `Finish line: ${amount} in total`;
        case "level": {
            const current = readNumber(currentInput);
            const now = current !== null ? ` · now at ${current.toLocaleString()} ${unit}` : "";
            return `Finish line: can do ${amount}${now}`;
        }
        case "milestones": {
            const count = getSteps().length;
            if (count === 0) return "Finish line: all your steps completed";
            return `Finish line: ${count} ${count === 1 ? "step" : "steps"} completed`;
        }
        default:
            return "Finish line: no number, done by staying consistent";
    }
}

// THE HEART OF THE FILE.
// Reads the whole form and makes the WHOLE screen match it.
// It doesn't care what the user just did. That's why every event
// below only does its own small change and then calls updatePage().
function updatePage() {
    const measure = getMeasure();
    const title = goalTitle.value.trim();
    const problem = getProblem();

    // a) Which detail panel is visible
    numberDetails.hidden = !usesNumber();
    currentField.hidden = measure !== "level";
    finishLead.textContent = measure === "level" ? "Done when I can do" : "Done when I've reached";
    finishTail.hidden = measure !== "total";            // "in total" only makes sense for totals
    stepsDetails.hidden = measure !== "milestones";
    consistencyNote.hidden = measure !== "consistency";

    // b) Which chips look selected (the one matching what's typed)
    goalChips.querySelectorAll(".goal-chip").forEach(chip => {
        const isSelected = chip.textContent === title;
        chip.classList.toggle("is-selected", isSelected);
        chip.setAttribute("aria-pressed", isSelected);  // screen readers hear "pressed"
    });
    unitChips.querySelectorAll(".unit-chip").forEach(chip => {
        const isSelected = chip.dataset.unit === unitInput.value.trim();
        chip.classList.toggle("is-selected", isSelected);
        chip.setAttribute("aria-pressed", isSelected);
    });

    // c) The preview card
    preview.hidden = title.length < MIN_TITLE_LENGTH;
    previewTitle.textContent = title;
    previewMeasure.textContent = describeMeasure();
    previewWhy.textContent = whyInput.value.trim() ? `"${whyInput.value.trim()}"` : "";
    previewDate.textContent = deadlineInput.value ? `By ${formatDate(deadlineInput.value)}` : "";

    // d) Hint + Continue button.
    // The hint waits until a name is typed: no nagging on page load.
    goalHint.hidden = !(problem && title.length >= MIN_TITLE_LENGTH);
    goalHint.textContent = problem;
    continueButton.disabled = problem !== "";
}


/* ---------- 6. Actions: they CHANGE something ---------- */

// Select a measure card from code (radio.checked = true).
// The first time "steps" is picked, give them 2 empty rows to start.
function setMeasure(measure) {
    goalForm.querySelector(`input[name="measure"][value="${measure}"]`).checked = true;
    if (measure === "milestones" && stepsList.children.length === 0) {
        renderSteps(["", ""]);
    }
}

// A suggestion chip was tapped: fill title, measure, number and unit.
// "?? ''" means: use target if it exists, otherwise an empty string
// (consistency goals have no target).
function applySuggestion(suggestion) {
    goalTitle.value = suggestion.title;
    setMeasure(suggestion.measure);
    targetInput.value = suggestion.target ?? "";
    unitInput.value = suggestion.unit ?? "";
    currentInput.value = "";
    updatePage();
}

// The user came back with Back: put their saved goal back in the form.
function loadExistingGoal() {
    if (!existingGoal) return;
    goalTitle.value = existingGoal.title;
    setMeasure(existingGoal.measure);
    targetInput.value = existingGoal.target ?? "";
    unitInput.value = existingGoal.unit;
    currentInput.value = existingGoal.current ?? "";
    if (existingGoal.milestones.length) {
        renderSteps(existingGoal.milestones.map(step => step.title));
    }
    whyInput.value = existingGoal.why;
    deadlineInput.value = existingGoal.deadline;
}

// Pack the form into ONE clean goal object, ready for saveGoal().
// Fields that don't apply are saved as null / "" / [] so the
// object always has the same shape (the dashboard can rely on it).
function buildGoal() {
    const measure = getMeasure();
    const number = usesNumber();
    return {
        // Keep the old id when editing. Habits will point at this goal
        // by goalId, so a new id would leave them pointing at nothing.
        id: existingGoal ? existingGoal.id : generateId("goal"),
        area: direction.area,
        title: goalTitle.value.trim(),
        why: whyInput.value.trim(),
        deadline: deadlineInput.value,                   // "" when not set
        measure: measure,
        target: number ? readNumber(targetInput) : null,
        unit: number ? unitInput.value.trim() : "",
        current: measure === "level" ? readNumber(currentInput) : null,
        milestones: measure === "milestones"
            ? getSteps().map(title => ({ id: generateId("step"), title: title, done: false }))
            : [],
        createdAt: existingGoal ? existingGoal.createdAt : Date.now()
    };
}


/* ---------- 7. Page load ---------- */

// Fill the Direction card at the top (textContent: safe for user text).
document.getElementById("directionIcon").textContent = area ? area.icon : "flag";
document.getElementById("directionArea").textContent = direction.areaLabel;
document.getElementById("directionIdentity").textContent = direction.identity;

// The date picker greys out days before today.
deadlineInput.min = todayLocal();

renderGoalChips();
renderUnitChips();
loadExistingGoal();
updatePage();


/* ---------- 8. Events ---------- */

// Event delegation: ONE listener on the chip container handles every
// chip. closest() finds the chip even if the click landed on its text.
goalChips.addEventListener("click", (event) => {
    const chip = event.target.closest(".goal-chip");
    if (!chip) return;                          // clicked the gap between chips
    applySuggestion(area.goals[chip.dataset.index]);
});

// "change" fires when a radio is picked (mouse, touch or arrow keys).
goalForm.addEventListener("change", (event) => {
    if (event.target.name === "measure") setMeasure(event.target.value);
    updatePage();
});

// "input" fires on every keystroke in ANY box inside the form,
// even step boxes created later, because events bubble up to the form.
goalForm.addEventListener("input", updatePage);

unitChips.addEventListener("click", (event) => {
    const chip = event.target.closest(".unit-chip");
    if (!chip) return;
    unitInput.value = chip.dataset.unit;
    updatePage();
});

addStepButton.addEventListener("click", () => {
    addStepRow().focus();                       // cursor jumps into the new box
    updateStepButtons();
    updatePage();
});

stepsList.addEventListener("click", (event) => {
    const remove = event.target.closest(".step-remove");
    if (!remove) return;
    remove.closest(".step-row").remove();       // remove the whole row
    updateStepButtons();
    updatePage();
});

// Continue button OR Enter key both submit the form.
goalForm.addEventListener("submit", (event) => {
    event.preventDefault();                     // stop the browser reloading the page
    if (getProblem()) return;                   // safety net: never save a broken goal

    saveGoal(buildGoal());                      // state.js does the saving
    setCurrentStep(4);
    window.location.href = "habit.html";
});
