/* =========================================================
   ROUTINE PAGE  (startup/routine.html)

   What this page does:
     Gives every habit (and Wake up / Sleep) a time in the day.
     One item can have DIFFERENT times on different days:
       Memorize new → 05:30 on weekdays, 08:00 on weekends.
     "Finish setup" saves everything with saveRoutine() from
     state.js, then goes to setup.html (the summary page).

   The ideas this page is built on:
     PLAN  = one thing to schedule (Wake up, a habit, Sleep).
     SLOT  = one "time + days" row inside a plan.
     RULE  = every day the plan happens must be in EXACTLY ONE slot.
             (Two times on Monday makes no sense; no time on Monday
             means the dashboard can't tell you when to do it.)

     plans = [
       { key: "wake",  label: "Wake up", allowedDays: [all 7],
         slots: [ { time: "06:00", days: [all 7] } ] },
       { key: "habit-17...", label: "Memorize new", allowedDays: [mon..fri],
         slots: [ { time: "05:30", days: [mon..fri] } ] },
       { key: "sleep", ... }
     ]

   How this file is organized:
     1. Guard        2. Elements     3. Settings     4. Page state
     5. Readers      6. Building plans from saved data
     7. Renderers    8. Actions      9. Page load    10. Events
   ========================================================= */


/* ---------- 1. Guard ---------- */

// Routine needs habits. No habits saved = they skipped the Habit step.
// ONE day, so EVERY active goal's habits are here: saving (replaceRoutinePlan)
// replaces all habit times, so a goal left out here would lose its times.
// "?new=1": Habit sent us here because a new habit has no time yet.
const fromNewHabit = new URLSearchParams(window.location.search).get("new") === "1";
// "?habit=h3": Plan's "Set a time" link → open with THAT habit's time box ready.
const habitToTime = new URLSearchParams(window.location.search).get("habit");

const goals = getActiveGoals();
const goal = goals[0] || null;                                   // the main goal (for the card)
const habits = goals.flatMap(item => getHabitsForGoal(item.id));
if (habits.length === 0) {
    window.location.replace(editMode ? "habit.html?mode=edit" : "habit.html");
}


/* ---------- 2. Elements ---------- */

const goalTitle = document.getElementById("goalTitle");
const habitNames = document.getElementById("habitNames");
const planList = document.getElementById("planList");
const routineStatus = document.getElementById("routineStatus");
const previewDays = document.getElementById("previewDays");
const timeline = document.getElementById("timeline");
const finishButton = document.getElementById("finishButton");


/* ---------- 3. Settings ---------- */

const MAX_SLOTS = 3;                     // at most 3 different times per item
const DEFAULT_WAKE = "06:00";
const DEFAULT_SLEEP = "22:00";

const TYPE_ICONS = { quantity: "straighten", time: "timer", completion: "task_alt" };

// Full names for screen readers: the buttons only show "M", "T"...
const DAY_NAMES = {
    mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
    fri: "Friday", sat: "Saturday", sun: "Sunday"
};

const QUESTIONS = {
    wake: "When do you wake up?",
    sleep: "When do you go to sleep?",
    habit: "When do you usually do this?"
};


/* ---------- 4. Page state ---------- */

let plans = [];                         // everything being scheduled (see top comment)
let previewDay = todayKey();             // which day "Your day" shows; starts on today


/* ---------- 5. Readers: they only LOOK ---------- */

// Today as "mon" / "tue"... getDay() counts from Sunday = 0.
function todayKey() {
    return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
}

// "mon" → "Mon"
function shortDay(day) {
    return day.charAt(0).toUpperCase() + day.slice(1);
}

function findPlan(key) {
    return plans.find(plan => plan.key === key);
}

// Days this plan happens on, but that no slot covers yet.
// flatMap: every slot's days, all in one flat list.
function getUncoveredDays(plan) {
    const covered = plan.slots.flatMap(slot => slot.days);
    return plan.allowedDays.filter(day => !covered.includes(day));
}

// Can the user split this plan into one more time?
// Needs room (under MAX_SLOTS) and a slot with 2+ days to take one from.
function canAddSlot(plan) {
    return plan.slots.length < MAX_SLOTS && plan.slots.some(slot => slot.days.length > 1);
}

// What's wrong with this plan? A message, or "" when it's fine.
// Same idea as getProblem() on the other pages.
function getPlanProblem(plan) {
    if (plan.slots.some(slot => !slot.time)) {
        return plan.slots.length > 1 ? "Pick a time for each row." : "Pick a time.";
    }
    if (plan.slots.some(slot => slot.days.length === 0)) {
        return "One time has no days. Tap some days, or remove it.";
    }
    const missing = getUncoveredDays(plan);
    if (missing.length > 0) {
        return `Missing a time for: ${missing.map(shortDay).join(", ")}.`;
    }
    return "";
}

// Every plan that still has a problem, for the status line and the Finish button.
function getUnfinishedPlans() {
    return plans.filter(plan => getPlanProblem(plan) !== "");
}

// What happens on one day, in time order. Used by "Your day".
//   - plans that don't happen that day are skipped (Recite with a teacher on Tuesday)
//   - plans with no time yet go at the end, so nothing silently disappears
function getScheduleForDay(day) {
    const entries = plans
        .filter(plan => plan.allowedDays.includes(day))
        .map(plan => {
            const slot = plan.slots.find(item => item.days.includes(day));
            return { plan: plan, time: slot ? slot.time : "" };
        });

    // "HH:MM" text sorts in the same order as the times: "05:30" < "22:00".
    const timed = entries.filter(entry => entry.time)
        .sort((a, b) => a.time.localeCompare(b.time));
    const untimed = entries.filter(entry => !entry.time);
    return timed.concat(untimed);
}


/* ---------- 6. Building plans from saved data ---------- */

// Make saved slots fit the days a habit happens on NOW.
// Why: the user may have gone back and changed the habit's days.
//   - days the habit no longer has are dropped
//   - a day in two slots keeps only the first (the "exactly one" rule)
//   - slots left with no days are removed
//   - new habit days with no slot go into the first slot
function fitSlots(slots, allowedDays) {
    const used = [];
    const fitted = [];

    slots.forEach(slot => {
        const days = slot.days.filter(day => allowedDays.includes(day) && !used.includes(day));
        used.push(...days);
        if (days.length > 0) fitted.push({ time: slot.time, days: days });
    });

    if (fitted.length === 0) {
        fitted.push({ time: slots.length ? slots[0].time : "", days: [] });
    }

    const missing = allowedDays.filter(day => !used.includes(day));
    // Keep Mon→Sun order: filter WEEK_DAYS instead of pushing to the end.
    fitted[0].days = WEEK_DAYS.filter(day => fitted[0].days.includes(day) || missing.includes(day));
    return fitted;
}

// One plan. savedItems = this plan's items from the saved routine (maybe none).
// No saved items → one slot covering every day, at the default time.
function createPlan({ key, kind, habitId, label, detail, icon, allowedDays, savedItems, defaultTime }) {
    const slots = savedItems.length > 0
        ? savedItems.map(item => ({ time: item.time, days: item.days }))
        : [{ time: defaultTime, days: allowedDays.slice() }];

    return {
        key, kind, habitId, label, detail, icon, allowedDays,
        slots: fitSlots(slots, allowedDays),
        touched: false          // has the user changed this plan? (errors wait until then)
    };
}

// All plans, in day order: Wake up → each habit → Sleep.
// getRoutine() (state.js) gives back what was saved last time, if anything.
function buildPlans() {
    const saved = getRoutine().filter(item => !item.date);     

    const wake = createPlan({
        key: "wake", kind: "wake", habitId: null,
        label: "Wake up", detail: "Starts your day", icon: "wb_sunny",
        allowedDays: WEEK_DAYS.slice(),
        savedItems: saved.filter(item => item.kind === "wake"),
        defaultTime: DEFAULT_WAKE
    });

    const habitPlans = habits.map(habit => createPlan({
        key: habit.id, kind: "habit", habitId: habit.id,
        label: habit.name,
        detail: `${describeHabitAmount(habit)} · ${describeDays(habit.days)}`,
        icon: TYPE_ICONS[habit.type],
        allowedDays: habit.days,
        savedItems: saved.filter(item => item.habitId === habit.id),
        defaultTime: ""                  // no guess: the user decides when
    }));

    const sleep = createPlan({
        key: "sleep", kind: "sleep", habitId: null,
        label: "Sleep", detail: "Ends your day", icon: "bedtime",
        allowedDays: WEEK_DAYS.slice(),
        savedItems: saved.filter(item => item.kind === "sleep"),
        defaultTime: DEFAULT_SLEEP
    });

    return [wake, ...habitPlans, sleep];
}


/* ---------- 7. Renderers: they DRAW ---------- */

// One slot row:  [time]  M T W T F S S  [×]
// Every button carries data-action / data-key / data-slot (/ data-day),
// so ONE listener on planList can tell exactly what was clicked.
function createSlotRow(plan, slot, index) {
    const row = document.createElement("li");
    row.className = "slot-row";

    const inputId = `time-${plan.key}-${index}`;
    const label = document.createElement("label");
    label.className = "visually-hidden";
    label.htmlFor = inputId;
    label.textContent = plan.slots.length > 1
        ? `Time for ${plan.label}, row ${index + 1}`
        : `Time for ${plan.label}`;

    const time = document.createElement("input");
    time.type = "time";
    time.className = "slot-time";
    time.id = inputId;
    time.value = slot.time;
    time.dataset.key = plan.key;
    time.dataset.slot = index;

    // Day buttons, not checkboxes: tapping a day MOVES it between rows
    // (a day lives in exactly one row), which checkboxes can't express.
    // aria-pressed = "on/off" for screen readers.
    const days = document.createElement("div");
    days.className = "slot-days";
    days.setAttribute("role", "group");
    days.setAttribute("aria-label", "Days at this time");

    WEEK_DAYS.forEach(day => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "slot-day";
        button.textContent = day.charAt(0).toUpperCase();     // "M"
        button.setAttribute("aria-label", DAY_NAMES[day]);    // "Monday"
        button.setAttribute("aria-pressed", slot.days.includes(day));
        button.disabled = !plan.allowedDays.includes(day);    // not a day this habit happens
        button.dataset.action = "day";
        button.dataset.key = plan.key;
        button.dataset.slot = index;
        button.dataset.day = day;
        days.append(button);
    });

    row.append(label, time, days);

    // Any row can be removed, as long as it isn't the last one left:
    // a plan always needs at least one time.
    if (plan.slots.length > 1) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "slot-remove";
        remove.dataset.action = "remove-slot";
        remove.dataset.key = plan.key;
        remove.dataset.slot = index;
        remove.setAttribute("aria-label", `Remove this time for ${plan.label}`);
        remove.innerHTML = '<span class="icon" aria-hidden="true">close</span>'; // fixed text: safe
        row.append(remove);
    }

    return row;
}

// One card: icon + name + detail, the question, the slot rows, "+ Different time", error.
function createPlanCard(plan) {
    const card = document.createElement("section");
    card.className = "plan-card";
    if (plan.kind !== "habit") card.classList.add("is-anchor");
    card.setAttribute("aria-label", plan.label);

    const head = document.createElement("div");
    head.className = "plan-head";
    const icon = document.createElement("span");
    icon.className = "icon plan-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = plan.icon;
    const title = document.createElement("div");
    title.className = "plan-title";
    const name = document.createElement("span");
    name.className = "plan-name";
    name.textContent = plan.label;                         // user text → textContent
    const detail = document.createElement("span");
    detail.className = "plan-detail";
    detail.textContent = plan.detail;
    title.append(name, detail);
    head.append(icon, title);

    const question = document.createElement("p");
    question.className = "plan-question";
    question.textContent = QUESTIONS[plan.kind];

    const list = document.createElement("ol");
    list.className = "slot-list";
    plan.slots.forEach((slot, index) => list.append(createSlotRow(plan, slot, index)));

    card.append(head, question, list);

    if (canAddSlot(plan)) {
        const add = document.createElement("button");
        add.type = "button";
        add.className = "add-slot";
        add.dataset.action = "add-slot";
        add.dataset.key = plan.key;
        add.innerHTML = '<span class="icon icon-sm" aria-hidden="true">add</span> Different time on some days';
        card.append(add);
    }

    // Filled in by updateStatus(), which can run WITHOUT rebuilding the card.
    const error = document.createElement("p");
    error.className = "plan-error";
    error.dataset.errorFor = plan.key;
    error.setAttribute("role", "alert");
    error.hidden = true;
    card.append(error);

    return card;
}

// Rebuild ALL cards from `plans`. Used when the STRUCTURE changes
// (a day moved, a row added or removed). Then refresh the status parts.
function renderPlans() {
    planList.innerHTML = "";
    plans.forEach(plan => planList.append(createPlanCard(plan)));
    updateStatus();
}

// The 7 day buttons above the timeline.
function renderPreviewDays() {
    previewDays.innerHTML = "";
    WEEK_DAYS.forEach(day => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "preview-day";
        button.dataset.day = day;
        button.textContent = shortDay(day);
        button.setAttribute("aria-label", DAY_NAMES[day]);
        button.setAttribute("aria-pressed", day === previewDay);
        previewDays.append(button);
    });
}

// "Your day": everything on previewDay, in time order.
function renderTimeline() {
    timeline.innerHTML = "";
    const schedule = getScheduleForDay(previewDay);

    schedule.forEach(({ plan, time }) => {       // destructuring: pull the 2 fields out
        const item = document.createElement("li");
        item.className = "timeline-item";
        if (plan.kind === "habit") item.classList.add("is-habit");
        if (!time) item.classList.add("is-unscheduled");

        const clock = document.createElement("span");
        clock.className = "timeline-time";
        clock.textContent = time || "--:--";

        const label = document.createElement("span");
        label.className = "timeline-label";
        label.textContent = plan.label;
        if (plan.kind === "habit") {
            const detail = document.createElement("span");
            detail.className = "timeline-detail";
            detail.textContent = time ? plan.detail : "No time yet";
            label.append(detail);
        }

        item.append(clock, label);
        timeline.append(item);
    });
}

// Everything that can change WITHOUT rebuilding the cards:
// card errors, red time boxes, the status line, Finish, the timeline.
// Why separate from renderPlans()? Rebuilding cards while someone is
// picking a time would destroy the time box they're using.
function updateStatus() {
    plans.forEach(plan => {
        const problem = getPlanProblem(plan);
        const error = planList.querySelector(`[data-error-for="${plan.key}"]`);
        error.textContent = problem;
        error.hidden = !(problem && plan.touched);      // only after they've worked on it

        plan.slots.forEach((slot, index) => {
            const input = document.getElementById(`time-${plan.key}-${index}`);
            input.classList.toggle("is-missing", plan.touched && !slot.time);
        });
    });

    const unfinished = getUnfinishedPlans();
    if (unfinished.length === 0) {
        routineStatus.textContent = "Everything has a time. You're ready to finish.";
    } else {
        const names = unfinished.map(plan => plan.label).join(", ");
        routineStatus.textContent = `Still to do: ${names}.`;
    }
    routineStatus.classList.toggle("is-done", unfinished.length === 0);
    finishButton.disabled = unfinished.length > 0;

    renderTimeline();
}

// After renderPlans() rebuilds the cards, the button that had keyboard
// focus no longer exists. Find its replacement and focus that instead,
// so keyboard users don't get thrown back to the top of the page.
function focusControl(action, key, slot, day) {
    const match = [...planList.querySelectorAll(`[data-action="${action}"]`)].find(element =>
        element.dataset.key === key &&
        (slot === undefined || element.dataset.slot === String(slot)) &&
        (day === undefined || element.dataset.day === day));
    if (match) match.focus();
}


/* ---------- 8. Actions: they CHANGE something ---------- */

function setSlotTime(plan, slotIndex, time) {
    plan.slots[slotIndex].time = time;
    plan.touched = true;
}

// Tap a day in a row:
//   - already in this row → take it out (that day now has no time: a problem to fix)
//   - not in this row     → MOVE it here, out of whichever row had it
function toggleDay(plan, slotIndex, day) {
    const slot = plan.slots[slotIndex];
    if (slot.days.includes(day)) {
        slot.days = slot.days.filter(item => item !== day);
    } else {
        plan.slots.forEach(other => {
            other.days = other.days.filter(item => item !== day);
        });
        slot.days = WEEK_DAYS.filter(item => slot.days.includes(item) || item === day);
    }
    plan.touched = true;
}

// "+ Different time on some days": add a row, and give it some days to start.
// Most people want a different WEEKEND time, so the new row takes Sat/Sun
// from the biggest row. If that's impossible (no weekend, or it would empty
// that row), it takes that row's last day instead.
function addSlot(plan) {
    const biggest = plan.slots.reduce((a, b) => (b.days.length > a.days.length ? b : a));
    const weekend = biggest.days.filter(day => WEEKEND.includes(day));
    const moving = weekend.length > 0 && weekend.length < biggest.days.length
        ? weekend
        : biggest.days.slice(-1);                        // slice(-1) = the last item, as a list

    biggest.days = biggest.days.filter(day => !moving.includes(day));
    plan.slots.push({ time: "", days: moving });
    plan.touched = true;
}

// Remove a row. Its days go back to the first row, so no day is left without a time.
function removeSlot(plan, slotIndex) {
    const [removed] = plan.slots.splice(slotIndex, 1);   // splice cuts it out and returns it
    const first = plan.slots[0];
    first.days = WEEK_DAYS.filter(day => first.days.includes(day) || removed.days.includes(day));
    plan.touched = true;
}

// Turn the plans into routine items for state.js: ONE item per slot.
//   { id, kind, habitId, label, time, days }
// habitId is the real link to the habit; label is just a copy for display.
function buildRoutineItems() {
    return plans.flatMap(plan => plan.slots.map(slot => ({
        id: generateId("routine"),
        kind: plan.kind,
        habitId: plan.habitId,
        label: plan.label,
        time: slot.time,
        days: slot.days
    })));
}


// Jump to the first habit with no time (the new one) so they see what's missing.
// With ?habit=…, that habit first; otherwise the first one missing a time.
function focusFirstMissingTime() {
    const missing = plans.filter(item => item.kind === "habit" && item.slots.some(slot => !slot.time));
    const plan = missing.find(item => item.habitId === habitToTime) || missing[0];
    if (!plan) return;
    const index = plan.slots.findIndex(slot => !slot.time);
    const input = document.getElementById(`time-${plan.key}-${index}`);
    input.scrollIntoView({ block: "center" });
    input.focus({ preventScroll: true });
}


/* ---------- 9. Page load ---------- */

if (habits.length > 0) {
    goalTitle.textContent = goals.length > 1 ? `${goals.length} goals` : goal.title;
    habitNames.textContent = habits.map(habit => habit.name).join(" · ");

    plans = buildPlans();
    renderPreviewDays();
    renderPlans();
    if (editMode) applyEditMode(fromNewHabit ? "Pick a time for your new habit" : "Editing your times", finishButton);
    if (fromNewHabit || habitToTime) focusFirstMissingTime();

}


/* ---------- 10. Events ---------- */

// Clicks anywhere in the cards. data-action says WHAT, data-key WHICH plan,
// data-slot WHICH row, data-day WHICH day.
planList.addEventListener("click", (event) => {
    const control = event.target.closest("[data-action]");
    if (!control || control.disabled) return;

    const plan = findPlan(control.dataset.key);
    const slot = Number(control.dataset.slot);           // dataset values are always text

    if (control.dataset.action === "day") {
        toggleDay(plan, slot, control.dataset.day);
        renderPlans();
        focusControl("day", plan.key, slot, control.dataset.day);
    }

    if (control.dataset.action === "add-slot") {
        addSlot(plan);
        renderPlans();
        document.getElementById(`time-${plan.key}-${plan.slots.length - 1}`).focus();
    }

    if (control.dataset.action === "remove-slot") {
        removeSlot(plan, slot);
        renderPlans();
        document.getElementById(`time-${plan.key}-0`).focus();
    }
});

// Picking a time: update the page memory and the status parts,
// but DON'T rebuild the cards (that would kill the time box in use).
planList.addEventListener("input", (event) => {
    if (!event.target.classList.contains("slot-time")) return;
    const plan = findPlan(event.target.dataset.key);
    setSlotTime(plan, Number(event.target.dataset.slot), event.target.value);
    updateStatus();
});

// Which day the preview shows.
previewDays.addEventListener("click", (event) => {
    const button = event.target.closest(".preview-day");
    if (!button) return;
    previewDay = button.dataset.day;
    renderPreviewDays();
    renderTimeline();
    previewDays.querySelector(`[data-day="${previewDay}"]`).focus();
});

// Finish: save the whole routine at once, then go to the summary page.
finishButton.addEventListener("click", () => {
    if (getUnfinishedPlans().length > 0) return;         // safety net
    replaceRoutinePlan(buildRoutineItems());              // replaces wake/sleep/habit times, KEEPS activities
    if (editMode) { leaveEditMode(); return; }            // edit: back to Plan, onboarding step untouched
    setCurrentStep(6);
    window.location.href = "setup.html";
});